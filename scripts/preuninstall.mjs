import { execFileSync } from 'node:child_process';

try {
  execFileSync('claude', ['--version'], { stdio: 'ignore' });
} catch {
  process.exit(0);
}

try {
  execFileSync('claude', ['plugin', 'uninstall', 'game-hub@claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
} catch {
  // not installed — fine
}

try {
  execFileSync('claude', ['plugin', 'marketplace', 'remove', 'claude-code-game-hub', '--scope', 'user'], { stdio: 'inherit' });
} catch {
  // marketplace not registered — fine
}
