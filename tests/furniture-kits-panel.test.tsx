// @vitest-environment jsdom
import React, {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {FurnitureKitsPanel,type KitPreviewRequest} from '../src/FurnitureKitsPanel';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {usePlanner} from '../src/store';

vi.mock('../src/kitStorage',()=>({listFurnitureKits:vi.fn(async()=>[]),saveFurnitureKit:vi.fn(),renameFurnitureKit:vi.fn(),deleteFurnitureKit:vi.fn()}));
beforeEach(()=>{const plan=createSamplePlan('Kit UI','metric');plan.gridSizeMm=1000;plan.floors[0].cells=rectangleCells(8,8);usePlanner.getState().replacePlan(plan);});
afterEach(cleanup);

async function mount() {
  let request:KitPreviewRequest|undefined, serial=0, fail=false;
  const discard=vi.fn(),close=vi.fn();
  function Harness() {
    const [activeId,setActiveId]=useState<string>();
    return <FurnitureKitsPanel onClose={close} preview={{activeId,stage(next){request=next;const id=`preview-${++serial}`;setActiveId(id);return id;},apply(){if(fail)throw new Error('The room changed. Review again.');usePlanner.getState().commitDesign(request!.base,request!.plan);setActiveId(undefined);},discard(id){discard(id);setActiveId(current=>current===id?undefined:current);}}}/>;
  }
  const view=render(<Harness/>);
  await screen.findByText('Arrange a few pieces, then save your first kit.');
  return {...view,discard,close,get request(){return request;},failApply(){fail=true;}};
}

it('stages immediately, requires an updated preview after movement, and retains Apply errors without committing',async()=>{
  const view=await mount(),base=usePlanner.getState().plan;
  fireEvent.click(screen.getByRole('button',{name:'Arrange Quiet reading nook'}));
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
  fireEvent.click(screen.getByRole('button',{name:action}));
  expect(view.discard).toHaveBeenCalledExactlyOnceWith('preview-1');expect(usePlanner.getState().plan).toBe(base);expect(usePlanner.getState().past).toHaveLength(0);
  view.unmount();expect(view.discard).toHaveBeenCalledTimes(1);
});
