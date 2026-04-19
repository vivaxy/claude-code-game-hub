---
description: Switch the active game (e.g. /game-hub:switch snake)
allowed-tools: Bash(curl:*)
argument-hint: <game-id>
---

Switch to a different game. The new game will activate the next time Claude starts working on a prompt.

!`curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d "{\"id\":\"$ARGUMENTS\"}" "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/switch"`

Report the result. If successful, tell the user game-hub will use this game next time they submit a prompt.
If the game id is not found, suggest they run `/game-hub:list` to see available games.
If curl fails (connection refused), tell the user game-hub isn't running.
