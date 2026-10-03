// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {createBlankPlan} from '../src/domain';
import {HomeManualPanel} from '../src/HomeManualPanel';
afterEach(cleanup);

it('keeps ownership edits private until an explicit save and supports blank unknown dates',()=>{
  const plan=createBlankPlan('Home','metric'),onCommit=vi.fn();render(<HomeManualPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add home record'}));fireEvent.change(screen.getByLabelText('Record name'),{target:{value:'Hall radiator'}});fireEvent.change(screen.getByLabelText('Manual link'),{target:{value:'https://example.com/radiator.pdf'}});
  expect(onCommit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save home record'}));expect(onCommit).toHaveBeenCalledOnce();
  expect(onCommit.mock.calls[0][0]).toBe(plan);expect(onCommit.mock.calls[0][1].homeManual.records[0]).toMatchObject({name:'Hall radiator',manualUrl:'https://example.com/radiator.pdf',history:[]});expect(onCommit.mock.calls[0][1].homeManual.records[0].purchasedOn).toBeUndefined();
});
it('retains an open stale draft and blocks its save after external changes',()=>{
  const plan=createBlankPlan('Home','metric'),onCommit=vi.fn(),view=render(<HomeManualPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add home record'}));fireEvent.change(screen.getByLabelText('Record name'),{target:{value:'My unfinished record'}});view.rerender(<HomeManualPanel plan={{...plan,name:'Newer home'}} onCommit={onCommit}/>);
  expect((screen.getByRole('button',{name:'Save home record'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByLabelText('Record name') as HTMLInputElement).value).toBe('My unfinished record');expect(screen.getByRole('alert').textContent).toContain('project changed');expect(onCommit).not.toHaveBeenCalled();
});
it('shows a deleted furniture link and selects nothing for handover by default',()=>{
  const plan=createBlankPlan('Home','metric');plan.homeManual={version:1,records:[{id:'a',name:'Bedroom lamp',furnitureId:'deleted',notes:'',history:[]}]};render(<HomeManualPanel plan={plan} onCommit={()=>{}}/>);
  expect(screen.getByText(/linked furniture is no longer/i)).toBeTruthy();expect((screen.getByRole('button',{name:'Print selected handover'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox',{name:'Include Bedroom lamp in handover'}));expect((screen.getByRole('button',{name:'Print selected handover'}) as HTMLButtonElement).disabled).toBe(false);
});
it('completes saved maintenance in one commit and leaves the next date blank',()=>{
  const plan=createBlankPlan('Home','metric');plan.homeManual={version:1,records:[{id:'a',name:'Washer',notes:'',maintenanceTask:'Clean filter',nextMaintenanceOn:'2026-01-01',history:[]}]};const onCommit=vi.fn();render(<HomeManualPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Record service for Washer'}));fireEvent.change(screen.getByLabelText('Completed on'),{target:{value:'2026-01-01'}});fireEvent.change(screen.getByLabelText('Service notes'),{target:{value:'Cleaned'}});expect((screen.getByLabelText('Next maintenance date (optional)') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Save completed maintenance'}));expect(onCommit).toHaveBeenCalledOnce();expect(onCommit.mock.calls[0][1].homeManual.records[0].history[0]).toMatchObject({task:'Clean filter',completedOn:'2026-01-01',notes:'Cleaned'});expect(onCommit.mock.calls[0][1].homeManual.records[0].nextMaintenanceOn).toBeUndefined();
});
it('requires explicit record removal confirmation and honors disabled editing',()=>{
  const plan=createBlankPlan('Home','metric');plan.homeManual={version:1,records:[{id:'a',name:'Washer',notes:'',history:[]}]};const onCommit=vi.fn(),view=render(<HomeManualPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Remove Washer'}));expect(onCommit).not.toHaveBeenCalled();fireEvent.click(within(screen.getByRole('group',{name:'Remove Washer confirmation'})).getByRole('button',{name:'Keep record'}));expect(onCommit).not.toHaveBeenCalled();
  view.rerender(<HomeManualPanel plan={plan} disabled onCommit={onCommit}/>);expect((screen.getByRole('button',{name:'Add home record'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Edit Washer'}) as HTMLButtonElement).disabled).toBe(true);
});
