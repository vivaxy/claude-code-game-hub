import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIG_DIR = path.join(os.homedir(), '.claude-code-game-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'game-hub.json');

export type Config = { enabled: boolean };

export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'enabled' in parsed) {
      return { enabled: Boolean((parsed as Record<string, unknown>)['enabled']) };
    }
  } catch {
    // missing or malformed — fall through to default
  }
  return { enabled: true };
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
