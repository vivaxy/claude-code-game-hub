import * as http from 'node:http';
import { EventEmitter } from 'node:events';

export type HookEventName = 'prompt_submit' | 'stop' | 'notification' | 'subagent_stop';

export const DEFAULT_PORT = 41731;

export function createHookServer(emitter: EventEmitter, port = DEFAULT_PORT): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/event') {
        res.writeHead(404).end();
        return;
      }
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { event } = JSON.parse(body) as { event: HookEventName };
          emitter.emit('hook', event);
        } catch {
          // malformed — ignore
        }
        res.writeHead(200).end();
      });
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}
