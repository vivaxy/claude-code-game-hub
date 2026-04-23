# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `docs/requirements.md` for what this project does and `docs/design.md` for architecture.

## Workflow

- Before writing code: update `docs/requirements.md` if behavior changes, `docs/design.md` if architecture changes.
- After writing code: update or add tests covering the change. Tests live in `test/` and run with `npm test` (vitest).

## Commands

```bash
npm install        # install deps (node-pty, typescript)
npm run build      # compile TypeScript → dist/
npm run dev        # watch mode
node bin/game-hub.js   # run the hub (or: npm start)
```

Set `GAME_HUB_PORT` (default `41731`) to change the hook server port.
Set `GAME_HUB_DEBUG=1` to append raw stdin bytes and state transitions to `/tmp/game-hub-debug.log` for troubleshooting.

## Hook installation

The Claude plugin is registered automatically when you run `npm install -g claude-code-game-hub`. Re-running the same command refreshes the plugin to the latest GitHub HEAD (Claude Code restart required to apply). If `claude` wasn't on PATH at install time, or you installed without `-g`, register manually once:

```
claude plugin marketplace add vivaxy/claude-code-game-hub
claude plugin install game-hub@claude-code-game-hub
```

To uninstall: `npm uninstall -g claude-code-game-hub` removes the plugin automatically. If you used a local (non-global) install, npm's preuninstall hook won't fire — run these manually:

```
claude plugin uninstall game-hub@claude-code-game-hub
claude plugin marketplace remove claude-code-game-hub
```

The plugin registers `UserPromptSubmit`, `Stop`, and `Notification` hooks that POST to `http://127.0.0.1:${GAME_HUB_PORT:-41731}/event`. The hooks are no-ops when game-hub isn't running (`curl --connect-timeout 0.1`).

**Upgrading from v0:** If you previously ran game-hub before this change, it will have left entries in `~/.claude/settings.json` whose `command` contains `# game-hub-v0`. Delete those manually to avoid them firing alongside the plugin hooks.
