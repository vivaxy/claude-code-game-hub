import type { IPty } from 'node-pty';
import { StateMachine } from './state.js';
import type { Game } from './games/index.js';
import { Header } from './header.js';

const CLEAR = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const setMargins = (rows: number): string => `\x1b[2;${rows}r`;
const RESET_MARGINS = '\x1b[r';

export class TerminalMux {
  private outputBuffer: string[] = [];
  private header: Header;

  constructor(
    private pty: IPty,
    private state: StateMachine,
    private game: Game,
  ) {
    this.header = new Header(
      () => process.stdout.columns || 80,
      () => this.state.status,
      () => this.state.mode,
    );
  }

  setGame(newGame: Game): void {
    if (this.state.mode === 'game') {
      // transitionTo emits synchronously → enterClaudeMode() → this.game.pause()
      // so old game is paused before we swap the reference.
      this.state.transitionTo('claude');
    }
    const old = this.game;
    this.game = newGame;
    try { old.dispose?.(); } catch { /* best-effort */ }
  }

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

      // Ctrl+G (BEL, 0x07) toggles between claude-mode and game-mode in both directions.
      // Single-byte guard prevents pasted content containing 0x07 from misfiring.
      if (chunk.length === 1 && chunk[0] === 0x07) {
        this.state.transitionTo(this.state.mode === 'claude' ? 'game' : 'claude');
        return;
      }

      if (this.state.mode === 'claude') {
        this.pty.write(chunk.toString());
      } else {
        this.game.handleInput(chunk.toString());
      }
    });

    // Forward terminal resize to PTY (and game if in game-mode).
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;
      if (this.state.mode === 'game') {
        this.pty.resize(cols, rows - 1);
        process.stdout.write(setMargins(rows));
        this.game.resize(cols, rows - 1);
      } else {
        this.pty.resize(cols, rows);
      }
      this.updateHeader();
    });

    // Wire state transitions.
    this.state.on('transition', (mode: string) => {
      if (mode === 'game') {
        this.enterGameMode();
      } else {
        this.enterClaudeMode();
      }
    });

    this.state.on('status', () => this.updateHeader());
  }

  private enterGameMode(): void {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    this.pty.resize(cols, rows - 1);
    process.stdout.write(HIDE_CURSOR + CLEAR + setMargins(rows));
    this.outputBuffer = [];
    this.game.resize(cols, rows - 1);
    this.game.resume();
    this.updateHeader();
  }

  private enterClaudeMode(): void {
    this.game.pause();
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    process.stdout.write(SHOW_CURSOR + RESET_MARGINS + CLEAR);
    this.pty.resize(cols, rows);
    if (this.outputBuffer.length > 0) {
      process.stdout.write(this.outputBuffer.join(''));
      this.outputBuffer = [];
    }
    this.pty.resize(cols + 1, rows);
    this.pty.resize(cols, rows);
    this.updateHeader();
  }

  restoreTerminal(): void {
    try {
      process.stdout.write(SHOW_CURSOR + RESET_MARGINS);
      process.stdin.setRawMode(false);
      this.header.dispose();
    } catch {
      // best-effort cleanup
    }
  }

  private updateHeader(): void {
    if (this.state.mode !== 'game') {
      this.header.stopTimer();
      return;
    }
    this.header.sync();
  }
}
