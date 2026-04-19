import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { Snake } from './snake.js';
import { SubprocessGame } from './subprocess.js';
import type { Game } from './index.js';
import type { InstalledGame, GameManifest } from '../config.js';

let cachedNpmRoot: string | null = null;

function getNpmRoot(): string {
  if (cachedNpmRoot !== null) return cachedNpmRoot;
  try {
    cachedNpmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  } catch {
    cachedNpmRoot = '';
  }
  return cachedNpmRoot;
}

export function readPluginManifest(
  packageName: string,
  packagePath?: string,
): { manifest: GameManifest; resolvedPath: string } {
  const pkgDir = packagePath ?? path.join(getNpmRoot(), packageName);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  let pkgJson: Record<string, unknown>;
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Cannot read package.json at ${pkgJsonPath}. Is "${packageName}" installed globally?`,
    );
  }
  const manifest = pkgJson['game-hub'] as GameManifest | undefined;
  if (!manifest || typeof manifest.id !== 'string' || typeof manifest.type !== 'string') {
    throw new Error(
      `"${packageName}" is missing a valid "game-hub" field in package.json. ` +
        `This npm package is not a game-hub plugin.`,
    );
  }
  return { manifest, resolvedPath: pkgDir };
}

export function listAllGames(
  installed: InstalledGame[],
): { id: string; name: string; description?: string; builtin: boolean }[] {
  return [
    { id: 'snake', name: 'Snake', description: 'Built-in snake game', builtin: true },
    ...installed.map((g) => ({
      id: g.manifest.id,
      name: g.manifest.name,
      description: g.manifest.description,
      builtin: false,
    })),
  ];
}

export function instantiateGame(
  id: string,
  installed: InstalledGame[],
  termSize: { cols: number; rows: number },
  onExit: () => void,
): Game {
  if (id === 'snake') return new Snake();

  const entry = installed.find((g) => g.id === id);
  if (!entry) {
    throw new Error(`Unknown game id: "${id}". Run /game-hub:list to see installed games.`);
  }

  const m = entry.manifest;
  if (m.type === 'subprocess') {
    return new SubprocessGame({
      command: m.command,
      args: m.args,
      env: m.env,
      cols: termSize.cols,
      rows: termSize.rows,
      onExit,
    });
  }

  throw new Error(
    `Game type "${m.type}" is not yet supported. Only "subprocess" games work in this version.`,
  );
}
