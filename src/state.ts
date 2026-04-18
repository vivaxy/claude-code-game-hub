import { EventEmitter } from 'node:events';

export type Mode = 'claude' | 'game';

export class StateMachine extends EventEmitter {
  private _mode: Mode = 'claude';
  private drainUntil = 0;

  get mode(): Mode {
    return this._mode;
  }

  transitionTo(next: Mode): void {
    if (this._mode === next) return;
    this._mode = next;
    // Discard any in-flight stdin bytes for 80ms after a mode switch.
    this.drainUntil = Date.now() + 80;
    this.emit('transition', next);
  }

  isStdinDraining(): boolean {
    return Date.now() < this.drainUntil;
  }
}
