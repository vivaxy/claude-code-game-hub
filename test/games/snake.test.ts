import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Snake } from '../../src/games/snake.js';

const KEY_UP    = '\x1b[A';
const KEY_DOWN  = '\x1b[B';
const KEY_RIGHT = '\x1b[C';
const KEY_LEFT  = '\x1b[D';

function capturedOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => String(c[0])).join('');
}

describe('Snake', () => {
  let snake: Snake;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Silence stdout writes; return value must be boolean (write() contract).
    writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    // Deterministic food placement: Math.random() -> 0 -> food at [0, 0].
    vi.spyOn(Math, 'random').mockReturnValue(0);
    snake = new Snake();
  });

  afterEach(() => {
    snake.pause(); // clean up any running interval
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('resume / pause', () => {
    it('resume renders immediately', () => {
      snake.resume();
      expect(writeSpy).toHaveBeenCalled();
    });

    it('pause stops the tick loop', () => {
      snake.resume();
      snake.pause();
      const callsAfterPause = writeSpy.mock.calls.length;
      vi.advanceTimersByTime(480); // 4 potential ticks
      expect(writeSpy.mock.calls.length).toBe(callsAfterPause);
    });

    it('p key toggles pause', () => {
      snake.resume();
      snake.pause();
      const before = writeSpy.mock.calls.length;
      snake.handleInput('p'); // re-resume via handleInput
      expect(writeSpy.mock.calls.length).toBeGreaterThan(before);
    });
  });

  describe('direction reversal guard', () => {
    beforeEach(() => snake.resume());

    it('ignores KEY_LEFT when heading right', () => {
      // Default dir is right; pressing left is the reverse — must be ignored.
      snake.handleInput(KEY_LEFT);
      vi.advanceTimersByTime(120);
      // Snake should still move right: head [10,8] → [11,8], no death.
      const output = capturedOutput(writeSpy);
      expect(output).not.toContain('GAME OVER');
    });

    it('ignores KEY_DOWN when heading up', () => {
      snake.handleInput(KEY_UP); // nextDir = 'up'
      vi.advanceTimersByTime(120); // dir becomes 'up'
      snake.handleInput(KEY_DOWN); // must be ignored
      vi.advanceTimersByTime(120);
      expect(capturedOutput(writeSpy)).not.toContain('GAME OVER');
    });

    it('accepts a perpendicular turn', () => {
      snake.handleInput(KEY_UP);
      vi.advanceTimersByTime(120);
      expect(capturedOutput(writeSpy)).not.toContain('GAME OVER');
    });
  });

  describe('wall collision', () => {
    it('marks game dead and renders GAME OVER after hitting the right wall', () => {
      // Head starts at [10,8], food at [15,8].  Moving right 10 ticks
      // eats food at tick 5 (snake grows), then hits wall at tick 10.
      // Math.random=0 places new food at [0,0] — out of the path.
      snake.resume();
      vi.advanceTimersByTime(1200); // 10 ticks
      expect(capturedOutput(writeSpy)).toContain('GAME OVER');
    });

    it('renders GAME OVER after hitting the top wall', () => {
      snake.resume();
      snake.handleInput(KEY_UP);
      vi.advanceTimersByTime(120 * 9); // 9 ticks up: row 8 → row -1
      expect(capturedOutput(writeSpy)).toContain('GAME OVER');
    });
  });

  describe('food growth', () => {
    it('score increments and snake grows when eating food', () => {
      // Food starts at [15,8]. Heading right from [10,8] → 5 ticks to eat.
      snake.resume();
      vi.advanceTimersByTime(600); // 5 ticks
      // After eating, score=1. Render output should show 'score: 1'.
      const output = capturedOutput(writeSpy);
      expect(output).toContain('score: 1');
    });
  });

  describe('self-collision', () => {
    it('marks game dead when snake collides with itself', () => {
      // Grow to length 4 by eating food at [15,8] in 5 ticks.
      // Then engineer a U-turn: down → left → up to hit own body.
      snake.resume();
      vi.advanceTimersByTime(600); // eat food; snake=[[15,8],[14,8],[13,8],[12,8]]

      snake.handleInput(KEY_DOWN);
      vi.advanceTimersByTime(120); // → [[15,9],[15,8],[14,8],[13,8]]

      snake.handleInput(KEY_LEFT);
      vi.advanceTimersByTime(120); // → [[14,9],[15,9],[15,8],[14,8]]

      snake.handleInput(KEY_UP);
      vi.advanceTimersByTime(120); // head tries [14,8] — body contains [14,8] → dead

      expect(capturedOutput(writeSpy)).toContain('GAME OVER');
    });
  });

  describe('death → restart confirm flow', () => {
    function killSnake() {
      snake.resume();
      vi.advanceTimersByTime(1200); // walk into right wall
    }

    it('pressing r after death shows confirm prompt', () => {
      killSnake();
      writeSpy.mockClear();
      snake.handleInput('r');
      expect(capturedOutput(writeSpy)).toMatch(/Restart\?|y\/n/i);
    });

    it('pressing y confirms restart: score resets, game runs again', () => {
      killSnake();
      snake.handleInput('r');
      writeSpy.mockClear();
      snake.handleInput('y');
      // render() is called immediately on confirm; advancing timer produces more ticks.
      const callsAfterY = writeSpy.mock.calls.length;
      vi.advanceTimersByTime(120);
      expect(writeSpy.mock.calls.length).toBeGreaterThan(callsAfterY);
      expect(capturedOutput(writeSpy)).toContain('score: 0');
    });

    it('pressing n cancels restart and shows dead screen again', () => {
      killSnake();
      snake.handleInput('r');
      writeSpy.mockClear();
      snake.handleInput('n');
      expect(capturedOutput(writeSpy)).toContain('GAME OVER');
      // Interval should NOT be running — advancing time makes no new writes.
      const callsAfterN = writeSpy.mock.calls.length;
      vi.advanceTimersByTime(360);
      expect(writeSpy.mock.calls.length).toBe(callsAfterN);
    });

    it('Y (uppercase) also confirms restart', () => {
      killSnake();
      snake.handleInput('r');
      writeSpy.mockClear();
      snake.handleInput('Y');
      expect(capturedOutput(writeSpy)).toContain('score: 0');
    });

    it('renders GAME OVER overlay below the grid bottom border', () => {
      // Compute offRow the same way Snake does (rows defaults to 24 when not a TTY).
      const termRows = process.stdout.rows || 24;
      const GRID_H_VAL = 16;
      const offRow = 1 + Math.max(0, Math.floor((termRows - GRID_H_VAL - 4) / 2));
      // Bottom border sits at 0-indexed row (offRow + 3 + GRID_H_VAL).
      // In ANSI escapes rows are 1-indexed, so the border is at 1-idx = offRow + 4 + GRID_H_VAL.
      // The overlay must start strictly below: 1-idx >= offRow + 5 + GRID_H_VAL.
      const bottomBorder1Idx = offRow + 4 + GRID_H_VAL;

      killSnake();
      const output = capturedOutput(writeSpy);

      // The at() escape immediately before \x1b[2K and the ANSI-colored 'GAME OVER' text
      // has the form \x1b[<row>;<col>H\x1b[2K<ansi-codes>GAME OVER.
      const m = /\x1b\[(\d+);\d+H\x1b\[2K(?:\x1b\[[\d;]*m)+GAME OVER/.exec(output);
      expect(m).not.toBeNull();
      const overlayRow1Idx = parseInt(m![1], 10);
      expect(overlayRow1Idx).toBeGreaterThan(bottomBorder1Idx);
    });
  });

  describe('best score', () => {
    it('best score is preserved and shown after restart', () => {
      // Eat food (score→1), die, restart, verify best=1 in render.
      snake.resume();
      vi.advanceTimersByTime(600); // score = 1 after eating food at [15,8]
      vi.advanceTimersByTime(600); // continue right to hit wall (5 more ticks)

      snake.handleInput('r');
      snake.handleInput('y'); // restart

      writeSpy.mockClear();
      vi.advanceTimersByTime(120); // trigger one render tick
      expect(capturedOutput(writeSpy)).toContain('best: 1');
    });
  });
});
