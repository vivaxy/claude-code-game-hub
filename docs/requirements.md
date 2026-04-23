# Requirements

## Purpose

`game-hub` is a PTY wrapper around the `claude` CLI that multiplexes the terminal between Claude Code's conversation and a game. When Claude starts working on a prompt the game starts; when Claude finishes or needs input the game pauses and Claude Code's view returns.

## Functional Requirements

### Core multiplexing
- When a `UserPromptSubmit` hook fires → switch to game-mode (start/resume the game) and update Claude status to `working`.
- When a `Stop` hook fires → update Claude status to `idle`. The game continues running.
- When a `Notification` hook fires → update Claude status to `waiting-for-input`. The game continues running.
- Game-mode toggle: press `Ctrl+G` to switch between game-mode and claude-mode in either direction. The game is paused on exit and resumed on re-entry; state is preserved.
- At most one paused game exists at a time. Switching games (`/game-hub:switch`) discards the previously paused game.
- Game-mode can be disabled at runtime via `/game-hub:disable`; re-enabled via `/game-hub:enable`. Disabled state is persisted across restarts.

### Status line
- A single-line status indicator is displayed on row 1 while in game-mode, above the game frame.
- Row 1 is reserved for this indicator only while in game-mode; in claude-mode Claude Code uses the full terminal height.
- Three animated states, each visually distinct:
  - `idle` — pulsing bright-green label (bold ↔ normal, ~600 ms), signals Claude is ready.
  - `working` — cycling star glyph (`✢ ✳ ✶ ✻ ✽`) prefixed to the label in bold cyan (~120 ms), signals active processing.
  - `waiting-for-input` — color-flashing label (bold yellow ↔ bold red, 500 ms) with a glyph prefix; also displays `press Ctrl+G to return to Claude`.

### Hook integration
- Hooks POST events to `http://127.0.0.1:${GAME_HUB_PORT}/event`.
- Hooks must be no-ops when game-hub is not running (`curl --connect-timeout 0.1` fails silently).
- Hooks are registered automatically on `npm install -g`, refreshed in place if already installed, and removed on `npm uninstall -g`.

### Game management
- A built-in Snake game ships with the package.
- Users can install additional games via `/game-hub:install <package-manager> <spec>`. Supported package managers:
  - Node PMs (npm, pnpm, yarn, bun): install to global node_modules and read the `game-hub` manifest from `package.json`. Any PM-compatible spec is accepted (registry name, `github:user/repo`, git URL, local path, tarball).
  - System PMs (brew, cargo, pip, pip3, or any other): install the binary and auto-register it as a subprocess game using the package name as the command.
- Game CLIs already installed on PATH (by any means) can be registered with `/game-hub:register <id> <command>`.
- Users can switch the active game without restarting game-hub.
- The active game ID is persisted in config across restarts.

### Snake restart
- On the Snake game-over screen, press `r`/`R` to enter a restart confirmation prompt.
- Confirm with `y`/`Y` to restart; any other key cancels and returns to the game-over screen.
- A session-local best score is tracked and displayed in the title; it persists across restarts within the same hub process.
- `r`/`R` during active play is ignored.
- The game-over overlay (`GAME OVER`, `score:`, restart hint) and the `Restart? (y/n)` confirm prompt render below the grid's bottom border, each line horizontally centered within the grid's outer width. The overlay must not paint onto any grid cell or border row.

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
