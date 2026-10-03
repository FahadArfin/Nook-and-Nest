// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {createSamplePlan} from '../src/domain';
import {saveLayoutAlternative} from '../src/layoutAlternatives';
import {validatePlan} from '../src/planValidation';
import {LayoutAlternativesPanel} from '../src/LayoutAlternativesPanel';
afterEach(cleanup);

it('warns that restoring an older layout clears newer home records, then applies only on confirmation',()=>{
 let plan=createSamplePlan('Home','metric');
 plan=saveLayoutAlternative(plan,'Before move-in',plan.floors[0].id,validatePlan);
 plan.homeManual={version:1,records:[{id:'washer',name:'Washer',notes:'Later maintenance',history:[]}]};
 const apply=vi.fn();render(<LayoutAlternativesPanel plan={plan} activeFloorId={plan.floors[0].id} onChange={vi.fn()} onApply={apply}/>);
 expect(screen.getByText('Different Home manual records')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Use Before move-in'}));
 expect(screen.getByText(/also replaces Home manual.*absent from this snapshot will be cleared/)).toBeTruthy();
 expect(apply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm layout change'}));
 expect(apply).toHaveBeenCalledTimes(1);expect(apply.mock.calls[0][1].homeManual).toBeUndefined();
 expect(plan.homeManual.records).toHaveLength(1);
});
