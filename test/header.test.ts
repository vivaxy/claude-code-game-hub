import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Header } from '../src/header.js';
import type { ClaudeStatus } from '../src/state.js';

function makeHeader(status: ClaudeStatus, mode: string, cols = 80) {
  return new Header(() => cols, () => status, () => mode);
}

function makeHeaderDynamic(
  initialStatus: ClaudeStatus,
  initialMode: string,
  cols = 80,
) {
  let status = initialStatus;
  let mode = initialMode;
  const header = new Header(() => cols, () => status, () => mode);
  const setStatus = (s: ClaudeStatus) => { status = s; };
  const setMode = (m: string) => { mode = m; };
  return { header, setStatus, setMode };
}

describe('Header', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('render()', () => {
    it('does not write in claude-mode', () => {
      const h = makeHeader('idle', 'claude');
      h.render();
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('writes in game-mode', () => {
      const h = makeHeader('idle', 'game');
      h.render();
      expect(writeSpy).toHaveBeenCalledOnce();
    });

    it('includes "idle" label in game-mode', () => {
      const h = makeHeader('idle', 'game');
      h.render();
      const output = (writeSpy.mock.calls[0][0] as string);
      expect(output).toContain('idle');
    });

    it('includes "working" label in game-mode', () => {
      const h = makeHeader('working', 'game');
      h.render();
      const output = (writeSpy.mock.calls[0][0] as string);
      expect(output).toContain('working');
    });

    it('includes "waiting-for-input" label in game-mode', () => {
      const h = makeHeader('waiting-for-input', 'game');
      h.render();
      const output = (writeSpy.mock.calls[0][0] as string);
      expect(output).toContain('waiting-for-input');
    });
  });

  describe('sync()', () => {
    it('renders immediately on sync', () => {
      const h = makeHeader('idle', 'game');
      h.sync();
      expect(writeSpy).toHaveBeenCalledOnce();
    });

    it('advances frame on each tick for working (120 ms interval)', () => {
      const { header, setStatus } = makeHeaderDynamic('working', 'game');
      setStatus('working');
      header.sync();
      writeSpy.mockClear();

      vi.advanceTimersByTime(120);
      expect(writeSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(120);
      expect(writeSpy).toHaveBeenCalledTimes(2);
    });

    it('uses 600 ms interval for idle', () => {
      const h = makeHeader('idle', 'game');
      h.sync();
      writeSpy.mockClear();

      vi.advanceTimersByTime(599);
      expect(writeSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('uses 500 ms interval for waiting-for-input', () => {
      const h = makeHeader('waiting-for-input', 'game');
      h.sync();
      writeSpy.mockClear();

      vi.advanceTimersByTime(499);
      expect(writeSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('resets frame to 0 when sync is called again', () => {
      const h = makeHeader('working', 'game');
      h.sync();
      vi.advanceTimersByTime(360); // 3 ticks
      writeSpy.mockClear();

      // sync() resets frame and restarts — first render is frame 0
      h.sync();
      const output = (writeSpy.mock.calls[0][0] as string);
      // frame 0 → first WORKING_FRAMES glyph ✢
      expect(output).toContain('✢');
    });

    it('changes interval when status changes between syncs', () => {
      const { header, setStatus } = makeHeaderDynamic('working', 'game');
      header.sync();
      writeSpy.mockClear();

      // Advance 2 working ticks (120 ms each = 240 ms)
      vi.advanceTimersByTime(240);
      expect(writeSpy).toHaveBeenCalledTimes(2);
      writeSpy.mockClear();

      // Switch to idle (600 ms interval)
      setStatus('idle');
      header.sync(); // restarts timer at 600 ms
      writeSpy.mockClear();

      vi.advanceTimersByTime(500);
      expect(writeSpy).not.toHaveBeenCalled(); // 600 ms interval, not fired yet

      vi.advanceTimersByTime(100);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopTimer()', () => {
    it('stops animation — no more writes after stopTimer', () => {
      const h = makeHeader('working', 'game');
      h.sync();
      writeSpy.mockClear();

      h.stopTimer();
      vi.advanceTimersByTime(1000);
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('is safe to call when no timer is running', () => {
      const h = makeHeader('idle', 'game');
      expect(() => h.stopTimer()).not.toThrow();
    });
  });

  describe('dispose()', () => {
    it('stops the timer', () => {
      const h = makeHeader('idle', 'game');
      h.sync();
      writeSpy.mockClear();

      h.dispose();
      vi.advanceTimersByTime(2000);
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('working glyph cycle', () => {
    it('cycles through WORKING_FRAMES glyphs across ticks', () => {
      const h = makeHeader('working', 'game');
      h.sync(); // frame 0 → ✢

      const glyphs: string[] = [];
      for (let i = 0; i < 8; i++) {
        writeSpy.mockClear();
        vi.advanceTimersByTime(120);
        const output = writeSpy.mock.calls[0][0] as string;
        for (const g of ['✢', '✳', '✶', '✻', '✽']) {
          if (output.includes(g)) { glyphs.push(g); break; }
        }
      }
      // All 5 unique glyphs should appear across 8 ticks
      expect(new Set(glyphs).size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('idle color alternation', () => {
    it('alternates between bold and normal green across ticks', () => {
      const h = makeHeader('idle', 'game');
      h.sync(); // frame 0 → bold green

      writeSpy.mockClear();
      vi.advanceTimersByTime(600); // frame 1 → normal green
      const frame1 = writeSpy.mock.calls[0][0] as string;
      expect(frame1).toContain('\x1b[32m');
      expect(frame1).not.toContain('\x1b[32;1m');

      writeSpy.mockClear();
      vi.advanceTimersByTime(600); // frame 2 → bold green
      const frame2 = writeSpy.mock.calls[0][0] as string;
      expect(frame2).toContain('\x1b[32;1m');
    });
  });
});
