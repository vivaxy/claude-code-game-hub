import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export const NODE_PMS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

export function getNodeModulesRoot(pm: string): string {
  switch (pm) {
    case 'npm':  return execSync('npm root -g', { encoding: 'utf8' }).trim();
    case 'pnpm': return execSync('pnpm root -g', { encoding: 'utf8' }).trim();
    case 'yarn': return path.join(execSync('yarn global dir', { encoding: 'utf8' }).trim(), 'node_modules');
    case 'bun': {
      const bin = execSync('bun pm bin -g', { encoding: 'utf8' }).trim();
      return path.join(path.dirname(bin), 'node_modules');
    }
    default: throw new Error(`${pm} is not a supported node package manager`);
  }
}

export function getInstallArgs(pm: string, spec: string): [string, string[]] {
  switch (pm) {
    case 'npm':   return ['npm',   ['install', '-g', spec]];
    case 'pnpm':  return ['pnpm',  ['add', '--global', spec]];
    case 'yarn':  return ['yarn',  ['global', 'add', spec]];
    case 'bun':   return ['bun',   ['add', '--global', spec]];
    case 'brew':  return ['brew',  ['install', spec]];
    case 'cargo': return ['cargo', ['install', spec]];
    case 'pip':   return ['pip',   ['install', spec]];
    case 'pip3':  return ['pip3',  ['install', spec]];
    default:      return [pm,      ['install', spec]];
  }
}

export function getUninstallArgs(pm: string, pkg: string): [string, string[]] {
  switch (pm) {
    case 'npm':   return ['npm',   ['uninstall', '-g', pkg]];
    case 'pnpm':  return ['pnpm',  ['remove', '--global', pkg]];
    case 'yarn':  return ['yarn',  ['global', 'remove', pkg]];
    case 'bun':   return ['bun',   ['remove', '--global', pkg]];
    case 'brew':  return ['brew',  ['uninstall', pkg]];
    case 'cargo': return ['cargo', ['uninstall', pkg]];
    case 'pip':   return ['pip',   ['uninstall', '-y', pkg]];
    case 'pip3':  return ['pip3',  ['uninstall', '-y', pkg]];
    default:      return [pm,      ['uninstall', pkg]];
  }
}

export function scanNodeModules(moduleRoot: string): Map<string, string> {
  const result = new Map<string, string>();
  let entries: string[];
  try { entries = fs.readdirSync(moduleRoot); }
  catch { return result; }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const entryPath = path.join(moduleRoot, entry);
    if (entry.startsWith('@')) {
      try {
        for (const sub of fs.readdirSync(entryPath)) {
          result.set(`${entry}/${sub}`, path.join(entryPath, sub));
        }
      } catch { /* non-directory or unreadable scope dir */ }
    } else {
      result.set(entry, entryPath);
    }
  }
  return result;
}
