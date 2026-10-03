// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {createBlankPlan,rectangleCells} from '../src/domain';
import {CompareHomesPanel} from '../src/CompareHomesPanel';
import * as storage from '../src/homeComparisonStorage';
import * as personal from '../src/personalStorage';
import * as comparison from '../src/homeComparison';
import type {PersonalCollectionItem} from '../src/personalItems';

vi.mock('../src/homeComparisonStorage',()=>({readHomeComparisonWorkspace:vi.fn(),saveHomeComparisonWorkspace:vi.fn(),saveHomeComparisonCopies:vi.fn()}));
vi.mock('../src/personalStorage',()=>({listPersonalItems:vi.fn()}));
const item:PersonalCollectionItem={version:1,id:'owned-chair',name:'My measured chair',catalogId:'dining-chair',widthMm:731.5,depthMm:650,heightMm:900,status:'keep',revision:1,createdAt:'2026-10-03T12:00:00.000Z',updatedAt:'2026-10-03T12:00:00.000Z'};
const home=(name:string)=>{const p=createBlankPlan(name,'metric');p.gridSizeMm=1000;p.floors[0].cells=rectangleCells(8,8);return p;};
beforeEach(()=>{vi.mocked(personal.listPersonalItems).mockResolvedValue([item]);vi.mocked(storage.readHomeComparisonWorkspace).mockResolvedValue(undefined);vi.mocked(storage.saveHomeComparisonWorkspace).mockImplementation(async w=>({...w,revision:w.revision+1}));vi.mocked(storage.saveHomeComparisonCopies).mockImplementation(async(w,copies)=>({...w,revision:w.revision+1,homes:w.homes.map((h,i)=>({...h,copyId:copies[i].id}))}));vi.spyOn(comparison,'fingerprintHomePlan').mockResolvedValue('sha256:'+'a'.repeat(64));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});

