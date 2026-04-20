import type { Game } from './index.js';

type Dir = 'up' | 'down' | 'left' | 'right';
type Point = [number, number]; // [col, row]

const GRID_W = 20;
const GRID_H = 16;
const TICK_MS = 120;

const KEY_UP = '\x1b[A';
const KEY_DOWN = '\x1b[B';
const KEY_RIGHT = '\x1b[C';
const KEY_LEFT = '\x1b[D';

function move(pos: Point, dir: Dir): Point {
  const [c, r] = pos;
  if (dir === 'up') return [c, r - 1];
  if (dir === 'down') return [c, r + 1];
  if (dir === 'left') return [c - 1, r];
  return [c + 1, r];
}

function eqPt(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

// ANSI helpers
const at = (col: number, row: number) => `\x1b[${row + 1};${col + 1}H`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export class Snake implements Game {
  private snake: Point[] = [[10, 8], [9, 8], [8, 8]];
  private dir: Dir = 'right';
  private nextDir: Dir = 'right';
  private food: Point = [15, 8];
  private score = 0;
  private dead = false;
  private paused = true;
  private timer: ReturnType<typeof setInterval> | null = null;
  private termCols = process.stdout.columns || 80;
  private termRows = process.stdout.rows || 24;
  private best = 0;
  private confirming = false;

  // Canvas top-left offset (centered in terminal; clamped to ≥ 0).
  private get offCol(): number { return Math.max(0, Math.floor((this.termCols - GRID_W * 2 - 2) / 2)); }
  private get offRow(): number { return 1 + Math.max(0, Math.floor((this.termRows - GRID_H - 4) / 2)); }

  resume(): void {
    this.paused = false;
    if (this.dead) this.resetGame();
    this.render();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  pause(): void {
    this.paused = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  handleInput(key: string): void {
    if (this.dead && !this.confirming && (key === 'r' || key === 'R')) {
      this.confirming = true;
      this.renderConfirm();
      return;
    }
    if (this.confirming) {
      if (key === 'y' || key === 'Y') {
        this.confirming = false;
        this.resetGame();
        this.paused = false;
        this.render();
        this.timer = setInterval(() => this.tick(), TICK_MS);
      } else {
        this.confirming = false;
        this.renderDead();
      }
      return;
    }
    // existing arrow/p handlers below (unchanged):
    if (key === KEY_UP && this.dir !== 'down') this.nextDir = 'up';
    else if (key === KEY_DOWN && this.dir !== 'up') this.nextDir = 'down';
    else if (key === KEY_LEFT && this.dir !== 'right') this.nextDir = 'left';
    else if (key === KEY_RIGHT && this.dir !== 'left') this.nextDir = 'right';
    else if (key === 'p' || key === 'P') {
      if (this.paused) this.resume(); else this.pause();
    }
    // 'q' is handled by the parent (returns to claude-mode)
  }

  resize(cols: number, rows: number): void {
    this.termCols = cols;
    this.termRows = rows;
    if (!this.paused) this.render();
  }

  private tick(): void {
    if (this.paused || this.dead) return;
    this.dir = this.nextDir;
    const head = move(this.snake[0], this.dir);
    const [c, r] = head;

    if (c < 0 || c >= GRID_W || r < 0 || r >= GRID_H || this.snake.some((p) => eqPt(p, head))) {
      this.dead = true;
      this.renderDead();
      this.pause();
      return;
    }

    this.snake.unshift(head);
    if (eqPt(head, this.food)) {
      this.score++;
      this.spawnFood();
    } else {
      this.snake.pop();
    }
    this.render();
  }

  private spawnFood(): void {
    let f: Point;
    do {
      f = [Math.floor(Math.random() * GRID_W), Math.floor(Math.random() * GRID_H)];
    } while (this.snake.some((p) => eqPt(p, f)));
    this.food = f;
  }

  private resetGame(): void {
    this.best = Math.max(this.best, this.score);
    this.snake = [[10, 8], [9, 8], [8, 8]];
    this.dir = 'right';
    this.nextDir = 'right';
    this.score = 0;
    this.dead = false;
    this.confirming = false;
    this.spawnFood();
  }

  private cell(c: number, r: number): string {
    // Each cell is 2 chars wide so the grid looks square-ish.
    const isHead = eqPt(this.snake[0], [c, r]);
    const isBody = !isHead && this.snake.some((p) => eqPt(p, [c, r]));
    const isFood = eqPt(this.food, [c, r]);
    if (isHead) return bold(green('()'));
    if (isBody) return green('██');
    if (isFood) return yellow('••');
    return '  ';
  }

  private render(): void {
    const buf: string[] = ['\x1b[?25l']; // hide cursor
    const oc = this.offCol;
    const or = this.offRow;

    // Title
    buf.push(at(oc, or), bold('  🐍 Snake — score: ' + this.score + '  best: ' + this.best + '  '));
    buf.push(at(oc, or + 1), bold('  ↑↓←→ move  p pause  q back to claude  '));

    // Border top
    buf.push(at(oc, or + 2), '┌' + '─'.repeat(GRID_W * 2) + '┐');

    // Grid rows
    for (let r = 0; r < GRID_H; r++) {
      buf.push(at(oc, or + 3 + r), '│');
      for (let c = 0; c < GRID_W; c++) {
        buf.push(this.cell(c, r));
      }
      buf.push('│');
    }

    // Border bottom
    buf.push(at(oc, or + 3 + GRID_H), '└' + '─'.repeat(GRID_W * 2) + '┘');

    process.stdout.write(buf.join(''));
  }

  private renderDead(): void {
    const oc = this.offCol + GRID_W - 5;
    const or = this.offRow + 3 + Math.floor(GRID_H / 2);
    process.stdout.write(at(oc, or) + red(bold(' GAME OVER ')) + at(oc, or + 1) + '  score: ' + this.score + '  ');
    process.stdout.write(at(oc, or + 2) + yellow('  press r to restart, q to return to Claude  '));
  }

  private renderConfirm(): void {
    const oc = this.offCol + GRID_W - 5;
    const or = this.offRow + 3 + Math.floor(GRID_H / 2);
    process.stdout.write(at(oc, or) + red(bold(' GAME OVER ')) + at(oc, or + 1) + '  score: ' + this.score + '  ');
    process.stdout.write(at(oc, or + 2) + bold(yellow('  Restart? (y/n)  ')));
  }
}
