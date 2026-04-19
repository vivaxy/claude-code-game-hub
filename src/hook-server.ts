import * as http from 'node:http';
import { EventEmitter } from 'node:events';
import type { GameManifest, InstalledGame } from './config.js';

export type HookEventName = 'prompt_submit' | 'stop' | 'notification' | 'subagent_stop';
export type ControlAction = 'enable' | 'disable';

export const DEFAULT_PORT = 41731;

export type GameDescriptor = {
  id: string;
  name: string;
  description?: string;
  builtin: boolean;
};

export type ManualSpec = {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type RegisterBody =
  | { packageName: string; packagePath?: string; manualSpec?: never }
  | { manualSpec: ManualSpec; packageName?: never; packagePath?: never };

export interface GameService {
  list(): { currentGameId: string; games: GameDescriptor[] };
  register(body: RegisterBody): { manifest: GameManifest };
  unregister(id: string): void;
  switchTo(id: string): void;
}

export function createHookServer(
  emitter: EventEmitter,
  port = DEFAULT_PORT,
  gameService?: GameService,
): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        const url = req.url;

        if (url === '/event') {
          try {
            const { event } = JSON.parse(body) as { event: HookEventName };
            emitter.emit('hook', event);
          } catch {
            // malformed — ignore
          }
          res.writeHead(200).end();
          return;
        }

        if (url === '/control') {
          try {
            const { action } = JSON.parse(body) as { action: ControlAction };
            if (action === 'enable' || action === 'disable') {
              emitter.emit('control', action);
              res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
              return;
            }
          } catch {
            // malformed
          }
          res.writeHead(400).end();
          return;
        }

        if (!gameService) {
          res.writeHead(404).end();
          return;
        }

        if (url === '/games/list') {
          try {
            const data = gameService.list();
            res
              .writeHead(200, { 'Content-Type': 'application/json' })
              .end(JSON.stringify(data));
          } catch (err) {
            res.writeHead(500).end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        if (url === '/games/register') {
          try {
            const parsed = JSON.parse(body) as RegisterBody;
            const result = gameService.register(parsed);
            res
              .writeHead(200, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ ok: true, manifest: result.manifest }));
          } catch (err) {
            const status = (err as { status?: number }).status ?? 400;
            res
              .writeHead(status, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
          }
          return;
        }

        if (url === '/games/unregister') {
          try {
            const { id } = JSON.parse(body) as { id: string };
            gameService.unregister(id);
            res
              .writeHead(200, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ ok: true }));
          } catch (err) {
            const status = (err as { status?: number }).status ?? 400;
            res
              .writeHead(status, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
          }
          return;
        }

        if (url === '/games/switch') {
          try {
            const { id } = JSON.parse(body) as { id: string };
            gameService.switchTo(id);
            res
              .writeHead(200, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ ok: true }));
          } catch (err) {
            const status = (err as { status?: number }).status ?? 400;
            res
              .writeHead(status, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
          }
          return;
        }

        res.writeHead(404).end();
      });
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}
