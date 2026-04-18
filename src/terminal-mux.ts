import type { IPty } from 'node-pty';
import { StateMachine } from './state.js';
import type { Game } from './games/index.js';

const CLEAR = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

export class TerminalMux {
  private outputBuffer: string[] = [];

  constructor(
    private pty: IPty,
    private state: StateMachine,
    private game: Game,
  ) {}

  start(): void {
    // Forward PTY output to stdout (or buffer it in game-mode).
    this.pty.onData((data) => {
      if (this.state.mode === 'claude') {
        process.stdout.write(data);
      } else {
        this.outputBuffer.push(data);
      }
    });

    // Route stdin to either PTY or game.
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (chunk: Buffer) => {
      if (this.state.isStdinDraining()) return;

      if (this.state.mode === 'claude') {
        this.pty.write(chunk.toString());
      } else {
        const key = chunk.toString();
        if (key === 'q' || key === 'Q') {
          this.state.transitionTo('claude');
        } else {
          this.game.handleInput(key);
        }
      }
    });

    // Forward terminal resize to PTY (and game if in game-mode).
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;
      this.pty.resize(cols, rows);
      if (this.state.mode === 'game') {
        this.game.resize(cols, rows);
      }
    });

    // Wire state transitions.
    this.state.on('transition', (mode: string) => {
      if (mode === 'game') {
        this.enterGameMode();
      } else {
        this.enterClaudeMode();
      }
    });
  }

  private enterGameMode(): void {
    process.stdout.write(HIDE_CURSOR + CLEAR);
    this.outputBuffer = [];
    this.game.resume();
  }

  private enterClaudeMode(): void {
    this.game.pause();
    // Clear game frame, restore cursor, force Claude to redraw.
    process.stdout.write(SHOW_CURSOR + CLEAR);
    // Flush any buffered Claude output so it has content to work with.
    if (this.outputBuffer.length > 0) {
      process.stdout.write(this.outputBuffer.join(''));
      this.outputBuffer = [];
    }
    // Trigger a full redraw by sending a no-op resize.
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    this.pty.resize(cols + 1, rows);
    this.pty.resize(cols, rows);
  }

  restoreTerminal(): void {
    try {
      process.stdout.write(SHOW_CURSOR);
      process.stdin.setRawMode(false);
    } catch {
      // best-effort cleanup
    }
  }
}
