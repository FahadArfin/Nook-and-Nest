// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createBlankPlan } from '../src/domain';
import { validatePlan } from '../src/planValidation';
import { DesignHistoryPanel } from '../src/DesignHistoryPanel';
import { captureDesignMilestone, setMilestoneRecording, startRenovation, type HistoryPlan } from '../src/designHistory';
import { useDesignReplay } from '../src/useDesignReplay';
import type { PlanDocumentV1 } from '../src/types';
const view = (floorId: string) => ({ version: 1 as const, kind: 'orbit' as const, floorId, target: { x: 0, y: 0, z: 0 }, alpha: .7, beta: 1, radius: 10, mode: 0 as const, fov: .8 });
const bridge = () => ({ show: vi.fn(), restore: vi.fn(), capture: vi.fn() });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('rejects a stale async reference capture before saving the baseline', async () => {
  const plan = createBlankPlan('Before', 'metric'), onChange = vi.fn(); let resolve!: (p: PlanDocumentV1) => void;
  const prepareCapture = vi.fn(() => new Promise<PlanDocumentV1>(done => { resolve = done; }));
  const scene = bridge(), props = { activeFloorId: plan.floors[0].id, onChange, onApply: vi.fn(), bridge: scene, captureView: () => view(plan.floors[0].id), prepareCapture };
  const mounted = render(<DesignHistoryPanel {...props} plan={plan}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Save current home as Existing' })); await waitFor(() => expect(prepareCapture).toHaveBeenCalledOnce());
  mounted.rerender(<DesignHistoryPanel {...props} plan={{ ...plan, name: 'A newer edit' }}/>);
  await act(async () => resolve(plan)); await screen.findByText(/project changed while its references/); expect(onChange).not.toHaveBeenCalled();
});
it('labels baseline/proposed accurately, previews without commits and restores only after explicit confirmation', async () => {
  const initial = createBlankPlan('Home', 'metric'), saved = startRenovation(initial, initial.floors[0].id, validatePlan), scene = bridge(), change = vi.fn(), apply = vi.fn();
  render(<DesignHistoryPanel plan={saved} activeFloorId={initial.floors[0].id} onChange={change} onApply={apply} bridge={scene} captureView={() => view(initial.floors[0].id)}/>);
  expect(screen.getByRole('img', { name: 'Existing · baseline, same-scale planning diagram' })).toBeTruthy(); expect(screen.getByRole('img', { name: 'Proposed · revision 1, same-scale planning diagram' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Existing baseline' })); await waitFor(() => expect(scene.show).toHaveBeenCalledOnce()); expect(change).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  await waitFor(() => expect((screen.getByRole('button', { name: 'Restore Existing to editor' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Restore Existing to editor' })); expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm restoration' })); await waitFor(() => expect(apply).toHaveBeenCalledOnce()); expect(apply.mock.calls[0][0]).toBe(saved);
});
it('saves only manual milestones when enabled and keeps capture disabled again after opt-out', async () => {
  const initial = createBlankPlan('Home', 'metric'), changed = vi.fn(), scene = bridge();
  function Harness() { const [plan, setPlan] = useState(initial); return <DesignHistoryPanel plan={plan} activeFloorId={plan.floors[0].id} bridge={scene} captureView={() => view(plan.floors[0].id)} prepareCapture={async p => p} onApply={vi.fn()} onChange={(_base, next) => { changed(next); setPlan(next); }}/>; }
  render(<Harness/>); fireEvent.click(screen.getByRole('button', { name: 'Design milestones' }));
  fireEvent.change(screen.getByLabelText('Milestone name'), { target: { value: 'A first idea' } }); expect((screen.getByRole('button', { name: 'Save milestone' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Enable manual design milestones')); await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save milestone' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save milestone' })); await screen.findByRole('button', { name: 'Preview A first idea' }); expect(changed).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByLabelText('Enable manual design milestones')); await waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
  expect(changed.mock.calls[2][0].designHistory.milestones).toHaveLength(1); expect(changed.mock.calls[2][0].designHistory.recordingEnabled).toBe(false);
});
it('pauses preview replay for hidden/reduced-motion, supports manual scrub and cancels outstanding work on cleanup', async () => {
  vi.useFakeTimers(); let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const listeners = new Set<() => void>(), media = { matches: false, addEventListener: vi.fn((_name: string, f: () => void) => listeners.add(f)), removeEventListener: vi.fn((_name: string, f: () => void) => listeners.delete(f)) }; vi.stubGlobal('matchMedia', () => media);
  let plan: HistoryPlan = setMilestoneRecording(createBlankPlan('Replay', 'metric'), true, validatePlan);
  for (let i = 0; i < 3; i++) plan = captureDesignMilestone(plan, `Step ${i}`, plan.floors[0].id, validatePlan, { id: `step-${i}` });
  const original = JSON.stringify(plan), scene = { show: vi.fn(), restore: vi.fn() }, hook = renderHook(() => useDesignReplay(plan, scene, 1000));
  act(() => hook.result.current.play()); await act(async () => { await vi.advanceTimersByTimeAsync(1001); }); expect(hook.result.current.index).toBe(1);
  act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); }); await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); expect(hook.result.current.index).toBe(1); expect(hook.result.current.playing).toBe(false);
  act(() => { hidden = false; media.matches = true; listeners.forEach(f => f()); }); act(() => hook.result.current.play()); expect(hook.result.current.playing).toBe(false);
  act(() => hook.result.current.scrub(2)); await act(async () => {}); expect(hook.result.current.index).toBe(2); expect(scene.show.mock.calls.at(-1)![0].label).toBe('Step 2');
  const signal = scene.show.mock.calls.at(-1)![1] as AbortSignal; hook.unmount(); await act(async () => {}); expect(signal.aborted).toBe(true); expect(listeners.size).toBe(0); expect(scene.restore).toHaveBeenCalledOnce(); expect(JSON.stringify(plan)).toBe(original);
});
