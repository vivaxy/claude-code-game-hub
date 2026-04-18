export interface Game {
  resume(): void;
  pause(): void;
  handleInput(key: string): void;
  resize(cols: number, rows: number): void;
}
