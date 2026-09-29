// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {deleteDB} from 'idb';
import {webcrypto} from 'node:crypto';
import {useState} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {StillRenderPanel} from '../src/StillRenderPanel';
import {DesignAssistantPanel} from '../src/DesignAssistantPanel';
import {makeStillRecord} from '../src/stillRender';
import {saveStillRecord} from '../src/stillRenderStorage';
import * as server from '../src/localStillRender';
import type {PlanDocumentV1} from '../src/types';
vi.mock('../src/localStillRender',async original=>({...await original<typeof import('../src/localStillRender')>(),discoverStillServer:vi.fn(),startStillJob:vi.fn(),checkStillJob:vi.fn()}));
const endpoint='https://my-renderer.example/v1';
function fixture(){const plan=createSamplePlan();plan.gridSizeMm=1000;plan.floors=[{...plan.floors[0],cells:rectangleCells(10,10)}];const camera={version:1 as const,kind:'orbit' as const,floorId:plan.floors[0].id,target:{x:4,y:1,z:4},alpha:1,beta:1,radius:6,mode:0 as const,fov:.8};return {plan,camera,media:[{id:'saved-shot',title:'Living view',caption:'',kind:'render' as const,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAg',camera,seconds:5}]};}
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',vi.fn());vi.mocked(server.discoverStillServer).mockResolvedValue({endpoint,schema:'nook-still-render/1',idempotency:'request-id',cancelByRequestId:true,resultType:'inline-image',models:[{id:'local',name:'My local renderer',modes:['fixed-geometry'],qualities:['preview','final']}]});});
afterEach(async()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();await deleteDB('nook-still-render-queue');});
describe('explicit local design/render workflows',()=>{
 it('does not connect by default and requires separate image, server and submission choices',async()=>{
  const {plan,media}=fixture();vi.mocked(server.startStillJob).mockImplementation(async record=>record);render(<StillRenderPanel plan={plan} media={media}/>);expect(fetch).not.toHaveBeenCalled();expect(server.discoverStillServer).not.toHaveBeenCalled();fireEvent.change(screen.getByRole('combobox',{name:'Saved design camera'}),{target:{value:'saved-shot'}});expect(screen.getByRole('checkbox',{name:/Include this image/})).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Add exact snapshot to queue'}));await screen.findByText('Ready locally');expect(server.startStillJob).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox',{name:'Server address'}),{target:{value:endpoint}});expect(screen.getByRole('button',{name:'Check still capability'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:/This is my server/}));fireEvent.click(screen.getByRole('button',{name:'Check still capability'}));await screen.findByRole('combobox',{name:'Still model'});expect(screen.getByRole('button',{name:'Start selected job on my server'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:/Send this exact snapshot/}));fireEvent.click(screen.getByRole('button',{name:'Start selected job on my server'}));await waitFor(()=>expect(server.startStillJob).toHaveBeenCalledTimes(1));const sent=vi.mocked(server.startStillJob).mock.calls[0][0];expect(sent.request.shot.referenceImage).toBeUndefined();expect(sent.request.settings.mode).toBe('fixed-geometry');expect(fetch).not.toHaveBeenCalled();
 });
 it('recovers a persisted uncertain request without connecting, polling or offering a second POST',async()=>{
  const {plan,media,camera}=fixture();let record=await saveStillRecord(await makeStillRecord(plan,{id:'saved-shot',name:'Living view',camera},'preview','fixed-geometry',false),0);record=await saveStillRecord({...record,state:'submitting',connection:{endpoint,model:'local'}},record.revision);render(<StillRenderPanel plan={plan} media={media}/>);await screen.findByText('Submission may be in progress');expect(screen.queryByRole('button',{name:'Start selected job on my server'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Check status by request ID'})).toBeDisabled();expect(server.startStillJob).not.toHaveBeenCalled();expect(server.checkStillJob).not.toHaveBeenCalled();expect(server.discoverStillServer).not.toHaveBeenCalled();
 });
 it('stages one reversible idea and invalidates it after the parent home changes',async()=>{
  const {plan}=fixture(),apply=vi.fn(),discard=vi.fn(),stage=vi.fn();function Harness({value}:{value:PlanDocumentV1}){const [activeId,setActiveId]=useState<string>();return <DesignAssistantPanel plan={value} floorId={value.floors[0].id} preview={{activeId,stage(request){stage(request);setActiveId('draft');return 'draft';},apply(id){apply(id);setActiveId(undefined);},discard(id){discard(id);setActiveId(undefined);}}}/>;}
  const {rerender}=render(<Harness value={plan}/>);fireEvent.click(screen.getByRole('button',{name:'Find arrangements'}));const choices=await screen.findAllByRole('button',{name:'Preview this arrangement'});expect(choices.length).toBeGreaterThan(1);expect(stage).not.toHaveBeenCalled();expect(apply).not.toHaveBeenCalled();fireEvent.click(choices[0]);expect(stage).toHaveBeenCalledTimes(1);expect(stage.mock.calls[0][0].base).toBe(plan);fireEvent.click(screen.getByRole('button',{name:'Apply arrangement'}));expect(apply).toHaveBeenCalledExactlyOnceWith('draft');
  fireEvent.click(screen.getByRole('button',{name:'Find arrangements'}));fireEvent.click((await screen.findAllByRole('button',{name:'Preview this arrangement'}))[0]);rerender(<Harness value={{...plan,name:'Changed while reviewing'}}/>);await waitFor(()=>expect(screen.queryByRole('button',{name:'Apply arrangement'})).not.toBeInTheDocument());expect(discard).toHaveBeenCalledWith('draft');expect(fetch).not.toHaveBeenCalled();
 });
});
