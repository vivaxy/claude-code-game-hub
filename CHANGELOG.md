## 1.0.0 (2026-04-23)

### Features

* add mov-to-gif script and README demo ([7153ea7](https://github.com/vivaxy/claude-code-game-hub/commit/7153ea7e4cac77f552004690bc4251bc1913c533))
* **ci:** add semantic-release workflow for automated npm publishing ([1760370](https://github.com/vivaxy/claude-code-game-hub/commit/176037071278d8dc97ec3deb4ebb7bee3aa6286c))
* Claude Status + Manual Exit + Snake Restart ([ebfd0d2](https://github.com/vivaxy/claude-code-game-hub/commit/ebfd0d26f649ea8b481ef4c95a619f9a9e304171))
* **commands:** add /game-hub:enable and /game-hub:disable slash commands ([94bd513](https://github.com/vivaxy/claude-code-game-hub/commit/94bd513c1543ad4adbb416cb4467d55a80708384))
* **games:** add plugin system with subprocess game support ([6997380](https://github.com/vivaxy/claude-code-game-hub/commit/6997380855881c80635fe73fdd386fef38ad9b6e))
* init ([10ad42a](https://github.com/vivaxy/claude-code-game-hub/commit/10ad42a6feea4c12e867823aa2758233de5fe48e))
* **install:** support multiple package managers in /game-hub:install ([617aae6](https://github.com/vivaxy/claude-code-game-hub/commit/617aae60623cac83a7754f3d715b4b3726d807f6))
* **ux:** animate status bar with per-state glyph cycling ([ca5cc36](https://github.com/vivaxy/claude-code-game-hub/commit/ca5cc36cc6cc49c3cab52c585f67e25348c8f977))
* **ux:** replace q with Ctrl+G for bidirectional game/claude toggle ([1c8930b](https://github.com/vivaxy/claude-code-game-hub/commit/1c8930ba00af1267da306e17936e46558c5d331d))

### Bug Fixes

* **ci:** bump Node.js to 22 for semantic-release compatibility ([28b45d3](https://github.com/vivaxy/claude-code-game-hub/commit/28b45d3752f1bab4624efd5aaddf0f4e00c78e45))
* **input:** handle xterm modifyOtherKeys encoding of Ctrl+G ([e8a0155](https://github.com/vivaxy/claude-code-game-hub/commit/e8a01551f045137324c5bbd04c2a8a2ba8a618d8))
* **postinstall:** check before install, fail hard on install errors ([c3f428c](https://github.com/vivaxy/claude-code-game-hub/commit/c3f428cbe2ee94ad7a2685956a32cf55b3e42965))
* **postinstall:** refresh plugin instead of skipping when already installed ([2f13b07](https://github.com/vivaxy/claude-code-game-hub/commit/2f13b07278011a3be3583fdfbcf796bef4327356))
* **render:** stop reserving top row in claude-mode to eliminate first-render misalignment ([ccc65a5](https://github.com/vivaxy/claude-code-game-hub/commit/ccc65a53a892a86b357e7c5ef8c643b77b215d64))
* **snake:** move game-over overlay below grid, center within grid width ([b3b784e](https://github.com/vivaxy/claude-code-game-hub/commit/b3b784e2ffe8d9f63fe48e0c24f54dd5d3c090b8))
