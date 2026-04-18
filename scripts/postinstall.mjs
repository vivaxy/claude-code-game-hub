import { chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'node_modules', 'node-pty', 'prebuilds');

for (const sub of ['darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64']) {
  const p = join(root, sub, 'spawn-helper');
  if (existsSync(p)) chmodSync(p, 0o755);
}

if (process.env.npm_config_global !== 'true') {
  console.log('game-hub: skipping plugin registration (non-global install)');
  process.exit(0);
}

try {
  execFileSync('claude', ['--version'], { stdio: 'ignore' });
} catch {
  console.error(
    'game-hub: claude CLI not found; plugin registration failed.\n' +
    '  Ensure `claude` is on PATH, then run:\n' +
    '    claude plugin marketplace add vivaxy/claude-code-game-hub\n' +
    '    claude plugin install game-hub@claude-code-game-hub'
  );
  process.exit(1);
}

try {
  execFileSync('claude', ['plugin', 'marketplace', 'add', 'vivaxy/claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
} catch {
  // already registered or network error — non-fatal
}

try {
  execFileSync('claude', ['plugin', 'install', 'game-hub@claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
  console.log('game-hub: Claude plugin registered successfully.');
} catch {
  console.log(
    'game-hub: plugin registration failed (already installed, or check `claude plugin list`).'
  );
}
