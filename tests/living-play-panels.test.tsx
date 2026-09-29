// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createSamplePlan } from '../src/domain';
import { CreativeChallengesPanel, type ChallengeLaunch } from '../src/CreativeChallengesPanel';
import { createChallengeProject, challengeBrief } from '../src/creativeChallenges';
import { SeasonalLookPanel } from '../src/SeasonalLookPanel';
import { LivingPlayPanel } from '../src/LivingPlayPanel';
import type { LivingPlayBridge, LivingPlayEntry } from '../src/livingPlay';
import type { KitPreviewRequest } from '../src/FurnitureKitsPanel';
import type { SeasonalPlan } from '../src/seasonalLook';
afterEach(cleanup);

it('delegates new-project safety and aborts a late launch without replacing the current plan', async () => {
  const plan = createSamplePlan('Keep my unsaved work', 'metric'), original = structuredClone(plan), onChange = vi.fn(), close = vi.fn(); let request!: ChallengeLaunch, finish!: (created: boolean) => void;
  const onLaunch = vi.fn((value: ChallengeLaunch) => { request = value; return new Promise<boolean>(resolve => { finish = resolve; }); });
  const view = render(<CreativeChallengesPanel plan={plan} onLaunch={onLaunch} onChange={onChange} onClose={close}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Start in a new project' })); expect(onLaunch).toHaveBeenCalledOnce(); expect(onChange).not.toHaveBeenCalled(); expect(plan).toEqual(original);
  const separate = request.createPlan(); expect(separate.id).not.toBe(plan.id); expect(separate.furniture).toEqual([]);
  view.unmount(); expect(request.signal.aborted).toBe(true); expect(() => request.createPlan()).toThrow('cancelled'); await act(async () => finish(true)); expect(close).not.toHaveBeenCalled();
});

it('persists optional hint dismissal only as an explicit private metadata commit', () => {
  const plan = createChallengeProject(challengeBrief('reading-nook', 22), 'metric'), onChange = vi.fn();
  render(<CreativeChallengesPanel plan={plan} onLaunch={vi.fn(async () => false)} onChange={onChange} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss hints' }));
  expect(onChange).toHaveBeenCalledOnce(); const [base, next] = onChange.mock.calls[0]; expect(base).toBe(plan); expect(next.creativeChallenge.hintsDismissed).toBe(true); expect(next.furniture).toBe(plan.furniture); expect(next.floors).toBe(plan.floors);
});

it('stages seasonal metadata without mutation and keeps failed Apply reviewable until discard', () => {
  const plan = createSamplePlan('Garden', 'metric') as SeasonalPlan, staged = vi.fn(), apply = vi.fn(() => { throw new Error('The plan changed. Preview again.'); }), discard = vi.fn(); let request: KitPreviewRequest | undefined;
  function Harness() { const [activeId, setActiveId] = useState<string>(); return <SeasonalLookPanel plan={plan} activeFloorId={plan.floors[0].id} onClose={() => {}} preview={{ activeId, stage(value) { staged(value); request = value; setActiveId('season'); return 'season'; }, apply, discard(id) { discard(id); setActiveId(undefined); } }}/>; }
  const view = render(<Harness/>); fireEvent.click(within(screen.getByRole('group', { name: 'Garden palette' })).getByRole('button', { name: 'Autumn' })); expect(staged).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Preview colors' })); expect(request!.base).toBe(plan); expect(request!.plan.furniture).toBe(plan.furniture); expect((request!.plan as SeasonalPlan).environment?.seasonalLook?.palette).toBe('autumn'); expect(plan.environment?.seasonalLook).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Apply colors' })); expect(screen.getByRole('alert').textContent).toContain('Preview again'); expect((screen.getByRole('button', { name: 'Apply colors' }) as HTMLButtonElement).disabled).toBe(false);
  view.unmount(); expect(discard).toHaveBeenCalledWith('season');
});

it('shows only runtime-supported living controls and resets the session on plan changes and unmount', () => {
  const plan = createSamplePlan('Living room', 'metric'), listener = new Set<() => void>(), entry: LivingPlayEntry = { id: 'fire', catalogId: 'cottage-fireplace', name: 'Fireplace', floorId: plan.floors[0].id, motion: 'playing', canAnimate: true, canExtinguish: true, canSlide: false, fraction: 0, savedFraction: 0 };
  const snapshot = [entry], command = vi.fn(), resetAll = vi.fn(); const bridge: LivingPlayBridge = { subscribe(fn) { listener.add(fn); return () => { listener.delete(fn); }; }, getSnapshot: () => snapshot, command, resetAll, pauseAll: vi.fn() };
  const view = render(<LivingPlayPanel plan={plan} activeFloorId={plan.floors[0].id} bridge={bridge} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Fire off' })); expect(command).toHaveBeenCalledWith('fire', { type: 'motion', mode: 'off' }); expect(screen.queryByRole('slider')).toBeNull();
  const initialResets = resetAll.mock.calls.length; view.rerender(<LivingPlayPanel plan={{ ...plan }} activeFloorId={plan.floors[0].id} bridge={bridge} onClose={() => {}}/>); expect(resetAll.mock.calls.length).toBeGreaterThan(initialResets); view.unmount(); expect(listener.size).toBe(0);
});
