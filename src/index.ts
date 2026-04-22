import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { createHookServer, DEFAULT_PORT } from './hook-server.js';
import type { GameService, RegisterBody, InstallBody } from './hook-server.js';
import { spawnClaude } from './pty-claude.js';
import { warnIfPluginMissing } from './plugin-check.js';
import { TerminalMux } from './terminal-mux.js';
import { StateMachine } from './state.js';
import { Snake } from './games/snake.js';
import { instantiateGame, listAllGames, readPluginManifest } from './games/registry.js';
import type { HookEventName, ControlAction } from './hook-server.js';
import { loadConfig, saveConfig } from './config.js';
import type { GameManifest } from './config.js';
import { NODE_PMS, getNodeModulesRoot, getInstallArgs, getUninstallArgs, scanNodeModules } from './package-managers.js';

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
    rows: (process.stdout.rows || 24) - 1,
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

    install({ packageManager: pm, spec }: InstallBody) {
      const [cmd, args] = getInstallArgs(pm, spec);

      let manifest: GameManifest;
      let resolvedName: string;
      let resolvedPath: string | undefined;

      if (NODE_PMS.has(pm)) {
        // Node PM: take a before snapshot, install, then diff to find the new plugin package.
        let moduleRoot: string;
        try { moduleRoot = getNodeModulesRoot(pm); }
        catch (err) {
          throw Object.assign(new Error((err as Error).message), { status: 500 });
        }

        const before = scanNodeModules(moduleRoot);

        const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        if (result.error) {
          throw Object.assign(new Error(`Failed to run ${pm}: ${result.error.message}`), { status: 500 });
        }
        if (result.status !== 0) {
          const msg = (result.stderr ?? '').trim() || (result.stdout ?? '').trim();
          throw Object.assign(new Error(`${pm} install failed:\n${msg}`), { status: 500 });
        }

        const after = scanNodeModules(moduleRoot);
        const newPkgs = [...after.entries()].filter(([name]) => !before.has(name));

        let resolved: { name: string; pkgPath: string } | undefined;
        for (const [name, pkgPath] of newPkgs) {
          try {
            const pkgJson = JSON.parse(
              fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'),
            ) as Record<string, unknown>;
            if (pkgJson['game-hub']) {
              resolved = { name, pkgPath };
              break;
            }
          } catch { /* transitive dep — skip */ }
        }

        if (!resolved) {
          for (const [name] of newPkgs) {
            const [uc, ua] = getUninstallArgs(pm, name);
            spawn(uc, ua, { stdio: 'ignore' });
          }
          throw Object.assign(
            new Error(
              `No "game-hub" field found in the installed package's package.json. ` +
                `This is not a game-hub plugin.`,
            ),
            { status: 400 },
          );
        }

        ({ manifest } = readPluginManifest(resolved.name, resolved.pkgPath));
        resolvedName = resolved.name;
        resolvedPath = resolved.pkgPath;
      } else {
        // System PM (brew, cargo, pip, etc.): install the binary, then auto-register as subprocess.
        // The binary name is derived from the spec (last path component, drop version after @).
        const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        if (result.error) {
          throw Object.assign(new Error(`Failed to run ${pm}: ${result.error.message}`), { status: 500 });
        }
        if (result.status !== 0) {
          const msg = (result.stderr ?? '').trim() || (result.stdout ?? '').trim();
          throw Object.assign(new Error(`${pm} install failed:\n${msg}`), { status: 500 });
        }

        const binaryName = spec.split('/').pop()?.split('@')[0] ?? spec;
        manifest = { type: 'subprocess', id: binaryName, name: binaryName, command: binaryName };
        resolvedName = spec;
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
        npmPackage: resolvedName,
        packagePath: resolvedPath,
        packageManager: pm,
      });
      saveConfig(cfg);
      return { manifest };
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
        const pm = entry.packageManager ?? 'npm';
        const [uc, ua] = getUninstallArgs(pm, entry.npmPackage);
        spawn(uc, ua, { stdio: 'ignore' });
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
      // Also handles the case where user pressed Ctrl+G to peek at Claude and then submitted
      // a new prompt — returns to game-mode, resuming the paused game. Gated by enabled so
      // /game-hub:disable keeps working.
      state.setStatus('working');
      if (enabled) state.transitionTo('game');
    } else if (event === 'stop') {
      state.setStatus('idle');
    } else if (event === 'notification') {
      state.setStatus('waiting-for-input');
    }
    // subagent_stop is a no-op
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
