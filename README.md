# claude-code-game-hub

A PTY wrapper for the `claude` CLI that plays a game while Claude is thinking.
Press `Ctrl+G` any time to toggle between the game and Claude.

## Install

```bash
npm install -g claude-code-game-hub
```

This also registers the Claude plugin hooks. See [CLAUDE.md](./CLAUDE.md) for manual install, uninstall, and upgrade notes.

## Usage

Once installed, just use `claude` normally. When you submit a prompt, game-mode activates; when Claude finishes or asks for input, the status line updates. The built-in game is Snake.

- `Ctrl+G` — toggle between game-mode and claude-mode
- `/game-hub:list` — list installed games
- `/game-hub:switch <id>` — switch active game
- `/game-hub:install <pm> <spec>` — install a new game (npm, brew, cargo, pip, …)
- `/game-hub:disable` / `/game-hub:enable` — turn game-mode off/on

## Configuration

- `GAME_HUB_PORT` (default `41731`) — HTTP port for hook events.

## Docs

- [docs/requirements.md](./docs/requirements.md) — full feature list
- [docs/design.md](./docs/design.md) — architecture
