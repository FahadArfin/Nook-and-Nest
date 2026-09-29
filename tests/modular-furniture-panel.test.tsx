// @vitest-environment jsdom
import React, {useState} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ModularFurniturePanel} from '../src/ModularFurniturePanel';
import type {KitPreviewRequest} from '../src/FurnitureKitsPanel';
import {createSamplePlan, rectangleCells} from '../src/domain';
import {usePlanner} from '../src/store';

beforeEach(() => {
  const plan = createSamplePlan('Cabinet preview', 'metric'); plan.gridSizeMm = 1000;
  plan.floors = plan.floors.map(floor => ({...floor, cells: rectangleCells(12, 12)})); plan.furniture = [];
  usePlanner.getState().replacePlan(plan);
});
afterEach(cleanup);

function mount() {
  let request: KitPreviewRequest | undefined, serial = 0, fail = false, replaceActive: (id: string | undefined) => void = () => {};
  const discard = vi.fn(), apply = vi.fn(), close = vi.fn(), staged = vi.fn();
  function Harness() {
    const plan = usePlanner(state => state.plan), [activeId, setActiveId] = useState<string>(); replaceActive = setActiveId;
    return <ModularFurniturePanel plan={plan} activeFloorId={plan.floors[0].id} onClose={close} preview={{activeId,
      stage(next) {staged(next); request = next; const id = `modular-${++serial}`; setActiveId(id); return id;},
      apply(id) {apply(id); if (fail) throw new Error('The project changed. Preview again.'); usePlanner.getState().commitDesign(request!.base, request!.plan); setActiveId(undefined);},
      discard(id) {discard(id); setActiveId(current => current === id ? undefined : current);},
    }}/>;
  }
  const view = render(<Harness/>);
  return {...view, discard, apply, close, staged, get request() {return request;}, failApply() {fail = true;}, replaceActive(id: string) {act(() => replaceActive(id));}};
}
const button = (name: string) => screen.getByRole('button', {name}) as HTMLButtonElement;

it('keeps configuration local until preview and applies the reviewed assembly exactly once with one undo', () => {
  const view = mount(), base = usePlanner.getState().plan;
  expect(button('Apply assembly').disabled).toBe(true);
  fireEvent.click(button('Soft sage'));
  expect(view.staged).not.toHaveBeenCalled(); expect(usePlanner.getState().plan).toBe(base);
  fireEvent.click(button('Preview assembly'));
  expect(view.request!.base).toBe(base); expect(view.request!.plan.furniture.every(piece => piece.variant === 'sage')).toBe(true);
  expect(button('Apply assembly').disabled).toBe(false); expect(usePlanner.getState().past).toHaveLength(0);
  fireEvent.click(button('Apply assembly')); fireEvent.click(button('Apply assembly'));
  expect(view.apply).toHaveBeenCalledExactlyOnceWith('modular-1'); expect(view.close).toHaveBeenCalledOnce();
  expect(usePlanner.getState().past).toHaveLength(1); expect(usePlanner.getState().plan.furniture).toHaveLength(2);
  act(() => usePlanner.getState().undo()); expect(usePlanner.getState().plan).toEqual(base);
});

it('invalidates a preview after material or position edits and retains provider errors without a partial commit', () => {
  const view = mount(), base = usePlanner.getState().plan;
  fireEvent.click(button('Preview assembly'));
  fireEvent.click(button('Deep slate'));
  expect(view.discard).toHaveBeenCalledExactlyOnceWith('modular-1'); expect(button('Apply assembly').disabled).toBe(true);
  fireEvent.click(button('Preview assembly'));
  const input = screen.getByRole('textbox', {name: 'Position X metres'});
  fireEvent.change(input, {target: {value: '7'}}); fireEvent.blur(input);
  expect(view.discard).toHaveBeenLastCalledWith('modular-2'); expect(button('Apply assembly').disabled).toBe(true);
  fireEvent.click(button('Preview assembly')); expect(view.request!.plan.furniture[0].x).toBe(7450);
  view.failApply(); fireEvent.click(button('Apply assembly'));
  expect(screen.getByRole('alert').textContent).toContain('project changed'); expect(usePlanner.getState().plan).toBe(base);
  expect(usePlanner.getState().past).toHaveLength(0); expect(button('Apply assembly').disabled).toBe(false);
  view.unmount(); expect(view.discard).toHaveBeenLastCalledWith('modular-3');
});

it('requires a fresh preview when the project changes while the builder is open', () => {
  const view = mount(); fireEvent.click(button('Preview assembly'));
  const original = view.request!.base;
  act(() => usePlanner.getState().rename('A later project revision'));
  expect(view.discard).toHaveBeenCalledExactlyOnceWith('modular-1'); expect(button('Apply assembly').disabled).toBe(true);
  fireEvent.click(button('Apply assembly')); expect(view.apply).not.toHaveBeenCalled();
  fireEvent.click(button('Preview assembly')); expect(view.request!.base).not.toBe(original);
  expect(view.request!.base).toBe(usePlanner.getState().plan); expect(button('Apply assembly').disabled).toBe(false);
});

it.each(['Discard preview', 'Back'])('discards only its own preview on %s and does not discard twice at unmount', action => {
  const view = mount(), base = usePlanner.getState().plan; fireEvent.click(button('Preview assembly'));
  fireEvent.click(button(action)); expect(view.discard).toHaveBeenCalledExactlyOnceWith('modular-1');
  expect(usePlanner.getState().plan).toBe(base); expect(usePlanner.getState().past).toHaveLength(0);
  view.unmount(); expect(view.discard).toHaveBeenCalledTimes(1);
});

it('does not apply or clear an unrelated active preview when another panel replaces its stage', () => {
  const view = mount(); fireEvent.click(button('Preview assembly'));
  view.replaceActive('some-other-panel');
  expect(view.discard).toHaveBeenCalledExactlyOnceWith('modular-1'); expect(view.discard).not.toHaveBeenCalledWith('some-other-panel');
  expect(button('Apply assembly').disabled).toBe(true); fireEvent.click(button('Apply assembly')); expect(view.apply).not.toHaveBeenCalled();
  view.unmount(); expect(view.discard).toHaveBeenCalledTimes(1);
});
