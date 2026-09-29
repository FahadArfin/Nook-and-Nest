// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ProjectLibrary} from '../src/ProjectLibrary';
import {createSamplePlan} from '../src/domain';
import {usePlanner,listLocalPlans,deleteLocalPlan} from '../src/store';
import {ONLINE_MEDIA_LIMITS} from '../src/onlineMedia';
import * as storage from '../src/store';
import * as cloud from '../src/cloudProjects';
vi.mock('../src/cloudProjects',async original=>({...await original<typeof import('../src/cloudProjects')>(),cloudSession:vi.fn(async()=>({signedIn:false,available:false})),cloudProjects:vi.fn(async()=>({projects:[]}))}));
beforeEach(async()=>{window.history.replaceState(null,'','/');sessionStorage.clear();for(const p of await listLocalPlans())await deleteLocalPlan(p.id);usePlanner.getState().replacePlan(createSamplePlan('Existing private home','metric'));HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};vi.stubGlobal('fetch',vi.fn(async()=>Response.json({enabled:false,signedIn:false,canEnroll:false})));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('discovers original ideas in the real library, leaves previews unchanged, and saves a separate credited project only on explicit copy',async()=>{
  const old=usePlanner.getState().plan,close=vi.fn();render(<ProjectLibrary onClose={close}/>);await waitFor(async()=>expect(await listLocalPlans()).toHaveLength(1));
  fireEvent.click(screen.getByRole('button',{name:'Ideas & sharing'}));fireEvent.click((await screen.findAllByRole('button',{name:/^Preview /}))[0]);
  expect(usePlanner.getState().plan).toBe(old);expect(usePlanner.getState().past).toHaveLength(0);expect(await listLocalPlans()).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox',{name:/Create a new private project/}));fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));
  await waitFor(()=>expect(close).toHaveBeenCalledTimes(1));const next=usePlanner.getState().plan;
  expect(next.id).not.toBe(old.id);expect(next.floors[0].id).not.toBe('shared-floor');expect(next.remixAttribution?.credits[0]).toMatchObject({source:'builtin',creator:'Nook & Nest'});
  expect((await listLocalPlans()).find(p=>p.id===old.id)).toEqual(old);expect(usePlanner.getState().past).toHaveLength(0);
});
it('retains the current project when a private copy cannot be saved',async()=>{
  const old=usePlanner.getState().plan,close=vi.fn();render(<ProjectLibrary onClose={close}/>);await waitFor(async()=>expect(await listLocalPlans()).toHaveLength(1));
  const save=storage.savePlan;vi.spyOn(storage,'savePlan').mockImplementation(async p=>{if(p.id!==old.id)throw Error('Storage full');await save(p);});
  fireEvent.click(screen.getByRole('button',{name:'Ideas & sharing'}));fireEvent.click((await screen.findAllByRole('button',{name:/^Preview /}))[0]);fireEvent.click(screen.getByRole('checkbox',{name:/Create a new private project/}));fireEvent.click(screen.getByRole('button',{name:'Make my own private copy'}));
  await screen.findByText('Storage full');expect(usePlanner.getState().plan).toBe(old);expect(close).not.toHaveBeenCalled();expect(await listLocalPlans()).toHaveLength(1);
});
it('keeps online media dormant until checked and guards close and navigation while that request runs',async()=>{
  let finish!:(response:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));const close=vi.fn(),old=usePlanner.getState().plan;
  render(<ProjectLibrary onClose={close}/>);fireEvent.click(screen.getByRole('button',{name:'Backups'}));await screen.findByRole('button',{name:'Check online storage'});expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Check online storage'}));expect(screen.getByRole('button',{name:'Close project library'})).toBeDisabled();expect(screen.getByRole('button',{name:'Projects'})).toBeDisabled();
  fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:true,cancelable:true}));expect(close).not.toHaveBeenCalled();
  await act(async()=>finish(Response.json({available:false,manageAvailable:false,signedIn:false,limits:ONLINE_MEDIA_LIMITS,reason:'Pilot storage is disabled.'})));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Close project library'})).toBeEnabled());expect(usePlanner.getState().plan).toBe(old);expect(vi.mocked(fetch).mock.calls).toHaveLength(1);expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/online-media/status');
});
it('shows a read-only inventory pilot sample and sends only a catalog/dimension preview to the editor',async()=>{
  const proxy=vi.fn(),close=vi.fn(),old=usePlanner.getState().plan;render(<ProjectLibrary onClose={close} onPreviewStockProxy={proxy}/>);
  fireEvent.click(screen.getByRole('button',{name:'Planning'}));fireEvent.click(screen.getByRole('button',{name:'Staging inventory · pilot'}));await screen.findByText('Read-only sample · no real stock or reservations');
  expect(screen.getAllByRole('checkbox',{name:/Reserve /}).every(el=>el.hasAttribute('disabled'))).toBe(true);fireEvent.click(screen.getAllByRole('button',{name:'Preview piece'})[0]);
  expect(proxy).toHaveBeenCalledTimes(1);expect(Object.keys(proxy.mock.calls[0][0]).sort()).toEqual(['catalogId','depthMm','heightMm','widthMm']);expect(usePlanner.getState().plan).toBe(old);expect(close).toHaveBeenCalledTimes(1);expect(vi.mocked(fetch).mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});
it('opens the collaboration invitation surface without joining and offers token-free sign-in recovery',async()=>{
  vi.mocked(cloud.cloudSession).mockResolvedValueOnce({signedIn:false,available:true});const token='z'.repeat(43);render(<ProjectLibrary onClose={()=>{}} onOpenCollaboration={async()=>{}} invitationToken={token}/>);
  await screen.findByRole('region',{name:'Design together'});const signIn=await screen.findByRole('link',{name:/Sign in with ChatGPT to review/});expect(signIn.getAttribute('href')).not.toContain(token);expect(screen.queryByRole('button',{name:'Join private room'})).toBeNull();expect(vi.mocked(fetch).mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true);
});
it('does not replace newer local edits when an online-copy request finishes later',async()=>{
  vi.mocked(cloud.cloudSession).mockResolvedValueOnce({signedIn:true,available:true,userId:'synthetic-owner'});
  let finish!:(value:{revision:number;savedAt:string})=>void;const save=vi.spyOn(cloud,'saveCloudProject').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const old=usePlanner.getState().plan;render(<ProjectLibrary onClose={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Save online as a copy'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  act(()=>usePlanner.getState().rename('Newer unsaved name'));const latest=usePlanner.getState().plan;
  await act(async()=>finish({revision:1,savedAt:new Date().toISOString()}));await screen.findByText(/online copy was saved, but your active project changed/);
  expect(usePlanner.getState().plan).toBe(latest);expect(latest.id).toBe(old.id);expect(latest.name).toBe('Newer unsaved name');
});
