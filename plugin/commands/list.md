---
description: List installed games and show which is active
allowed-tools: Bash(curl:*)
---

Fetch the list of installed games from game-hub:

!`curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/list"`

Display the results as a table with columns: active (✓ or blank), id, name, source (builtin/npm/manual).
Mark the current game with ✓ in the active column.
If curl fails (connection refused), tell the user game-hub isn't running.