it('requires explicit private home and owned item choices, captures once, compares unknowns and saves independent copies before opening one',async()=>{
 const a=home('Candidate A'),b=home('Candidate B'),refresh=vi.fn(async()=>[a,b]),open=vi.fn(),online=vi.fn();
 render(<CompareHomesPanel localPlans={[a,b]} onlineProjects={[]} onLoadOnline={online} onRefreshLocal={refresh} onOpenCopy={open}/>);
 await screen.findByRole('checkbox',{name:/My measured chair/});expect((screen.getByRole('button',{name:'Capture comparison snapshot'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox',{name:/Candidate A/}));fireEvent.click(screen.getByRole('checkbox',{name:/Candidate B/}));fireEvent.click(screen.getByRole('checkbox',{name:/My measured chair/}));fireEvent.click(screen.getByRole('button',{name:'Capture comparison snapshot'}));
 await screen.findByText(/Frozen furniture snapshot/);expect(online).not.toHaveBeenCalled();expect(storage.saveHomeComparisonCopies).not.toHaveBeenCalled();expect(screen.getByText(/731.5 × 650 × 900 mm/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Compare these homes'}));await screen.findByRole('table',{name:'Equivalent fit and clearance summaries'});expect(screen.getAllByText(/Property measurements and clear room boundaries are unverified/).length).toBe(2);
 fireEvent.click(screen.getByRole('button',{name:'Create 2 editable copies'}));await waitFor(()=>expect(storage.saveHomeComparisonCopies).toHaveBeenCalledOnce());expect(open).not.toHaveBeenCalled();
 const copies=vi.mocked(storage.saveHomeComparisonCopies).mock.calls[0][1];expect(copies.map(c=>c.furniture[0].widthMm)).toEqual([731.5,731.5]);expect(a.furniture).toHaveLength(0);expect(b.furniture).toHaveLength(0);refresh.mockResolvedValue([a,b,...copies]);
 fireEvent.click(screen.getByRole('button',{name:'Open Candidate A copy'}));await waitFor(()=>expect(open).toHaveBeenCalledWith(copies[0]));
});

it('reloads edited copies against the retained snapshot and reports removed or resized belongings without recreating them',async()=>{
 const a=home('Candidate A'),b=home('Candidate B'),w=comparison.createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[item]);const ca=comparison.buildHomeComparisonCopy(a,w.homes[0],w.snapshot),cb=comparison.buildHomeComparisonCopy(b,w.homes[1],w.snapshot);w.homes[0].copyId=ca.id;w.homes[1].copyId=cb.id;ca.furniture=[];cb.furniture[0].widthMm=999;
 vi.mocked(storage.readHomeComparisonWorkspace).mockResolvedValue(w);render(<CompareHomesPanel localPlans={[ca,cb]} onlineProjects={[]} onLoadOnline={vi.fn()} onRefreshLocal={async()=>[ca,cb]}/>);
 await screen.findByText(/Frozen furniture snapshot/);fireEvent.click(screen.getByRole('button',{name:'Refresh saved plans'}));await screen.findByText('Saved plans refreshed. Compare again to review current copies.');fireEvent.click(screen.getByRole('button',{name:'Compare these homes'}));
 await screen.findByText(/My measured chair: This owned item is not placed/);expect(screen.getByText(/My measured chair: Saved dimensions differ/)).toBeTruthy();expect(storage.saveHomeComparisonCopies).not.toHaveBeenCalled();
});

it('invalidates stale sources before copy saving and exposes storage failures without a success message',async()=>{
 const a=home('Candidate A'),b=home('Candidate B'),refresh=vi.fn(async()=>[a,b]);render(<CompareHomesPanel localPlans={[a,b]} onlineProjects={[]} onLoadOnline={vi.fn()} onRefreshLocal={refresh}/>);
 await screen.findByRole('checkbox',{name:/My measured chair/});for(const name of [/Candidate A/,/Candidate B/,/My measured chair/])fireEvent.click(screen.getByRole('checkbox',{name}));fireEvent.click(screen.getByRole('button',{name:'Capture comparison snapshot'}));await screen.findByText(/Frozen furniture snapshot/);
 vi.mocked(comparison.fingerprintHomePlan).mockResolvedValue('sha256:'+'b'.repeat(64));fireEvent.click(screen.getByRole('button',{name:'Create 2 editable copies'}));await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('changed');expect(storage.saveHomeComparisonCopies).not.toHaveBeenCalled();
});

it('rechecks the current copy before opening, so an external edit is never replaced by an old loaded snapshot',async()=>{
 const a=home('Candidate A'),b=home('Candidate B'),w=comparison.createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[item]),ca=comparison.buildHomeComparisonCopy(a,w.homes[0],w.snapshot),cb=comparison.buildHomeComparisonCopy(b,w.homes[1],w.snapshot);w.homes[0].copyId=ca.id;w.homes[1].copyId=cb.id;
 const fresh={...ca,name:'Edited in another tab'},refresh=vi.fn(async()=>[ca,cb]),open=vi.fn();vi.mocked(storage.readHomeComparisonWorkspace).mockResolvedValue(w);render(<CompareHomesPanel localPlans={[ca,cb]} onlineProjects={[]} onLoadOnline={vi.fn()} onRefreshLocal={refresh} onOpenCopy={open}/>);await screen.findByText(/Frozen furniture snapshot/);fireEvent.click(screen.getByRole('button',{name:'Refresh saved plans'}));await screen.findByRole('button',{name:'Open Candidate A copy'});refresh.mockResolvedValue([fresh,cb]);fireEvent.click(screen.getByRole('button',{name:'Open Candidate A copy'}));await waitFor(()=>expect(open).toHaveBeenCalledWith(fresh));
});

it('keeps copy creation available for retry after an atomic storage failure without reporting success',async()=>{
 const a=home('Candidate A'),b=home('Candidate B');vi.mocked(storage.saveHomeComparisonCopies).mockRejectedValue(new Error('Device full'));
 render(<CompareHomesPanel localPlans={[a,b]} onlineProjects={[]} onLoadOnline={vi.fn()} onRefreshLocal={async()=>[a,b]}/>);await screen.findByRole('checkbox',{name:/My measured chair/});for(const name of [/Candidate A/,/Candidate B/,/My measured chair/])fireEvent.click(screen.getByRole('checkbox',{name}));fireEvent.click(screen.getByRole('button',{name:'Capture comparison snapshot'}));await screen.findByText(/Frozen furniture snapshot/);fireEvent.click(screen.getByRole('button',{name:'Create 2 editable copies'}));await screen.findByText('Device full');expect(screen.queryByText(/2 editable copies saved on this device/)).toBeNull();expect((screen.getByRole('button',{name:'Create 2 editable copies'}) as HTMLButtonElement).disabled).toBe(false);
});

it('clears old property and arrangement verification when a saved copy changes',async()=>{
 const a=home('Candidate A'),b=home('Candidate B'),w=comparison.createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[item]),ca=comparison.buildHomeComparisonCopy(a,w.homes[0],w.snapshot),cb=comparison.buildHomeComparisonCopy(b,w.homes[1],w.snapshot);
 w.snapshot.measurementsVerified=true;w.homes=w.homes.map((h,i)=>({...h,copyId:[ca,cb][i].id,copyFingerprint:'sha256:'+'b'.repeat(64),measurementsVerified:true,positions:h.positions.map(p=>({...p,reviewed:true}))}));vi.mocked(storage.readHomeComparisonWorkspace).mockResolvedValue(w);
 render(<CompareHomesPanel localPlans={[ca,cb]} onlineProjects={[]} onLoadOnline={vi.fn()} onRefreshLocal={async()=>[ca,cb]}/>);await screen.findByText(/Frozen furniture snapshot/);fireEvent.click(screen.getByRole('button',{name:'Refresh saved plans'}));await screen.findByText(/Property and arrangement verification have been cleared/);expect(screen.getAllByRole('checkbox',{name:'Property measurements verified'}).every(box=>!(box as HTMLInputElement).checked)).toBe(true);expect(screen.getAllByRole('checkbox',{name:'I reviewed this arrangement and support heights'}).every(box=>!(box as HTMLInputElement).checked)).toBe(true);
});

it('does not create a comparison after its panel closes during an explicit online load',async()=>{
 const a=home('Candidate A'),b=home('Candidate B');let finish!:(plan:typeof b)=>void;const load=vi.fn(()=>new Promise<typeof b>(resolve=>{finish=resolve;}));const view=render(<CompareHomesPanel localPlans={[a]} onlineProjects={[{id:b.id,name:b.name,revision:1,savedAt:b.updatedAt}]} onLoadOnline={load} onRefreshLocal={async()=>[a]}/>);
 await screen.findByRole('checkbox',{name:/My measured chair/});for(const name of [/Candidate A/,/Candidate B/,/My measured chair/])fireEvent.click(screen.getByRole('checkbox',{name}));fireEvent.click(screen.getByRole('button',{name:'Capture comparison snapshot'}));await waitFor(()=>expect(load).toHaveBeenCalledOnce());view.unmount();finish(b);await new Promise(resolve=>setTimeout(resolve,0));expect(storage.saveHomeComparisonWorkspace).not.toHaveBeenCalled();expect(storage.saveHomeComparisonCopies).not.toHaveBeenCalled();
});
