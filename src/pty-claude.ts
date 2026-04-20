import * as pty from 'node-pty';

export function spawnClaude(extraArgs: string[] = []): pty.IPty {
  return pty.spawn('claude', extraArgs, {
    name: process.env['TERM'] ?? 'xterm-256color',
    cols: process.stdout.columns || 80,
    rows: (process.stdout.rows || 24) - 1,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });
}
