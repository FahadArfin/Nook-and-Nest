// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {createBlankPlan} from '../src/domain';
import {GroupEditorPanel} from '../src/GroupEditorPanel';
import type {GroupPlan} from '../src/furnitureGroups';
afterEach(cleanup);
function fixture():GroupPlan {const plan=createBlankPlan('Groups','metric');plan.furniture=['a','b'].map((id,i)=>({id,floorId:plan.floors[0].id,catalogId:'side-table',x:1000+i*800,z:2000,rotation:0,widthMm:500,depthMm:450,heightMm:650,variant:'sage'}));return {...plan,furnitureGroups:{version:1,groups:[{id:'set',name:'Side tables',floorId:plan.floors[0].id,memberIds:['a','b'],locked:false}],lockedItemIds:[]}};}
it('selection picks a whole saved group without committing, and move submits one atomic candidate',()=>{
  const plan=fixture(),onSelectionChange=vi.fn(),onCommit=vi.fn(),props={plan,activeFloorId:plan.floors[0].id,onSelectionChange,onCommit};
  const view=render(<GroupEditorPanel {...props} selectedIds={[]}/>);fireEvent.click(screen.getAllByRole('checkbox')[0]);expect(onSelectionChange).toHaveBeenLastCalledWith(['a','b']);expect(onCommit).not.toHaveBeenCalled();
  view.rerender(<GroupEditorPanel {...props} selectedIds={['a','b']}/>);fireEvent.click(screen.getByRole('button',{name:'Right'}));expect(onCommit).toHaveBeenCalledOnce();expect(onCommit.mock.calls[0][0]).toBe(plan);expect(onCommit.mock.calls[0][1].furniture.map((p:{x:number})=>p.x)).toEqual([1250,2050]);
});
it('keeps deletion reversible until confirmed and rejects a changed plan while confirmation is open',()=>{
  const plan=fixture(),onCommit=vi.fn(),props={activeFloorId:plan.floors[0].id,selectedIds:['a','b'],onSelectionChange:vi.fn(),onCommit};
  const view=render(<GroupEditorPanel {...props} plan={plan}/>);fireEvent.click(screen.getByRole('button',{name:'Delete selected'}));expect(onCommit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep pieces'}));expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Delete selected'}));view.rerender(<GroupEditorPanel {...props} plan={{...plan,name:'Changed'}}/>);fireEvent.click(screen.getByRole('button',{name:'Confirm deletion'}));expect(onCommit).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('project changed');
});
