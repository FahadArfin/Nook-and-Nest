// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {Welcome} from '../src/Welcome';
import {BlueprintControls} from '../src/BlueprintControls';
import {createBlankPlan,createSamplePlan,encodeShare} from '../src/domain';
import {usePlanner,listLocalPlans,savePlan,deleteLocalPlan,loadPlan} from '../src/store';
const Editor=({onHome}:{onHome?:()=>void})=><section aria-label="Editor"><button onClick={onHome}>Home</button></section>;
beforeEach(async()=>{window.history.replaceState(null,'','/');for(const p of await listLocalPlans())await deleteLocalPlan(p.id);usePlanner.getState().replacePlan(createBlankPlan());HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({signedIn:false,available:false}),{headers:{'content-type':'application/json'}})));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens on the menu without saving a starter project, and creates a completely blank 3D plan',async()=>{
 render(<Welcome Editor={Editor}/>);const button=screen.getByRole('button',{name:/Open 3D editor/});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));
 expect(screen.queryByRole('region',{name:'Editor'})).toBeNull();expect(await listLocalPlans()).toEqual([]);
 fireEvent.click(button);expect(screen.getByRole('region',{name:'Editor'})).toBeTruthy();const p=usePlanner.getState().plan;expect(p.furniture).toEqual([]);expect(p.floors).toHaveLength(1);expect(p.floors[0].cells).toEqual([]);expect(p.floors[0].walls).toEqual([]);
});
it('keeps previous saves in My projects, opens them explicitly, and returns home safely',async()=>{
 const p=createSamplePlan('Saved home');await savePlan(p);render(<Welcome Editor={Editor}/>);
 const button=screen.getByRole('button',{name:/My projects/});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));expect(screen.queryByRole('region',{name:'Editor'})).toBeNull();fireEvent.click(button);
 const library=await screen.findByRole('dialog',{name:'Your projects'});const title=await within(library).findByText('Saved home');fireEvent.click(within(title.closest('article')!).getByRole('button',{name:'Open'}));await screen.findByRole('region',{name:'Editor'});expect(usePlanner.getState().plan).toEqual(p);
 fireEvent.click(screen.getByText('Home'));await screen.findByRole('navigation',{name:'Start planning'});expect((await listLocalPlans()).map(p=>p.name)).toEqual(['Saved home']);
});
it('confirms local deletion and does not recreate the deleted active project while browsing',async()=>{
 const p=createSamplePlan('Remove me');await savePlan(p);render(<Welcome Editor={Editor}/>);const button=screen.getByRole('button',{name:/My projects/});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));fireEvent.click(button);await within(await screen.findByRole('dialog',{name:'Your projects'})).findByText('Remove me');
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(await screen.findByLabelText('Actions for Remove me'));fireEvent.click(screen.getByRole('button',{name:'Delete local copy'}));expect(await loadPlan()).toEqual(p);
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Delete local copy'}));await screen.findByText('Deleted “Remove me”.');expect(await listLocalPlans()).toEqual([]);expect(await loadPlan()).toBeUndefined();confirm.mockRestore();
});
it('preserves explicit shared-plan links instead of replacing them with a blank project',async()=>{
 const p=createSamplePlan('Shared home');window.history.replaceState(null,'','/#plan='+encodeShare(p));render(<Welcome Editor={Editor}/>);await screen.findByRole('region',{name:'Editor'});expect(usePlanner.getState().plan.floors).toEqual(p.floors);expect(usePlanner.getState().plan.id).not.toBe(p.id);
});

it('starts floor-plan drafting empty and cancels back to the menu without creating a save',async()=>{
 render(<Welcome Editor={Editor}/>);const button=screen.getByRole('button',{name:/Create floor plan/});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));fireEvent.click(button);
 expect(await screen.findByText('Floor plan studio')).toBeTruthy();expect(usePlanner.getState().plan.floors[0].cells).toEqual([]);expect(await listLocalPlans()).toEqual([]);
 fireEvent.click(screen.getByLabelText('Close floor plan studio'));await waitFor(()=>expect(screen.queryByText('Floor plan studio')).toBeNull());expect(screen.queryByRole('region',{name:'Editor'})).toBeNull();
});
it('browses an empty library without creating a phantom project',async()=>{
 render(<Welcome Editor={Editor}/>);const button=screen.getByRole('button',{name:/My projects/});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));fireEvent.click(button);
 await screen.findByText('No projects yet. Your next cozy space starts here.');expect(await listLocalPlans()).toEqual([]);
});

