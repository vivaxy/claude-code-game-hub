## Workflow

- Before writing code: update `docs/requirements.md` if behavior changes, `docs/design.md` if architecture changes.
- After writing code: update or add tests covering the change. Tests live in `test/` and run with `npm test` (vitest).

## Commands

```bash
npm install        # install deps (node-pty, typescript)
npm run build      # compile TypeScript → dist/
npm run dev        # watch mode
node bin/game-hub.js   # run the hub (or: npm start)
```

Set `GAME_HUB_PORT` (default `41731`) to change the hook server port.
Set `GAME_HUB_DEBUG=1` to append raw stdin bytes and state transitions to `/tmp/game-hub-debug.log` for troubleshooting.
