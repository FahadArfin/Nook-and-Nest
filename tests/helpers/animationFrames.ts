import { vi } from 'vitest';

/** A deterministic browser-like frame queue: cancelled callbacks never execute. */
export function animationFrames() {
  let now = 0, nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
  return {
    advance(milliseconds: number) {
      now += milliseconds;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(now);
    },
    get pending() { return pending.size; },
  };
}
