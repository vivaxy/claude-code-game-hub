---
description: Install a game-hub plugin via any package manager (e.g. /game-hub:install npm game-hub-plugin-2048)
allowed-tools: Bash(node:*), Bash(curl:*)
argument-hint: <package-manager> <spec>  (e.g. npm my-pkg | pnpm github:user/repo | brew tetris-cli | cargo tetris-game)
---

Install the game plugin and register it with game-hub:

!`DATA=$(node -e "const s=process.argv[1]; const i=s.indexOf(' '); process.stdout.write(JSON.stringify({packageManager:s.slice(0,i),spec:s.slice(i+1).trim()}))" -- "$ARGUMENTS") && curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d "$DATA" "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/install"`

Report the result to the user. If curl returns a connection error, tell the user game-hub isn't running.
If the response contains `"game-hub" field` in the error, explain the npm/node package is not a game-hub plugin (only applies to npm/pnpm/yarn/bun installs).
If install failed (status 500), show the error message from the response.
If successful, tell the user the game was installed and they can switch to it with `/game-hub:switch <id>`.
For system PM installs (brew, cargo, pip, etc.) the binary name is used as the game id — if the actual binary differs, suggest running `/game-hub:uninstall <id>` then `/game-hub:register <id> <real-command>` to fix it.
