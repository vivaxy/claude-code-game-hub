import { EventEmitter } from 'node:events';
import { createHookServer, DEFAULT_PORT } from './hook-server.js';
import { spawnClaude } from './pty-claude.js';
import { warnIfPluginMissing } from './plugin-check.js';
import { TerminalMux } from './terminal-mux.js';
import { StateMachine } from './state.js';
import { Snake } from './games/snake.js';
import type { HookEventName } from './hook-server.js';

const port = parseInt(process.env['GAME_HUB_PORT'] ?? String(DEFAULT_PORT), 10);
const extraArgs = process.argv.slice(2);

const emitter = new EventEmitter();
const state = new StateMachine();
const game = new Snake();

async function main() {
  // 1. Warn if the Claude Code plugin isn't installed.
  warnIfPluginMissing();

  // 2. Start hook HTTP server.
  await createHookServer(emitter, port);

  // 3. Spawn Claude in a PTY.
  const claudePty = spawnClaude(extraArgs);

  // 4. Wire terminal mux.
  const mux = new TerminalMux(claudePty, state, game);
  mux.start();

  // 5. Hook events → state transitions.
  emitter.on('hook', (event: HookEventName) => {
    if (event === 'prompt_submit') {
      state.transitionTo('game');
    } else if (event === 'stop' || event === 'notification') {
      state.transitionTo('claude');
    }
    // subagent_stop is a no-op in v0
  });

  // 5. Cleanup on PTY exit.
  claudePty.onExit(() => {
    mux.restoreTerminal();
    process.exit(0);
  });

  // 6. Trap signals for clean shutdown.
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
