import { ClaudeStatus } from './state.js';

export class Header {
  private flashOn = true;
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
      colorCode = '\x1b[2m';
      label = ' Claude: idle ';
    } else if (status === 'working') {
      colorCode = '\x1b[36m';
      label = ' Claude: working ';
    } else {
      // waiting-for-input
      colorCode = this.flashOn ? '\x1b[33;1m' : '\x1b[31;1m';
      label = ' Claude: waiting-for-input  ·  press Ctrl+G to return to Claude ';
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

  startFlashing(): void {
    if (this.interval !== null) return;
    this.interval = setInterval(() => {
      this.flashOn = !this.flashOn;
      this.render();
    }, 500);
  }

  stopFlashing(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.flashOn = true;
    this.render();
  }

  dispose(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
