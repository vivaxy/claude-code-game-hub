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

function isMarketplaceRegistered() {
  try {
    const out = execFileSync('claude', ['plugin', 'marketplace', 'list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /^\s*❯\s+claude-code-game-hub\s*$/m.test(out);
  } catch {
    return false;
  }
}

function isPluginInstalled() {
  try {
    const out = execFileSync('claude', ['plugin', 'list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /^\s*❯\s+game-hub@claude-code-game-hub\s*$/m.test(out);
  } catch {
    return false;
  }
}

const marketplaceOk = isMarketplaceRegistered();
const pluginOk = isPluginInstalled();

if (marketplaceOk && pluginOk) {
  console.log('game-hub: Claude plugin already registered, skipping.');
  process.exit(0);
}

if (!marketplaceOk) {
  try {
    execFileSync('claude', ['plugin', 'marketplace', 'add', 'vivaxy/claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
  } catch {
    console.error(
      'game-hub: marketplace registration failed.\n' +
      '  Retry manually: claude plugin marketplace add vivaxy/claude-code-game-hub'
    );
    process.exit(1);
  }
}

if (!pluginOk) {
  try {
    execFileSync('claude', ['plugin', 'install', 'game-hub@claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
  } catch {
    console.error(
      'game-hub: plugin install failed.\n' +
      '  Retry manually: claude plugin install game-hub@claude-code-game-hub'
    );
    process.exit(1);
  }
}

console.log('game-hub: Claude plugin registered successfully.');
