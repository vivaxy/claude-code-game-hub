import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { createHookServer, DEFAULT_PORT } from './hook-server.js';
import type { GameService, RegisterBody } from './hook-server.js';
import { spawnClaude } from './pty-claude.js';
import { warnIfPluginMissing } from './plugin-check.js';
import { TerminalMux } from './terminal-mux.js';
import { StateMachine } from './state.js';
import { Snake } from './games/snake.js';
import { instantiateGame, listAllGames, readPluginManifest } from './games/registry.js';
import type { HookEventName, ControlAction } from './hook-server.js';
import { loadConfig, saveConfig } from './config.js';

const port = parseInt(process.env['GAME_HUB_PORT'] ?? String(DEFAULT_PORT), 10);
const extraArgs = process.argv.slice(2);

const emitter = new EventEmitter();
const state = new StateMachine();

async function main() {
  // 1. Warn if the Claude Code plugin isn't installed.
  warnIfPluginMissing();

  // 2. Load config (includes currentGameId + installed game registry).
  const cfg = loadConfig();
  let enabled = cfg.enabled;

  const termSize = () => ({
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });

  const onGameExit = () => state.transitionTo('claude');

  // 3. Instantiate starting game from config.
  let currentGame = instantiateGame(cfg.currentGameId, cfg.installed, termSize(), onGameExit);

  // 4. Spawn Claude in a PTY and wire terminal mux.
  const claudePty = spawnClaude(extraArgs);
  const mux = new TerminalMux(claudePty, state, currentGame);
  mux.start();

  // 5. Build GameService (closes over cfg, mux, state).
  const gameService: GameService = {
    list() {
      return { currentGameId: cfg.currentGameId, games: listAllGames(cfg.installed) };
    },

    register(body: RegisterBody) {
      let manifest;
      let npmPackage: string | undefined;

      if (body.manualSpec) {
        const s = body.manualSpec;
        manifest = {
          type: 'subprocess' as const,
          id: s.id,
          name: s.name,
          description: s.description,
          command: s.command,
          args: s.args,
          env: s.env,
        };
      } else {
        const result = readPluginManifest(body.packageName, body.packagePath);
        manifest = result.manifest;
        npmPackage = body.packageName;
      }

      if (cfg.installed.find((g) => g.id === manifest.id)) {
        throw Object.assign(
          new Error(`Game "${manifest.id}" is already installed. Uninstall it first.`),
          { status: 409 },
        );
      }

      cfg.installed.push({
        id: manifest.id,
        manifest,
        npmPackage,
        packagePath: body.manualSpec ? undefined : body.packagePath,
      });
      saveConfig(cfg);
      return { manifest };
    },

    unregister(id: string) {
      if (id === 'snake') {
        throw Object.assign(
          new Error('Cannot uninstall the built-in Snake game.'),
          { status: 400 },
        );
      }
      const idx = cfg.installed.findIndex((g) => g.id === id);
      if (idx === -1) {
        throw Object.assign(
          new Error(`Game "${id}" is not installed.`),
          { status: 404 },
        );
      }
      const entry = cfg.installed[idx]!;
      cfg.installed.splice(idx, 1);

      if (cfg.currentGameId === id) {
        cfg.currentGameId = 'snake';
        mux.setGame(new Snake());
      }
      saveConfig(cfg);

      if (entry.npmPackage) {
        spawn('npm', ['uninstall', '-g', entry.npmPackage], { stdio: 'ignore' });
      }
    },

    switchTo(id: string) {
      if (id !== 'snake' && !cfg.installed.find((g) => g.id === id)) {
        throw Object.assign(
          new Error(`Game "${id}" is not installed. Run /game-hub:list to see available games.`),
          { status: 404 },
        );
      }
      const newGame = instantiateGame(id, cfg.installed, termSize(), onGameExit);
      mux.setGame(newGame);
      cfg.currentGameId = id;
      saveConfig(cfg);
    },
  };

  // 6. Start hook HTTP server.
  await createHookServer(emitter, port, gameService);

  // 7. Hook events → state transitions.
  emitter.on('hook', (event: HookEventName) => {
    if (event === 'prompt_submit') {
      if (enabled) state.transitionTo('game');
    } else if (event === 'stop' || event === 'notification') {
      state.transitionTo('claude');
    }
    // subagent_stop is a no-op in v0
  });

  // 7b. Control events → enable/disable game-mode.
  emitter.on('control', (action: ControlAction) => {
    enabled = action === 'enable';
    cfg.enabled = enabled;
    saveConfig(cfg);
  });

  // 8. Cleanup on PTY exit.
  claudePty.onExit(() => {
    mux.restoreTerminal();
    process.exit(0);
  });

  // 9. Trap signals for clean shutdown.
  const shutdown = () => {
    mux.restoreTerminal();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => mux.restoreTerminal());
}

main().catch((err) => {
  process.stderr.write(`[game-hub] fatal: ${String(err)}\n`);
  process.exit(1);
});