it('follows live OS appearance by default, preserves manual preference, and cleans up listeners',async()=>{
 localStorage.clear();let matches=true;const listeners=new Set<()=>void>();
 vi.stubGlobal('matchMedia',vi.fn(()=>({get matches(){return matches;},addEventListener:(_name:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_name:string,fn:()=>void)=>listeners.delete(fn)})));
 const {container,unmount}=render(<Welcome Editor={Editor}/>);await waitFor(()=>expect(screen.getByRole('button',{name:/Open 3D editor/}).hasAttribute('disabled')).toBe(false));
 const page=()=>container.querySelector('.welcome-page')!;const before=usePlanner.getState().plan;
 expect(page().getAttribute('data-theme')).toBe('dark');fireEvent.click(screen.getByLabelText('Background preferences'));expect(screen.getByLabelText('Use system theme').getAttribute('aria-pressed')).toBe('true');
 const {act}=await import('@testing-library/react');act(()=>{matches=false;listeners.forEach(fn=>fn());});expect(page().getAttribute('data-theme')).toBe('light');
 fireEvent.click(screen.getByLabelText('Use dark theme'));expect(localStorage.getItem('nook-welcome-theme')).toBe('dark');
 act(()=>{matches=true;listeners.forEach(fn=>fn());matches=false;listeners.forEach(fn=>fn());});expect(page().getAttribute('data-theme')).toBe('dark');expect(usePlanner.getState().plan).toBe(before);expect(await listLocalPlans()).toEqual([]);
 unmount();expect(listeners.size).toBe(0);
 const next=render(<Welcome Editor={Editor}/>);expect(next.container.querySelector('main')?.getAttribute('data-theme')).toBe('dark');
 fireEvent.click(screen.getByLabelText('Background preferences'));fireEvent.click(screen.getByLabelText('Use system theme'));expect(next.container.querySelector('main')?.getAttribute('data-theme')).toBe('light');
 localStorage.clear();
});
it('keeps the appearance control usable when browser storage is blocked',async()=>{
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 const {container}=render(<Welcome Editor={Editor}/>);fireEvent.click(screen.getByLabelText('Use dark theme'));expect(container.querySelector('main')?.getAttribute('data-theme')).toBe('dark');fireEvent.click(screen.getByLabelText('Use light theme'));expect(container.querySelector('main')?.getAttribute('data-theme')).toBe('light');get.mockRestore();set.mockRestore();
});

it('shows only the three most recent device projects and opens a chosen card',async()=>{
 for(let i=0;i<4;i++)await savePlan({...createSamplePlan('Recent '+i),updatedAt:`2026-09-0${i+1}T12:00:00.000Z`});
 render(<Welcome Editor={Editor}/>);fireEvent.mouseEnter(screen.getByRole('button',{name:'Recents'}).parentElement!);const section=await screen.findByRole('region',{name:'Recent projects'});await within(section).findByText('Recent 3');expect(within(section).queryByText('Recent 0')).toBeNull();expect(within(section).getAllByRole('button')).toHaveLength(3);fireEvent.click(within(section).getByRole('button',{name:/Recent 2/}));expect(usePlanner.getState().plan.name).toBe('Recent 2');
});

it('sorts projects through rounded toggle buttons without opening or changing a plan',async()=>{
 await savePlan({...createSamplePlan('Zebra'),updatedAt:'2026-09-09T12:00:00.000Z'});await savePlan({...createSamplePlan('Aspen'),updatedAt:'2026-09-08T12:00:00.000Z'});render(<Welcome Editor={Editor}/>);const entry=screen.getByRole('button',{name:/My projects/});await waitFor(()=>expect(entry.hasAttribute('disabled')).toBe(false));fireEvent.click(entry);const dialog=await screen.findByRole('dialog',{name:'Your projects'});await within(dialog).findByText('Zebra');const sorts=within(dialog).getByRole('group',{name:'Sort projects'});fireEvent.click(within(sorts).getByRole('button',{name:'Name A–Z'}));expect(within(sorts).getByRole('button',{name:'Name A–Z'}).getAttribute('aria-pressed')).toBe('true');expect(within(dialog).getAllByRole('article')[0].textContent).toContain('Aspen');expect(screen.queryByRole('region',{name:'Editor'})).toBeNull();
});

it('navigates from 3D to Studio and back/forward with native browser history',async()=>{
 const Navigable=({onHome}:{onHome?:()=>void})=><section aria-label="Editor"><BlueprintControls busy={false} onPreview={()=>{}} onBusy={()=>{}} onHome={onHome}/></section>;
 render(<Welcome Editor={Navigable}/>);const start=screen.getByRole('button',{name:/Open 3D editor/});await waitFor(()=>expect(start.hasAttribute('disabled')).toBe(false));fireEvent.click(start);fireEvent.click(screen.getByRole('button',{name:'Floor plan'}));await screen.findByRole('dialog',{name:'Floor plan studio'});const plan=usePlanner.getState().plan;window.history.back();await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Floor plan studio'})).toBeNull());expect(screen.getByRole('region',{name:'Editor'})).toBeTruthy();expect(usePlanner.getState().plan).toBe(plan);window.history.forward();const studio=await screen.findByRole('dialog',{name:'Floor plan studio'});fireEvent.click(within(within(studio).getByRole('toolbar',{name:'Floor plan editing'})).getByRole('button',{name:'Add room by dimensions'}));const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);window.history.back();await waitFor(()=>expect(confirm).toHaveBeenCalled());await waitFor(()=>expect(window.history.state.nookNavigation.screen).toBe('studio-editor'));expect(screen.getByRole('dialog',{name:'Floor plan studio'})).toBeTruthy();confirm.mockReturnValue(true);window.history.back();await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Floor plan studio'})).toBeNull());confirm.mockRestore();
});
