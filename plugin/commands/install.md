---
description: Install a game-hub plugin from npm (e.g. /game-hub:install game-hub-plugin-2048)
allowed-tools: Bash(npm:*), Bash(curl:*)
argument-hint: <npm-package-name>
---

Install the npm package and register it with game-hub:

!`npm install -g "$ARGUMENTS" && PKG_ROOT=$(npm root -g) && curl -sS --connect-timeout 1 -X POST -H 'Content-Type: application/json' -d "{\"packageName\":\"$ARGUMENTS\",\"packagePath\":\"$PKG_ROOT/$ARGUMENTS\"}" "http://127.0.0.1:${GAME_HUB_PORT:-41731}/games/register"`

Report the result to the user. If npm install failed, explain why and stop.
If curl returns a connection error, tell the user game-hub isn't running.
If the response contains `"game-hub" field` in the error, explain this npm package is not a game-hub plugin and offer to run `npm uninstall -g "$ARGUMENTS"` to clean up.
If successful, tell the user the game was installed and they can switch to it with `/game-hub:switch <id>`.
