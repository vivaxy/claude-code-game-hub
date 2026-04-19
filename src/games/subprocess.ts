import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import type { Game } from './index.js';

export interface SubprocessGameOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cols: number;
  rows: number;
  onExit: () => void;
}

export class SubprocessGame implements Game {
  private childPty: IPty | null = null;
  private cols: number;
  private rows: number;
  private paused = true;
  private exited = false;

  constructor(private opts: SubprocessGameOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
  }

  resume(): void {
    if (!this.childPty || this.exited) {
      this.exited = false;
      this.spawnChildPty();
    } else {
      this.childPty.kill('SIGCONT');
    }
    this.paused = false;
    // Force redraw — curses apps cache terminal dimensions and may not repaint otherwise.
    this.childPty?.resize(this.cols, this.rows);
  }

  pause(): void {
    this.paused = true;
    this.childPty?.kill('SIGSTOP');
  }

  handleInput(key: string): void {
    this.childPty?.write(key);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    if (!this.paused) {
      this.childPty?.resize(cols, rows);
    }
  }

  dispose(): void {
    if (this.childPty) {
      try { this.childPty.kill('SIGCONT'); } catch { /* may already be stopped */ }
      try { this.childPty.kill(); } catch { /* already dead */ }
    }
    this.childPty = null;
  }

  private spawnChildPty(): void {
    const p = pty.spawn(this.opts.command, this.opts.args ?? [], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: process.env['HOME'] ?? process.cwd(),
      env: { ...process.env, ...(this.opts.env ?? {}) } as Record<string, string>,
    });
    p.onData((data) => {
      if (!this.paused) process.stdout.write(data);
    });
    p.onExit(() => {
      this.exited = true;
      this.childPty = null;
      this.opts.onExit();
    });
    this.childPty = p;
  }
}
