---
description: Uninstall a game plugin (e.g. /game-hub:uninstall 2048)
allowed-tools: Bash(curl:*)
argument-hint: <game-id>
---

Uninstall a game by id. The hub will unregister it and remove the npm package in the background (if applicable).

!`curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d "{\"id\":\"$ARGUMENTS\"}" "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/unregister"`

Report the result. If the error says "Cannot uninstall the built-in Snake game", explain Snake is always available and cannot be removed.
If the game was the active game, tell the user game-hub has switched back to Snake.
If curl fails (connection refused), tell the user game-hub isn't running.
