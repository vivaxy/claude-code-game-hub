---
description: Disable game-hub (game-mode is suppressed until re-enabled)
allowed-tools: Bash(curl:*)
---

Disable game-hub by posting to the control endpoint:

!`curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d '{"action":"disable"}' "http://127.0.0.1:${GAME_HUB_PORT:-41731}/control"`

Report the result to the user. If the curl failed (connection refused), tell them game-hub isn't running and they need to launch it first.
