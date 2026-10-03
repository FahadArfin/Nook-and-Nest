// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {createBlankPlan} from '../src/domain';
import {DeliveryPlanningPanel} from '../src/DeliveryPlanningPanel';
afterEach(cleanup);
it('keeps a new route local until explicit save and preserves blank fields as unknown',()=>{
  const plan=createBlankPlan('Delivery','metric'),onCommit=vi.fn();render(<DeliveryPlanningPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add route step'}));fireEvent.change(screen.getByLabelText('Route step name'),{target:{value:'Front door'}});fireEvent.change(screen.getByLabelText('Clear width (mm)'),{target:{value:'900'}});expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Save route step'}));expect(onCommit).toHaveBeenCalledOnce();expect(onCommit.mock.calls[0][0]).toBe(plan);expect(onCommit.mock.calls[0][1].deliveryPlanning.steps[0]).toMatchObject({name:'Front door',measurements:{widthMm:900,heightMm:null}});
});
it('searches placed furniture and clears model dimensions when switching to packaged entry',()=>{
  const plan=createBlankPlan('Delivery','metric');plan.furniture=[{id:'chair',catalogId:'armchair',floorId:plan.floors[0].id,x:0,z:0,rotation:0,widthMm:800,depthMm:900,heightMm:700,variant:'sage'}];const onCommit=vi.fn();render(<DeliveryPlanningPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Items'}));fireEvent.change(screen.getByLabelText('Find placed furniture'),{target:{value:'Nook'}});fireEvent.click(screen.getByRole('button',{name:/Use Nook chair/i}));
  expect((screen.getByLabelText('Item width (mm)') as HTMLInputElement).value).toBe('800');fireEvent.click(within(screen.getByRole('group',{name:'Dimension basis'})).getByRole('button',{name:'Packaged'}));expect((screen.getByLabelText('Item width (mm)') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Save transport item'}));expect(onCommit.mock.calls[0][1].deliveryPlanning.items[0]).toMatchObject({basis:'packaged',dimensionSource:'entered',widthMm:null,depthMm:null,heightMm:null});
});
it('stores decimal inches as millimetres and toggles the display without resizing the draft',()=>{
  const plan=createBlankPlan('Delivery','imperial'),onCommit=vi.fn();render(<DeliveryPlanningPanel plan={plan} onCommit={onCommit}/>);fireEvent.click(screen.getByRole('button',{name:'Add route step'}));fireEvent.change(screen.getByLabelText('Route step name'),{target:{value:'Entrance'}});fireEvent.change(screen.getByLabelText('Clear width (in)'),{target:{value:'36'}});
  fireEvent.click(screen.getByRole('button',{name:'Millimetres'}));expect((screen.getByLabelText('Clear width (mm)') as HTMLInputElement).value).toBe('914.4');fireEvent.click(screen.getByRole('button',{name:'Save route step'}));expect(onCommit.mock.calls[0][1].deliveryPlanning.steps[0].measurements.widthMm).toBeCloseTo(914.4,8);
});
it('retains an open draft after external changes and blocks save and removal until reopened',()=>{
  const plan=createBlankPlan('Delivery','metric');plan.deliveryPlanning={version:1,items:[],steps:[{id:'door',name:'Front',kind:'door',notes:'',measurements:{widthMm:900,heightMm:2000}}]};const onCommit=vi.fn(),view=render(<DeliveryPlanningPanel plan={plan} onCommit={onCommit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit Front'}));fireEvent.change(screen.getByLabelText('Route step name'),{target:{value:'Retained draft'}});view.rerender(<DeliveryPlanningPanel plan={{...plan,name:'Newer'}} onCommit={onCommit}/>);
  expect((screen.getByLabelText('Route step name') as HTMLInputElement).value).toBe('Retained draft');expect((screen.getByRole('button',{name:'Save route step'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Remove route step'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByRole('alert').textContent).toMatch(/project changed/i);expect(onCommit).not.toHaveBeenCalled();
});
it('prevents Add, Edit and furniture Copy from replacing a draft until explicit cancel or save',()=>{
  const plan=createBlankPlan('Delivery','metric'),onCommit=vi.fn();plan.furniture=[{id:'chair',catalogId:'armchair',floorId:plan.floors[0].id,x:0,z:0,rotation:0,widthMm:800,depthMm:900,heightMm:700,variant:'sage'}];plan.deliveryPlanning={version:1,steps:[{id:'front',name:'Front',kind:'door',notes:'',measurements:{widthMm:900,heightMm:2000}}],items:[{id:'box',name:'Box',notes:'',widthMm:400,depthMm:500,heightMm:600,basis:'packaged',orientation:'wdh',dimensionSource:'entered'}]};
  render(<DeliveryPlanningPanel plan={plan} onCommit={onCommit}/>);fireEvent.click(screen.getByRole('button',{name:'Edit Front'}));fireEvent.change(screen.getByLabelText('Route step name'),{target:{value:'Unsaved entrance'}});
  for(const name of ['Add route step','Edit Front']){const action=screen.getByRole('button',{name}) as HTMLButtonElement;expect(action.disabled).toBe(true);fireEvent.click(action);}
  fireEvent.click(screen.getByRole('button',{name:'Items'}));for(const name of ['Add manual item','Edit Box',/Use Nook chair/]){const action=screen.getByRole('button',{name}) as HTMLButtonElement;expect(action.disabled).toBe(true);fireEvent.click(action);}
  fireEvent.click(screen.getByRole('button',{name:'Route'}));expect((screen.getByLabelText('Route step name') as HTMLInputElement).value).toBe('Unsaved entrance');expect(onCommit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Cancel edit'}));expect((screen.getByRole('button',{name:'Edit Front'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Items'}));fireEvent.click(screen.getByRole('button',{name:'Add manual item'}));fireEvent.change(screen.getByLabelText('Transport item name'),{target:{value:'New box'}});fireEvent.click(screen.getByRole('button',{name:'Save transport item'}));expect(onCommit).toHaveBeenCalledOnce();expect((screen.getByRole('button',{name:'Add manual item'}) as HTMLButtonElement).disabled).toBe(false);
});
