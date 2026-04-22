import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine, STDIN_DRAIN_MS } from '../src/state.js';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setStatus', () => {
    it('starts idle', () => {
      expect(sm.status).toBe('idle');
    });

    it('updates status and emits on change', () => {
      const listener = vi.fn();
      sm.on('status', listener);
      sm.setStatus('working');
      expect(sm.status).toBe('working');
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith('working');
    });

    it('is a no-op (no event) when status unchanged', () => {
      sm.setStatus('working');
      const listener = vi.fn();
      sm.on('status', listener);
      sm.setStatus('working');
      expect(listener).not.toHaveBeenCalled();
    });

    it('transitions through all three statuses', () => {
      const events: string[] = [];
      sm.on('status', (s) => events.push(s));
      sm.setStatus('working');
      sm.setStatus('waiting-for-input');
      sm.setStatus('idle');
      expect(events).toEqual(['working', 'waiting-for-input', 'idle']);
    });
  });

  describe('transitionTo', () => {
    it('starts in claude mode', () => {
      expect(sm.mode).toBe('claude');
    });

    it('updates mode and emits on change', () => {
      const listener = vi.fn();
      sm.on('transition', listener);
      sm.transitionTo('game');
      expect(sm.mode).toBe('game');
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith('game');
    });

    it('is a no-op (no event) when mode unchanged', () => {
      const listener = vi.fn();
      sm.on('transition', listener);
      sm.transitionTo('claude');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('isStdinDraining', () => {
    it('is false before any transition', () => {
      expect(sm.isStdinDraining()).toBe(false);
    });

    it('is true immediately after transitionTo', () => {
      vi.useFakeTimers();
      sm.transitionTo('game');
      expect(sm.isStdinDraining()).toBe(true);
    });

    it('is false after STDIN_DRAIN_MS + 1ms have elapsed', () => {
      vi.useFakeTimers();
      sm.transitionTo('game');
      vi.advanceTimersByTime(STDIN_DRAIN_MS + 1);
      expect(sm.isStdinDraining()).toBe(false);
    });

    it('is still true at STDIN_DRAIN_MS - 1ms', () => {
      vi.useFakeTimers();
      sm.transitionTo('game');
      vi.advanceTimersByTime(STDIN_DRAIN_MS - 1);
      expect(sm.isStdinDraining()).toBe(true);
    });

    it('setStatus does not arm the drain window', () => {
      vi.useFakeTimers();
      sm.setStatus('working');
      expect(sm.isStdinDraining()).toBe(false);
    });
  });
});
