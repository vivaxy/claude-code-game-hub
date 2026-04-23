import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalMux } from '../src/terminal-mux.js';
import { StateMachine } from '../src/state.js';
import type { IPty } from 'node-pty';
import type { Game } from '../src/games/index.js';

function makePty() {
  return {
    writes: [] as string[],
    resizes: [] as Array<[number, number]>,
    _onData: (_: string) => {},
    onData(cb: (data: string) => void) { this._onData = cb; },
    write(s: string) { this.writes.push(s); },
    resize(cols: number, rows: number) { this.resizes.push([cols, rows]); },
  };
}

function makeGame() {
  return {
    resumeCount: 0,
    pauseCount: 0,
    inputs: [] as string[],
    resume() { this.resumeCount++; },
    pause() { this.pauseCount++; },
    handleInput(key: string) { this.inputs.push(key); },
    resize(_cols: number, _rows: number) {},
    dispose() {},
  };
}

describe('TerminalMux', () => {
  let state: StateMachine;
  let pty: ReturnType<typeof makePty>;
  let game: ReturnType<typeof makeGame>;
  let mux: TerminalMux;

  function emitStdin(chunk: Buffer) {
    process.stdin.emit('data', chunk);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    // setRawMode only exists on TTY streams; add a stub so start() doesn't throw in test env
    const stdinAny = process.stdin as NodeJS.ReadStream & { setRawMode?: () => NodeJS.ReadStream };
    if (!stdinAny.setRawMode) {
      stdinAny.setRawMode = () => process.stdin as NodeJS.ReadStream;
    }
    vi.spyOn(process.stdin, 'setRawMode').mockReturnValue(process.stdin);

    state = new StateMachine();
    pty = makePty();
    game = makeGame();
    mux = new TerminalMux(pty as unknown as IPty, state, game as unknown as Game);
    mux.start();
  });

  afterEach(() => {
    mux.restoreTerminal();
    process.stdin.removeAllListeners('data');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Ctrl+G from claude-mode enters game-mode and resumes the game', () => {
    expect(state.mode).toBe('claude');
    emitStdin(Buffer.from([0x07]));
    expect(state.mode).toBe('game');
    expect(game.resumeCount).toBe(1);
  });

  it('Ctrl+G from game-mode returns to claude-mode and pauses the game', () => {
    state.transitionTo('game');            // enter game-mode (drain window starts)
    vi.advanceTimersByTime(100);           // exhaust the 80 ms drain window
    emitStdin(Buffer.from([0x07]));
    expect(state.mode).toBe('claude');
    expect(game.pauseCount).toBeGreaterThan(0);
  });

  it('modifyOtherKeys encoding of Ctrl+G from claude-mode enters game-mode', () => {
    expect(state.mode).toBe('claude');
    emitStdin(Buffer.from('1b5b32373b353b3130337e', 'hex'));
    expect(state.mode).toBe('game');
    expect(game.resumeCount).toBe(1);
  });

  it('modifyOtherKeys encoding of Ctrl+G from game-mode returns to claude-mode', () => {
    state.transitionTo('game');
    vi.advanceTimersByTime(100);
    emitStdin(Buffer.from('1b5b32373b353b3130337e', 'hex'));
    expect(state.mode).toBe('claude');
    expect(game.pauseCount).toBeGreaterThan(0);
  });

  it('multi-byte chunk containing 0x07 does not toggle mode', () => {
    expect(state.mode).toBe('claude');
    emitStdin(Buffer.from([0x41, 0x07, 0x42])); // 'A' BEL 'B' — single-byte guard must block this
    expect(state.mode).toBe('claude');
  });

  it('keystrokes in claude-mode are forwarded to the PTY', () => {
    expect(state.mode).toBe('claude');
    emitStdin(Buffer.from('a'));
    expect(pty.writes).toContain('a');
    expect(game.inputs).toHaveLength(0);
  });

  it('keystrokes in game-mode are forwarded to game.handleInput, not the PTY', () => {
    state.transitionTo('game');
    vi.advanceTimersByTime(100); // exhaust drain window
    emitStdin(Buffer.from('a'));
    expect(game.inputs).toContain('a');
    expect(pty.writes).toHaveLength(0);
  });

  it('stdin drain window discards all keystrokes immediately after a mode switch', () => {
    emitStdin(Buffer.from([0x07])); // switch to game-mode — drain window starts
    // do NOT advance timers; still inside the 80 ms window
    emitStdin(Buffer.from('x'));    // must be discarded
    expect(game.inputs).toHaveLength(0);
    expect(pty.writes).toHaveLength(0);
  });
});
