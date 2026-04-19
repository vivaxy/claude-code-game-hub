---
description: Register a locally-installed CLI game (e.g. /game-hub:register 2048 2048-cli)
allowed-tools: Bash(curl:*)
argument-hint: <id> <command>
---

Register an already-installed CLI game. First word is the game id, second word is the command on PATH.

!`ID=$(printf '%s' "$ARGUMENTS" | awk '{print $1}'); CMD=$(printf '%s' "$ARGUMENTS" | awk '{print $2}'); curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d "{\"manualSpec\":{\"id\":\"$ID\",\"name\":\"$ID\",\"command\":\"$CMD\",\"args\":[]}}" "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/register"`

Report the result. If registration succeeds, tell the user they can switch to it with `/game-hub:switch <id>`.
If curl fails (connection refused), tell the user game-hub isn't running.
Note: the game command must already be on PATH. Use `/game-hub:install` for npm-distributed plugins.
If a game needs command-line arguments, use the hub API directly: POST /games/register with a manualSpec including the args array.
