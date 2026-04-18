import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export function warnIfPluginMissing(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let enabled: Record<string, boolean> = {};
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    enabled = (raw['enabledPlugins'] as Record<string, boolean>) ?? {};
  } catch {
    // missing or unreadable settings — fall through to warn
  }

  if (!Object.keys(enabled).some((k) => k.startsWith('game-hub@'))) {
    process.stderr.write(
      '\x1b[33m[game-hub] Plugin not installed — hooks will not fire.\x1b[0m\n' +
      '\x1b[33m  Install with:\x1b[0m\n' +
      '\x1b[33m    /plugin marketplace add vivaxy/claude-code-game-hub\x1b[0m\n' +
      '\x1b[33m    /plugin install game-hub@claude-code-game-hub\x1b[0m\n',
    );
  }
}
