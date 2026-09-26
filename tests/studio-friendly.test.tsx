// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {BlueprintStudio} from '../src/BlueprintStudio';
import {createSamplePlan} from '../src/domain';
import {blueprintPlan} from '../src/blueprint';
import {usePlanner} from '../src/store';
import {loadStudioRecovery,saveStudioRecovery,studioFingerprint} from '../src/studioRecovery';
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  const p=createSamplePlan();p.floors=p.floors.slice(0,1);p.furniture=[];
  usePlanner.getState().replacePlan(blueprintPlan(p,p.floors[0].id,{rooms:[{id:'room',name:'Study',kind:'Office',x:0,z:0,width:4000,depth:3000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]}));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function ready(){await waitFor(()=>expect(screen.queryByText(/Restoring draft/)).toBeNull());}
it('asks for exact dimensions first and hides old properties while drawing',async()=>{
  render(<BlueprintStudio onClose={()=>{}}/>);await ready();
  fireEvent.click(screen.getByRole('button',{name:/^Study/}));
  expect(screen.getByLabelText('Room name')).toBeVisible();
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));
  fireEvent.click(screen.getByRole('button',{name:'Add room by dimensions'}));
  expect(screen.queryByLabelText('Room name')).toBeNull();
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:/^Metric$/}));
  fireEvent.change(screen.getByLabelText('Width metres'),{target:{value:'5.25'}});fireEvent.blur(screen.getByLabelText('Width metres'));
  fireEvent.change(screen.getByLabelText('Depth metres'),{target:{value:'2.75'}});fireEvent.blur(screen.getByLabelText('Depth metres'));
  fireEvent.click(screen.getByRole('button',{name:'Add this room'}));
  expect(screen.getByLabelText('Width metres')).toHaveValue('5.25');expect(screen.getByLabelText('Depth metres')).toHaveValue('2.75');
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  expect(screen.queryByLabelText('Room name')).toBeNull();expect(screen.getByLabelText('New room type')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Done drawing'}));expect(screen.getByRole('button',{name:'Pan drawing'})).toHaveAttribute('aria-pressed','true');
});
it('recovers edited geometry locally without changing 3D or online saves',async()=>{
  const original=usePlanner.getState().plan,id=original.floors[0].id;
  let ui=render(<BlueprintStudio onClose={()=>{}}/>);await ready();
  fireEvent.click(screen.getByRole('button',{name:/^Study/}));fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'Recovered study'}});
  await waitFor(async()=>expect((await loadStudioRecovery(original.id,id))?.draft.rooms[0].name).toBe('Recovered study'),{timeout:3000});
  expect(usePlanner.getState().plan).toBe(original);expect(usePlanner.getState().past).toHaveLength(0);
  ui.unmount();ui=render(<BlueprintStudio onClose={()=>{}}/>);await ready();
  expect(screen.getByRole('button',{name:/^Recovered study/})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(usePlanner.getState().plan.studioDrafts?.[id].draft.rooms[0].name).toBe('Recovered study'));
  expect(usePlanner.getState().plan.floors).toEqual(original.floors);
});
it('restores unfinished corners but rejects recovery from a different 3D layout',async()=>{
  const p=usePlanner.getState().plan,id=p.floors[0].id;
  const draft={rooms:[{id:'r',name:'Recovered room',kind:'Living' as const,x:0,z:0,width:3000,depth:3000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]};
  await saveStudioRecovery(p.id,id,{fingerprint:studioFingerprint(p),savedAt:new Date().toISOString(),draft,corners:[{x:4000,z:0},{x:6000,z:0}],units:'imperial',imageScale:10,calibrated:true,view:{x:0,z:0,width:10000,height:10000},page:1,rotation:0});
  const ui=render(<BlueprintStudio onClose={()=>{}}/>);await ready();expect(screen.getByText('2 corners · any angle')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Done drawing'}));expect(screen.getByRole('alert')).toHaveTextContent('Close or cancel');
  ui.unmount();usePlanner.getState().replacePlan({...p,gridSizeMm:p.gridSizeMm+1});
  render(<BlueprintStudio onClose={()=>{}}/>);await ready();expect(screen.queryByRole('button',{name:/^Recovered room/})).toBeNull();
});
it('locates overlapping rooms from review and shows a geometry highlight',async()=>{
  const p=usePlanner.getState().plan,id=p.floors[0].id;
  p.studioDrafts={[id]:{draft:{rooms:[{id:'a',name:'A',kind:'Living',x:0,z:0,width:3000,depth:3000,enclosed:true},{id:'b',name:'B',kind:'Living',x:2000,z:0,width:3000,depth:3000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]},savedAt:new Date().toISOString(),imageScale:10,calibrated:true,view:{x:0,z:0,width:10000,height:10000}}};
  render(<BlueprintStudio onClose={()=>{}}/>);await ready();
  fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));
  expect(screen.getByRole('button',{name:'Confirm & create 3D home'})).toBeDisabled();expect(document.querySelector('[data-review-issue="a"]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Locate issue 1'}));expect(screen.getByLabelText('Room name')).toHaveValue('A');
});
