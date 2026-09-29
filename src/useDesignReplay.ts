import { useCallback, useEffect, useRef, useState } from 'react';
import { milestonePreview, type DesignHistoryPreview, type HistoryPlan } from './designHistory';

export interface ReplayPreviewBridge { show(preview: DesignHistoryPreview, signal: AbortSignal): void | Promise<void>; restore(): void | Promise<void> }
/** Manual milestones only. One timer advances one preview; no editor/history writes. */
export function useDesignReplay(plan: HistoryPlan, bridge: ReplayPreviewBridge, intervalMs = 1800) {
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [selected, setSelected] = useState(false), [error, setError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const callbacks = useRef(bridge); callbacks.current = bridge;
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const count = plan.designHistory?.milestones.length ?? 0;
  const current = Math.min(index, Math.max(0, count - 1));
  useEffect(() => {
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    const motion = () => { setReducedMotion(!!media?.matches); if (media?.matches) setPlaying(false); };
    const visibility = () => { if (document.hidden) setPlaying(false); };
    motion(); media?.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!selected) return;
    if (!count) { setPlaying(false); setSelected(false); void Promise.resolve().then(() => callbacks.current.restore()).catch(e => setError(String(e))); return; }
    if (document.hidden) return;
    const abort = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    activeRequest.current = abort;
    const show = async () => {
      try {
        const milestone = plan.designHistory!.milestones[current];
        await callbacks.current.show(milestonePreview(plan, milestone.id), abort.signal);
        if (abort.signal.aborted) return;
        if (playing && !reducedMotion && !document.hidden) {
          if (current === count - 1) setPlaying(false);
          else timer = setTimeout(() => setIndex(current + 1), Math.max(700, Math.min(5000, intervalMs)));
        }
      } catch (e) { if (!abort.signal.aborted) { setPlaying(false); setSelected(false); setError(e instanceof Error ? e.message : 'This milestone could not be shown.'); try { await callbacks.current.restore(); } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : 'The working view could not be restored.'); } } }
    };
    void show(); return () => { abort.abort(); if (timer) clearTimeout(timer); };
  }, [plan, current, count, selected, playing, reducedMotion, intervalMs]);
  useEffect(() => () => { void Promise.resolve().then(() => callbacks.current.restore()).catch(() => {}); }, []);
  const scrub = useCallback((next: number) => { setPlaying(false); setError(''); setSelected(true); setIndex(Math.max(0, Math.min(count - 1, Math.floor(next)))); }, [count]);
  const play = useCallback(() => { if (!count || reducedMotion || document.hidden) return; setError(''); setSelected(true); if (current === count - 1) setIndex(0); setPlaying(true); }, [count, reducedMotion, current]);
  const pause = useCallback(() => setPlaying(false), []);
  const stop = useCallback(async () => { activeRequest.current?.abort(); setPlaying(false); setSelected(false); await callbacks.current.restore(); }, []);
  return { index: current, playing, selected, reducedMotion, error, scrub, play, pause, stop };
}
