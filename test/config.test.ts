import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpHome = '';

// importOriginal preserves the real os module; we only override homedir.
vi.mock('node:os', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:os')>();
  return { ...real, default: real, homedir: () => tmpHome };
});

describe('config', () => {
  beforeEach(() => {
    // Reset the module cache so config.ts re-evaluates CONFIG_DIR with the
    // updated tmpHome on the next dynamic import.
    vi.resetModules();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function freshConfig() {
    return import('../src/config.js');
  }

  const configPath = () =>
    path.join(tmpHome, '.claude-code-game-hub', 'game-hub.json');

  const writeRaw = (data: unknown) => {
    const dir = path.join(tmpHome, '.claude-code-game-hub');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(data), 'utf8');
  };

  const writeBytes = (raw: string) => {
    const dir = path.join(tmpHome, '.claude-code-game-hub');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath(), raw, 'utf8');
  };

  describe('loadConfig', () => {
    it('returns defaults when file is missing', async () => {
      const { loadConfig } = await freshConfig();
      expect(loadConfig()).toEqual({ enabled: true, currentGameId: 'snake', installed: [] });
    });

    it('returns defaults when file is malformed JSON', async () => {
      writeBytes('not json {{{');
      const { loadConfig } = await freshConfig();
      expect(loadConfig()).toEqual({ enabled: true, currentGameId: 'snake', installed: [] });
    });

    it('returns defaults when file is a JSON non-object (string)', async () => {
      writeRaw('hello');
      const { loadConfig } = await freshConfig();
      expect(loadConfig()).toEqual({ enabled: true, currentGameId: 'snake', installed: [] });
    });

    it('returns defaults when file is a JSON non-object (number)', async () => {
      writeRaw(42);
      const { loadConfig } = await freshConfig();
      expect(loadConfig()).toEqual({ enabled: true, currentGameId: 'snake', installed: [] });
    });

    it('defaults enabled to true when the field is absent', async () => {
      writeRaw({ currentGameId: 'snake' });
      const { loadConfig } = await freshConfig();
      expect(loadConfig().enabled).toBe(true);
    });

    it('preserves enabled: false when set', async () => {
      writeRaw({ enabled: false, currentGameId: 'snake', installed: [] });
      const { loadConfig } = await freshConfig();
      expect(loadConfig().enabled).toBe(false);
    });

    it('preserves a valid currentGameId that is in installed', async () => {
      const installed = [
        { id: 'mygame', manifest: { id: 'mygame', name: 'My Game', type: 'subprocess', command: 'mygame' } },
      ];
      writeRaw({ enabled: true, currentGameId: 'mygame', installed });
      const { loadConfig } = await freshConfig();
      const cfg = loadConfig();
      expect(cfg.currentGameId).toBe('mygame');
    });

    it('falls back to snake and writes a stderr warning when currentGameId is not installed', async () => {
      writeRaw({ enabled: true, currentGameId: 'ghost-game', installed: [] });
      const { loadConfig } = await freshConfig();
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const cfg = loadConfig();
        expect(cfg.currentGameId).toBe('snake');
        expect(stderrSpy).toHaveBeenCalledOnce();
        expect(String(stderrSpy.mock.calls[0]![0])).toContain('ghost-game');
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it('coerces a non-array installed field to []', async () => {
      writeRaw({ enabled: true, currentGameId: 'snake', installed: 'oops' });
      const { loadConfig } = await freshConfig();
      expect(loadConfig().installed).toEqual([]);
    });
  });

  describe('saveConfig + loadConfig round-trip', () => {
    it('creates the directory and round-trips the config', async () => {
      const { loadConfig, saveConfig } = await freshConfig();
      const cfg = {
        enabled: false,
        currentGameId: 'snake',
        installed: [
          {
            id: 'tetris',
            manifest: { id: 'tetris', name: 'Tetris', type: 'subprocess' as const, command: 'tetris' },
          },
        ],
      };
      saveConfig(cfg);
      expect(fs.existsSync(configPath())).toBe(true);

      vi.resetModules();
      const { loadConfig: loadConfig2 } = await freshConfig();
      expect(loadConfig2()).toEqual(cfg);
    });
  });
});
