// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {OnlineMediaPanel} from '../src/OnlineMediaPanel';
import {createSamplePlan} from '../src/domain';
import {ONLINE_MEDIA_LIMITS} from '../src/onlineMedia';
const api=vi.hoisted(()=>({checkOnlineMedia:vi.fn(),listOnlineMedia:vi.fn(async()=>[]),prepareOnlineMedia:vi.fn(),startOnlineMedia:vi.fn(),resumeOnlineMedia:vi.fn(),deleteOnlineMedia:vi.fn(),downloadOnlineMedia:vi.fn(),getOnlineMedia:vi.fn(),replaceOnlineMediaHead:vi.fn(),restoreOnlineMediaCopy:vi.fn()}));
vi.mock('../src/onlineMediaClient',()=>api);
vi.mock('../src/onlineMediaStorage',()=>({listPreparedMedia:vi.fn(async()=>[]),removePreparedMedia:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('performs no network check or upload on mount, leaves every private-media choice off, and surfaces unconfigured storage',async()=>{
 const p=createSamplePlan('My home','metric');render(<OnlineMediaPanel plan={p} onRestored={()=>{}}/>);expect(api.checkOnlineMedia).not.toHaveBeenCalled();expect(api.startOnlineMedia).not.toHaveBeenCalled();api.checkOnlineMedia.mockResolvedValueOnce({available:false,manageAvailable:false,signedIn:true,accountKey:'a'.repeat(64),limits:ONLINE_MEDIA_LIMITS,usedBytes:0,reason:'Storage has not been configured.'});fireEvent.click(screen.getByRole('button',{name:'Check online storage'}));await screen.findByText('Storage has not been configured.');expect(screen.queryByRole('button',{name:'Upload private snapshot'})).toBeNull();expect(api.listOnlineMedia).not.toHaveBeenCalled();
});
it('discards an async preparation when the parent changes project, and never posts it under a later project',async()=>{
 const p=createSamplePlan('First project','metric'),q=createSamplePlan('Second project','metric'),busy=vi.fn(),view=render(<OnlineMediaPanel plan={p} onRestored={()=>{}} onBusyChange={busy}/>);api.checkOnlineMedia.mockResolvedValueOnce({available:true,manageAvailable:true,signedIn:true,accountKey:'a'.repeat(64),limits:ONLINE_MEDIA_LIMITS,usedBytes:0});fireEvent.click(screen.getByRole('button',{name:'Check online storage'}));await screen.findByRole('button',{name:'Prepare locally'});for(const box of screen.getAllByRole('checkbox'))expect((box as HTMLInputElement).checked).toBe(false);
 let finish!:(value:unknown)=>void;api.prepareOnlineMedia.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Prepare locally'}));await waitFor(()=>expect(api.prepareOnlineMedia).toHaveBeenCalledTimes(1));view.rerender(<OnlineMediaPanel plan={q} onRestored={()=>{}} onBusyChange={busy}/>);await act(async()=>{finish({id:'old',manifest:{projectId:p.id,projectName:p.name,totalBytes:1},bytes:new Uint8Array(1)});});expect(screen.queryByText('Review this exact snapshot')).toBeNull();expect(api.startOnlineMedia).not.toHaveBeenCalled();expect(screen.getByText('Prepare a snapshot of Second project')).toBeTruthy();expect(busy).toHaveBeenLastCalledWith(false);
});
