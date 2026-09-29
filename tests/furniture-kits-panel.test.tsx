// @vitest-environment jsdom
import React, {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FurnitureKitsPanel,type KitPreviewRequest} from '../src/FurnitureKitsPanel';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {usePlanner} from '../src/store';
import {cozyStarterKits} from '../src/furnitureKits';
import {listFurnitureKits,saveFurnitureKit} from '../src/kitStorage';

vi.mock('../src/kitStorage',()=>({listFurnitureKits:vi.fn(async()=>[]),saveFurnitureKit:vi.fn(),renameFurnitureKit:vi.fn(),deleteFurnitureKit:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listFurnitureKits).mockResolvedValue([]);const plan=createSamplePlan('Kit UI','metric');plan.gridSizeMm=1000;plan.floors[0].cells=rectangleCells(8,8);usePlanner.getState().replacePlan(plan);});
afterEach(cleanup);

async function mount() {
  let request:KitPreviewRequest|undefined, serial=0, fail=false;
  const discard=vi.fn(),close=vi.fn();
  function Harness() {
    const [activeId,setActiveId]=useState<string>();
    return <FurnitureKitsPanel onClose={close} preview={{activeId,stage(next){request=next;const id=`preview-${++serial}`;setActiveId(id);return id;},apply(){if(fail)throw new Error('The room changed. Review again.');usePlanner.getState().commitDesign(request!.base,request!.plan);setActiveId(undefined);},discard(id){discard(id);setActiveId(current=>current===id?undefined:current);}}}/>;
  }
  const view=render(<Harness/>);
  await waitFor(()=>expect(screen.queryByText('Opening private kits…')).toBeNull());
  return {...view,discard,close,get request(){return request;},failApply(){fail=true;}};
}

it('allows choices before staging, requires an updated preview after movement, and retains Apply errors without committing',async()=>{
  const view=await mount(),base=usePlanner.getState().plan;
  fireEvent.click(screen.getByRole('button',{name:'Arrange Quiet reading nook'}));
  expect(view.request).toBeUndefined();
  fireEvent.click(screen.getByRole('button',{name:'Preview selected pieces'}));
  expect(view.request?.base).toBe(base);expect(usePlanner.getState().plan).toBe(base);
  const apply=screen.getByRole('button',{name:'Apply arrangement'}) as HTMLButtonElement;
  expect(apply.disabled).toBe(false);const oldX=view.request!.plan.furniture[0].x;
  fireEvent.click(screen.getByRole('button',{name:'Right 25 cm'}));expect(apply.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Update preview'}));expect(view.request!.plan.furniture[0].x).toBe(oldX+250);expect(apply.disabled).toBe(false);
  view.failApply();fireEvent.click(apply);expect(screen.getByRole('alert').textContent).toContain('The room changed');expect(usePlanner.getState().plan).toBe(base);expect(apply.disabled).toBe(false);
  view.unmount();expect(view.discard).toHaveBeenLastCalledWith('preview-2');
});

it.each(['Discard preview','Back to kits','Close arrangements'])('clears only the owned preview on %s without altering the home',async action=>{
  const view=await mount(),base=usePlanner.getState().plan;
  fireEvent.click(screen.getByRole('button',{name:'Arrange Breakfast for two'}));
  fireEvent.click(screen.getByRole('button',{name:'Preview selected pieces'}));
  fireEvent.click(screen.getByRole('button',{name:action}));
  expect(view.discard).toHaveBeenCalledExactlyOnceWith('preview-1');expect(usePlanner.getState().plan).toBe(base);expect(usePlanner.getState().past).toHaveLength(0);
  view.unmount();expect(view.discard).toHaveBeenCalledTimes(1);
});

it('requires an explicit skip for an unavailable saved piece and applies only the retained pieces in one undo',async()=>{
  const saved={...structuredClone(cozyStarterKits[0]),id:'my-old-kit',name:'Older corner'};saved.pieces[1].catalogId='retired-table';
  const before=structuredClone(saved);vi.mocked(listFurnitureKits).mockResolvedValue([saved]);
  const view=await mount(),base=usePlanner.getState().plan;
  fireEvent.click(screen.getByRole('button',{name:'Arrange Older corner'}));
  const preview=screen.getByRole('button',{name:'Preview selected pieces'}) as HTMLButtonElement;
  expect(preview.disabled).toBe(true);expect(view.request).toBeUndefined();
  const skip=screen.getByRole('checkbox',{name:'Keep retired-table 2'}) as HTMLInputElement;expect(skip.checked).toBe(true);fireEvent.click(skip);
  expect(preview.disabled).toBe(false);fireEvent.click(preview);expect(view.request!.addedIds).toHaveLength(2);
  fireEvent.click(screen.getByRole('checkbox',{name:/Keep Nook chair 1/}));expect((screen.getByRole('button',{name:'Apply arrangement'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Update preview'}));expect(view.request!.addedIds).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Apply arrangement'}));expect(usePlanner.getState().past).toHaveLength(1);expect(usePlanner.getState().plan.furniture).toHaveLength(1);
  usePlanner.getState().undo();expect(usePlanner.getState().plan).toEqual(base);expect(saved).toEqual(before);expect(saveFurnitureKit).not.toHaveBeenCalled();
});

it('keeps empty and non-fitting selections reviewable without changing the home',async()=>{
  const view=await mount(),base=usePlanner.getState().plan;
  fireEvent.click(screen.getByRole('button',{name:'Arrange Guest room'}));
  const x=screen.getByRole('textbox',{name:'Kit X metres'});fireEvent.change(x,{target:{value:'30'}});fireEvent.blur(x);
  expect(screen.getByText(/pieces extend beyond the floor shape/)).toBeTruthy();
  for(const box of screen.getAllByRole('checkbox'))fireEvent.click(box);
  expect(screen.getByText('Keep at least one piece before previewing.')).toBeTruthy();expect((screen.getByRole('button',{name:'Preview selected pieces'}) as HTMLButtonElement).disabled).toBe(true);
  expect(view.request).toBeUndefined();expect(usePlanner.getState().plan).toBe(base);
});
