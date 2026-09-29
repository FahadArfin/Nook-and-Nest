export type LivingMotion = 'playing' | 'paused' | 'off';
export interface LivingPlayEntry { id: string; catalogId: string; name: string; floorId: string; motion: LivingMotion; canAnimate: boolean; canExtinguish: boolean; canSlide: boolean; fraction: number; savedFraction: number }
export type LivingCommand = { type: 'motion'; mode: LivingMotion } | { type: 'slide'; fraction: number } | { type: 'reset' };
export interface LivingPlayBridge { subscribe(listener: () => void): () => void; getSnapshot(): readonly LivingPlayEntry[]; command(id: string, command: LivingCommand): void; resetAll(): void; pauseAll(): void }
interface Clock { mode: LivingMotion; controlled?: boolean; input?: number; output?: number }
const clocks = new WeakMap<object, Clock>();
/** Renderer-only state. Never serialize this registry or place it on a plan/mesh metadata object. */
export function setLivingMotion(root: object, mode: LivingMotion) { const clock = clocks.get(root) ?? { mode }; clocks.set(root, { ...clock, mode, controlled: true }); }
export function resetLivingMotion(root: object) { clocks.delete(root); }
export function livingMotion(root: object): LivingMotion { return clocks.get(root)?.mode ?? 'playing'; }
export function livingAnimationTime(root: object, time: number, reduced = false): number | undefined {
  if (!Number.isFinite(time)) return undefined;
  const clock = clocks.get(root) ?? { mode: 'playing' as const };
  if (!clock.controlled) { clock.input = time; clock.output = reduced ? 0 : time; clocks.set(root, clock); return clock.output; }
  if (reduced) { clock.input = time; clock.output = 0; clocks.set(root, clock); return clock.mode === 'off' ? undefined : 0; }
  const delta = clock.input === undefined ? 0 : Math.max(0, Math.min(.05, time - clock.input));
  clock.input = time;
  if (clock.mode !== 'playing') { clocks.set(root, clock); return undefined; }
  clock.output = clock.output === undefined ? time : clock.output + delta;
  clocks.set(root, clock); return clock.output;
}
