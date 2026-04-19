# Requirements

## Purpose

`game-hub` is a PTY wrapper around the `claude` CLI that multiplexes the terminal between Claude Code's conversation and a game. When Claude starts working on a prompt the game starts; when Claude finishes or needs input the game pauses and Claude Code's view returns.

## Functional Requirements

### Core multiplexing
- When a `UserPromptSubmit` hook fires → switch to game-mode (start/resume the game).
- When a `Stop` or `Notification` hook fires → switch to claude-mode (pause the game, return the terminal to Claude Code).
- Game-mode can be disabled at runtime via `/game-hub:disable`; re-enabled via `/game-hub:enable`. Disabled state is persisted across restarts.

### Hook integration
- Hooks POST events to `http://127.0.0.1:${GAME_HUB_PORT}/event`.
- Hooks must be no-ops when game-hub is not running (`curl --connect-timeout 0.1` fails silently).
- Hooks are registered automatically on `npm install -g` and removed on `npm uninstall -g`.

### Game management
- A built-in Snake game ships with the package.
- Users can install additional games as npm packages (external game plugins).
- Users can switch the active game without restarting game-hub.
- The active game ID is persisted in config across restarts.

### Configuration
- `GAME_HUB_PORT` (default `41731`) controls the HTTP hook server port.
- Config (enabled flag, current game ID, installed games) is stored in a local config file.

## Non-Functional Requirements

- Must not interfere with Claude Code's alt-screen rendering (no wrapper-level `ESC[?1049h/l`).
- Mode switches must drain stdin for 80 ms to prevent in-flight keystrokes leaking between contexts.
- The hub process must exit cleanly on PTY exit, `SIGINT`, or `SIGTERM`, restoring the terminal.

## Extensibility

- Must support adding new built-in games via a TypeScript `Game` interface.
- Must support external game plugins published as npm packages with a `"game-hub"` manifest field.
