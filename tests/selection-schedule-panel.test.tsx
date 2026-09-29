// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {createBlankPlan} from '../src/domain';
import {SelectionSchedulePanel} from '../src/SelectionSchedulePanel';
import type {SelectionPlan} from '../src/selectionSchedule';
afterEach(cleanup);
function fixture():SelectionPlan{const plan=createBlankPlan('Shopping','metric');plan.furniture=[{id:'table',floorId:plan.floors[0].id,catalogId:'side-table',x:1000,z:1000,rotation:0,widthMm:500,depthMm:500,heightMm:600,variant:'sage'}];return plan;}
it('does not mutate while editing, then saves a manual priced item through one guarded callback',()=>{
  const plan=fixture(),onCommit=vi.fn();render(<SelectionSchedulePanel plan={plan} onCommit={onCommit}/>);fireEvent.click(screen.getByRole('button',{name:/Edit .*table/i}));
  fireEvent.change(screen.getByLabelText('Currency code'),{target:{value:'CAD'}});fireEvent.change(screen.getByLabelText('Price for this item'),{target:{value:'125.50'}});expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Save selection'}));expect(onCommit).toHaveBeenCalledOnce();expect(onCommit.mock.calls[0][0]).toBe(plan);expect(onCommit.mock.calls[0][1].furniture[0].specification).toMatchObject({currency:'CAD',unitPriceMinor:12550,purchase:{unit:'item',quantity:1}});
});
it('keeps an open form stale after an external change and never overwrites the newer plan',()=>{
  const plan=fixture(),onCommit=vi.fn(),view=render(<SelectionSchedulePanel plan={plan} onCommit={onCommit}/>);fireEvent.click(screen.getByRole('button',{name:/Edit .*table/i}));view.rerender(<SelectionSchedulePanel plan={{...plan,name:'Newer'}} onCommit={onCommit}/>);
  expect((screen.getByRole('button',{name:'Save selection'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByRole('alert').textContent).toContain('project changed');expect(onCommit).not.toHaveBeenCalled();
});
