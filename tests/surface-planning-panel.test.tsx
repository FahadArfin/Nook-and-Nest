// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {SurfacePlanningPanel} from '../src/SurfacePlanningPanel';
import type {TakeoffPlan} from '../src/surfaceTakeoff';
afterEach(cleanup);
function plan():TakeoffPlan {const p=createSamplePlan('Home','metric');p.gridSizeMm=1000;p.floors=[{...p.floors[0],id:'floor',cells:rectangleCells(4,3),walls:[],openings:[],stairs:[]}];p.furniture=[];return p;}
it('commits assumptions once, rebases after a cloned parent commit, and keeps geometry unchanged',async()=>{
  const initial=plan(),commit=vi.fn();
  function Host(){const [value,setValue]=useState(initial);return <SurfacePlanningPanel plan={value} onCommit={(base,next)=>{expect(base).toBe(value);commit(next);setValue(structuredClone(next));}}/>;}
  render(<Host/>);fireEvent.click(screen.getByText('Calculation assumptions'));fireEvent.change(screen.getByLabelText('Waste (%)'),{target:{value:'15'}});fireEvent.click(screen.getByRole('button',{name:'Save assumptions'}));
  await waitFor(()=>expect(screen.getByText('Surface assumptions saved.')).toBeTruthy());expect(commit).toHaveBeenCalledTimes(1);expect(commit.mock.calls[0][0].floors).toEqual(initial.floors);expect(commit.mock.calls[0][0].surfaceTakeoffSettings.rates.wall.wastePercent).toBe(15);expect((screen.getByRole('button',{name:'Save assumptions'}) as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText(/The project changed/)).toBeNull();
});
it('keeps an unsaved assumption draft stale after an external plan change until explicitly reloaded',()=>{
  const p=plan(),commit=vi.fn(),ui=render(<SurfacePlanningPanel plan={p} onCommit={commit}/>);fireEvent.click(screen.getByText('Calculation assumptions'));fireEvent.change(screen.getByLabelText('Waste (%)'),{target:{value:'20'}});ui.rerender(<SurfacePlanningPanel plan={{...p,name:'External edit'}} onCommit={commit}/>);
  expect((screen.getByRole('button',{name:'Save assumptions'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText(/The project changed/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Save assumptions'}));expect(commit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Reload saved assumptions'}));expect((screen.getByLabelText('Waste (%)') as HTMLInputElement).value).toBe('10');expect((screen.getByRole('button',{name:'Save assumptions'}) as HTMLButtonElement).disabled).toBe(false);
});
