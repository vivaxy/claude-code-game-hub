import { EventEmitter } from 'node:events';

export type Mode = 'claude' | 'game';
export type ClaudeStatus = 'working' | 'waiting-for-input' | 'idle';

export class StateMachine extends EventEmitter {
  private _mode: Mode = 'claude';
  private _status: ClaudeStatus = 'idle';
  private drainUntil = 0;

  get mode(): Mode {
    return this._mode;
  }

  get status(): ClaudeStatus {
    return this._status;
  }

  setStatus(next: ClaudeStatus): void {
    if (this._status === next) return;
    this._status = next;
    this.emit('status', next);
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
