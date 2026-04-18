# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

`game-hub` is a PTY wrapper around the `claude` CLI. It multiplexes your terminal between Claude Code's conversation and a Snake game: when Claude starts working on a prompt, the game starts; when Claude finishes or needs input, the game pauses and Claude Code's view returns.

## Commands

```bash
npm install        # install deps (node-pty, typescript)
npm run build      # compile TypeScript → dist/
npm run dev        # watch mode
node bin/game-hub.js   # run the hub (or: npm start)
```

Set `GAME_HUB_PORT` (default `41731`) to change the hook server port.

## Hook installation

The Claude plugin is registered automatically when you run `npm install -g claude-code-game-hub`. If `claude` wasn't on PATH at install time, or you installed without `-g`, register manually once:

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

## Architecture invariants

1. **No wrapper-level alt-screen toggling.** Terminals have one main + one alt buffer; they don't stack. Claude Code already lives in the alt-screen. The hub never issues `ESC[?1049h`/`l` — both modes share whatever screen Claude set up.

2. **Explicit input ownership per mode.** In `claude-mode`, stdin is piped to the PTY. In `game-mode`, stdin goes to the game's keyhandler; nothing reaches the PTY. On each mode switch, a brief 80ms drain window discards in-flight bytes.

## State machine (`src/state.ts`)

```
claude-mode  ──[prompt_submit]──►  game-mode
             ◄──[stop/notif]──────
```

## Adding a new game

1. Implement the `Game` interface from `src/games/index.ts` (`resume`, `pause`, `handleInput`, `resize`).
2. Instantiate it in `src/index.ts` and pass it to `TerminalMux`.

## Key files

| File | Role |
|---|---|
| `src/index.ts` | wiring: hook server → state → mux |
| `src/state.ts` | mode state machine + stdin drain |
| `src/terminal-mux.ts` | PTY output buffering, input routing, screen transitions |
| `src/hook-server.ts` | `node:http` server for hook POST events |
| `src/pty-claude.ts` | spawn `claude` under `node-pty` |
| `plugin/hooks/hooks.json` | Claude Code plugin hook definitions |
| `src/games/snake.ts` | Snake implementation (~200 LOC) |
