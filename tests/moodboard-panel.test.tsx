// @vitest-environment jsdom
import React,{useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {createSamplePlan} from '../src/domain';
import {MoodboardPanel} from '../src/MoodboardPanel';
import type {KitPreviewRequest} from '../src/FurnitureKitsPanel';
import type {MoodboardPlan} from '../src/moodboards';
import type {PersonalPhotoAsset} from '../src/personalMedia';
import {preparePersonalPhoto} from '../src/personalMedia';
import {importPersonalAssets} from '../src/personalStorage';

vi.mock('../src/PersonalFurniturePanel',()=>({PersonalPhoto:()=>null}));
vi.mock('../src/personalMedia',()=>({preparePersonalPhoto:vi.fn()}));
vi.mock('../src/personalStorage',()=>({importPersonalAssets:vi.fn(async()=>{}),loadPersonalPhoto:vi.fn(async()=>undefined)}));
afterEach(()=>{cleanup();vi.clearAllMocks()});

it('keeps palette preview uncommitted, discards it, then applies exactly one current candidate',()=>{
  const plan:MoodboardPlan=createSamplePlan(),floorId=plan.floors[0].id,date=new Date().toISOString();plan.furniture=[{id:'chair',catalogId:'armchair',floorId,x:1000,z:1000,rotation:0,widthMm:800,depthMm:900,heightMm:900,variant:'cream'}];plan.moodboards={version:1,boards:[{id:'board',name:'Calm room',createdAt:date,updatedAt:date,pins:[],palette:[{id:'sage',name:'Sage',color:'#809578'}],bindings:[{paletteId:'sage',slotId:'upholstery-textured'}],target:{scope:'floor',floorId}}]};
  let request:KitPreviewRequest|undefined;const apply=vi.fn(),discard=vi.fn(),commit=vi.fn();
  function Harness(){const [activeId,setActiveId]=useState<string>();return <MoodboardPanel plan={plan} floorId={floorId} onClose={()=>{}} onCommit={commit} preview={{activeId,stage:next=>{request=next;setActiveId('candidate');return 'candidate'},apply:id=>{apply(id);setActiveId(undefined)},discard:id=>{discard(id);setActiveId(undefined)}}}/>}
  render(<Harness/>);fireEvent.change(screen.getByLabelText('Saved board'),{target:{value:'board'}});fireEvent.click(screen.getByRole('button',{name:'Preview linked palette'}));expect(request?.plan.furniture[0].materialColors).toEqual({'upholstery-textured':'#809578'});expect(plan.furniture[0].materialColors).toBeUndefined();expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Discard preview'}));expect(discard).toHaveBeenCalledOnce();expect(commit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Preview linked palette'}));fireEvent.click(screen.getByRole('button',{name:'Apply design'}));expect(apply).toHaveBeenCalledExactlyOnceWith('candidate');
});

it('rejects a stale async image result before writing private media or committing the edited board',async()=>{
  const plan=createSamplePlan(),floorId=plan.floors[0].id,commit=vi.fn(),stage=vi.fn();let resolve!:(asset:PersonalPhotoAsset)=>void;vi.mocked(preparePersonalPhoto).mockReturnValue(new Promise(r=>{resolve=r}));
  const props={plan,floorId,onCommit:commit,onClose:()=>{},preview:{stage,apply:vi.fn(),discard:vi.fn()}},view=render(<MoodboardPanel {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'New moodboard'}));fireEvent.change(screen.getByLabelText('Private image'),{target:{files:[new File(['image'],'my-room.png',{type:'image/png'})]}});
  const changed={...plan,name:'A newer project edit'};view.rerender(<MoodboardPanel {...props} plan={changed}/>);
  await act(async()=>resolve({version:1,id:'sha256:'+'a'.repeat(64),original:'local',preview:'local',width:1,height:1,createdAt:new Date().toISOString()}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('project changed'));
  expect(importPersonalAssets).not.toHaveBeenCalled();expect(commit).not.toHaveBeenCalled();expect(stage).not.toHaveBeenCalled();
});
