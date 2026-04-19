import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIG_DIR = path.join(os.homedir(), '.claude-code-game-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'game-hub.json');

export type GameManifest = {
  id: string;
  name: string;
  description?: string;
} & (
  | { type: 'subprocess'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'js'; entry: string }
);

export type InstalledGame = {
  id: string;
  manifest: GameManifest;
  npmPackage?: string;
  packagePath?: string;
};

export type Config = {
  enabled: boolean;
  currentGameId: string;
  installed: InstalledGame[];
};

export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as Record<string, unknown>;
      const enabled = 'enabled' in p ? Boolean(p['enabled']) : true;
      const installed = Array.isArray(p['installed']) ? (p['installed'] as InstalledGame[]) : [];
      let currentGameId = typeof p['currentGameId'] === 'string' ? p['currentGameId'] : 'snake';
      // Fall back to snake if the saved currentGameId is no longer installed.
      if (currentGameId !== 'snake' && !installed.find((g) => g.id === currentGameId)) {
        process.stderr.write(`[game-hub] game "${currentGameId}" not found; falling back to snake\n`);
        currentGameId = 'snake';
      }
      return { enabled, currentGameId, installed };
    }
  } catch {
    // missing or malformed — fall through to default
  }
  return { enabled: true, currentGameId: 'snake', installed: [] };
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
