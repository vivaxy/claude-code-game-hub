import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  NODE_PMS,
  getInstallArgs,
  getUninstallArgs,
  scanNodeModules,
} from '../src/package-managers.js';

describe('NODE_PMS', () => {
  it('includes node package managers', () => {
    expect(NODE_PMS.has('npm')).toBe(true);
    expect(NODE_PMS.has('pnpm')).toBe(true);
    expect(NODE_PMS.has('yarn')).toBe(true);
    expect(NODE_PMS.has('bun')).toBe(true);
  });

  it('excludes non-node package managers', () => {
    expect(NODE_PMS.has('brew')).toBe(false);
    expect(NODE_PMS.has('cargo')).toBe(false);
    expect(NODE_PMS.has('pip')).toBe(false);
    expect(NODE_PMS.has('pip3')).toBe(false);
    expect(NODE_PMS.has('other')).toBe(false);
  });
});

describe('getInstallArgs', () => {
  const cases: [string, string, string[]][] = [
    ['npm',   'my-pkg', ['install', '-g', 'my-pkg']],
    ['pnpm',  'my-pkg', ['add', '--global', 'my-pkg']],
    ['yarn',  'my-pkg', ['global', 'add', 'my-pkg']],
    ['bun',   'my-pkg', ['add', '--global', 'my-pkg']],
    ['brew',  'my-pkg', ['install', 'my-pkg']],
    ['cargo', 'my-pkg', ['install', 'my-pkg']],
    ['pip',   'my-pkg', ['install', 'my-pkg']],
    ['pip3',  'my-pkg', ['install', 'my-pkg']],
  ];

  for (const [pm, spec, expectedArgs] of cases) {
    it(`${pm}: produces correct [cmd, args]`, () => {
      const [cmd, args] = getInstallArgs(pm, spec);
      expect(cmd).toBe(pm);
      expect(args).toEqual(expectedArgs);
    });
  }

  it('default: falls through to [pm, ["install", spec]]', () => {
    const [cmd, args] = getInstallArgs('custompm', 'mypkg');
    expect(cmd).toBe('custompm');
    expect(args).toEqual(['install', 'mypkg']);
  });
});

describe('getUninstallArgs', () => {
  const cases: [string, string, string[]][] = [
    ['npm',   'my-pkg', ['uninstall', '-g', 'my-pkg']],
    ['pnpm',  'my-pkg', ['remove', '--global', 'my-pkg']],
    ['yarn',  'my-pkg', ['global', 'remove', 'my-pkg']],
    ['bun',   'my-pkg', ['remove', '--global', 'my-pkg']],
    ['brew',  'my-pkg', ['uninstall', 'my-pkg']],
    ['cargo', 'my-pkg', ['uninstall', 'my-pkg']],
    ['pip',   'my-pkg', ['uninstall', '-y', 'my-pkg']],
    ['pip3',  'my-pkg', ['uninstall', '-y', 'my-pkg']],
  ];

  for (const [pm, pkg, expectedArgs] of cases) {
    it(`${pm}: produces correct [cmd, args]`, () => {
      const [cmd, args] = getUninstallArgs(pm, pkg);
      expect(cmd).toBe(pm);
      expect(args).toEqual(expectedArgs);
    });
  }

  it('pip and pip3 include -y flag', () => {
    expect(getUninstallArgs('pip', 'x')[1]).toContain('-y');
    expect(getUninstallArgs('pip3', 'x')[1]).toContain('-y');
  });

  it('default: falls through to [pm, ["uninstall", pkg]]', () => {
    const [cmd, args] = getUninstallArgs('custompm', 'mypkg');
    expect(cmd).toBe('custompm');
    expect(args).toEqual(['uninstall', 'mypkg']);
  });
});

describe('scanNodeModules', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-'));

    // plain package
    fs.mkdirSync(path.join(tmpDir, 'lodash'));

    // scoped package
    fs.mkdirSync(path.join(tmpDir, '@scope'));
    fs.mkdirSync(path.join(tmpDir, '@scope', 'utils'));
    fs.mkdirSync(path.join(tmpDir, '@scope', 'core'));

    // another scope with two packages
    fs.mkdirSync(path.join(tmpDir, '@another'));
    fs.mkdirSync(path.join(tmpDir, '@another', 'pkg'));

    // dotfiles that must be skipped
    fs.mkdirSync(path.join(tmpDir, '.bin'));
    fs.writeFileSync(path.join(tmpDir, '.modules.yaml'), '');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty Map for a missing directory', () => {
    const result = scanNodeModules('/nonexistent/path/that/does/not/exist');
    expect(result.size).toBe(0);
  });

  it('maps plain packages to their full path', () => {
    const result = scanNodeModules(tmpDir);
    expect(result.get('lodash')).toBe(path.join(tmpDir, 'lodash'));
  });

  it('recursively maps scoped packages', () => {
    const result = scanNodeModules(tmpDir);
    expect(result.get('@scope/utils')).toBe(path.join(tmpDir, '@scope', 'utils'));
    expect(result.get('@scope/core')).toBe(path.join(tmpDir, '@scope', 'core'));
    expect(result.get('@another/pkg')).toBe(path.join(tmpDir, '@another', 'pkg'));
  });

  it('skips dotfiles and dot-directories', () => {
    const result = scanNodeModules(tmpDir);
    for (const key of result.keys()) {
      expect(key.startsWith('.')).toBe(false);
    }
    expect(result.has('.bin')).toBe(false);
    expect(result.has('.modules.yaml')).toBe(false);
  });

  it('does not include the @ scope directory itself as a key', () => {
    const result = scanNodeModules(tmpDir);
    expect(result.has('@scope')).toBe(false);
    expect(result.has('@another')).toBe(false);
  });

  it('silently skips unreadable scope entries', () => {
    const emptyScope = path.join(tmpDir, '@empty');
    fs.mkdirSync(emptyScope);
    const result = scanNodeModules(tmpDir);
    expect(result.has('@empty')).toBe(false);
  });
});
