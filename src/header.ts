import { ClaudeStatus } from './state.js';

const WORKING_FRAMES = ['✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳'];
const WORKING_INTERVAL_MS = 120;
const IDLE_INTERVAL_MS = 600;
const WAITING_INTERVAL_MS = 500;

export class Header {
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private getCols: () => number,
    private getStatus: () => ClaudeStatus,
    private getMode: () => string,
  ) {}

  render(): void {
    if (this.getMode() !== 'game') return;

    const status = this.getStatus();
    const cols = this.getCols();

    let colorCode: string;
    let label: string;

    if (status === 'idle') {
      colorCode = this.frame % 2 === 0 ? '\x1b[32;1m' : '\x1b[32m';
      label = ' Claude: idle ';
    } else if (status === 'working') {
      const glyph = WORKING_FRAMES[this.frame % WORKING_FRAMES.length];
      colorCode = '\x1b[36;1m';
      label = ` Claude: ${glyph} working `;
    } else {
      // waiting-for-input
      const glyph = this.frame % 2 === 0 ? '⚠' : '‼';
      colorCode = this.frame % 2 === 0 ? '\x1b[33;1m' : '\x1b[31;1m';
      label = ` Claude: ${glyph} waiting-for-input  ·  press Ctrl+G to return to Claude `;
    }

    const padded = label.length < cols ? label + ' '.repeat(cols - label.length) : label;

    process.stdout.write(
      '\x1b[s' +          // save cursor
      '\x1b[1;1H' +       // move to row 1 col 1
      '\x1b[2K' +         // clear line
      colorCode +         // set color
      padded +            // label + padding (inside color so full row is colored)
      '\x1b[0m' +         // reset SGR
      '\x1b[u',           // restore cursor
    );
  }

  sync(): void {
    const status = this.getStatus();
    let intervalMs: number;
    if (status === 'working') {
      intervalMs = WORKING_INTERVAL_MS;
    } else if (status === 'idle') {
      intervalMs = IDLE_INTERVAL_MS;
    } else {
      intervalMs = WAITING_INTERVAL_MS;
    }
    this.startTimer(intervalMs);
    this.render();
  }

  stopTimer(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  dispose(): void {
    this.stopTimer();
  }

  private startTimer(intervalMs: number): void {
    this.stopTimer();
    this.frame = 0;
    this.interval = setInterval(() => {
      this.frame++;
      this.render();
    }, intervalMs);
  }
}
