import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {catalog} from '../src/catalog';
import {createBlankPlan,rectangleCells} from '../src/domain';
import {personalMetadata,type PersonalCollectionItem} from '../src/personalItems';
import {assessHomeComparison,buildHomeComparisonCopy,createHomeComparisonWorkspace,parseHomeComparisonWorkspace} from '../src/homeComparison';
import {readHomeComparisonWorkspace,saveHomeComparisonWorkspace,saveHomeComparisonCopies} from '../src/homeComparisonStorage';

const now='2026-10-03T12:00:00.000Z';
const owned=(patch:Partial<PersonalCollectionItem>={}):PersonalCollectionItem=>({version:1,id:'owned-chair',name:'Measured chair',catalogId:'dining-chair',widthMm:731.5,depthMm:650.25,heightMm:900,status:'keep',revision:1,createdAt:now,updatedAt:now,...patch});
const home=(name='Home A')=>{const p=createBlankPlan(name,'metric');p.gridSizeMm=1000;p.floors[0].cells=rectangleCells(8,8);return p;};
afterEach(()=>vi.restoreAllMocks());

describe('private homes with one measured snapshot',()=>{
 it('freezes exact owned sizes, preserves source furniture and reuses existing positions in independent copies',()=>{
  const a=home(),b=home('Home B'),item=owned();b.gridSizeMm=304.8;a.furniture=[{id:'existing',catalogId:item.catalogId,floorId:a.floors[0].id,x:4000,z:4000,rotation:45,widthMm:600,depthMm:500,heightMm:800,variant:'rose',personalItem:personalMetadata(item)}];
  const original=JSON.stringify([a,b,item]),workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'online'}],[item]);
  const first=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot),second=buildHomeComparisonCopy(b,workspace.homes[1],workspace.snapshot);
  expect(JSON.stringify([a,b,item])).toBe(original);expect(first.id).not.toBe(a.id);expect(second.id).not.toBe(b.id);expect(first.id).not.toBe(second.id);
  expect(first.furniture[0]).toMatchObject({id:'existing',x:4000,z:4000,rotation:45,variant:'rose',widthMm:731.5,depthMm:650.25,heightMm:900});
  expect(second.furniture.at(-1)).toMatchObject({widthMm:731.5,depthMm:650.25,heightMm:900,personalItem:{itemId:item.id}});
  item.widthMm=999;expect(workspace.snapshot.items[0].widthMm).toBe(731.5);first.floors[0].name='Edited copy';expect(a.floors[0].name).not.toBe('Edited copy');
 });
 it('uses identical preferences, reports unknowns and excludes unrelated issue counts from owned summaries',()=>{
  const a=home(),b=home('Home B'),workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);
  workspace.snapshot.measurementsVerified=true;workspace.homes[0].measurementsVerified=true;workspace.homes[0].positions[0]={...workspace.homes[0].positions[0],x:4000,z:4000,reviewed:true};
  const plan=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot),report=assessHomeComparison(plan,workspace.homes[0],workspace.snapshot,workspace.preferences);
  expect(report.unknowns).toEqual([]);expect(report.items[0].status).toBe('no-issues');expect(report.issues).toHaveLength(0);
  const changed=structuredClone(plan);changed.furniture[0].widthMm=900;expect(assessHomeComparison(changed,workspace.homes[0],workspace.snapshot,workspace.preferences).items[0].status).toBe('needs-checking');
  expect(assessHomeComparison(changed,workspace.homes[0],workspace.snapshot,workspace.preferences).unknowns.join(' ')).toContain('dimensions differ');
  const missing=assessHomeComparison({...plan,furniture:[]},workspace.homes[1],workspace.snapshot,workspace.preferences);expect(missing.items[0].status).toBe('needs-checking');expect(missing.unknowns.join(' ')).toContain('not placed');expect(missing.unknowns.join(' ')).toContain('Property measurements');
 });
 it('keeps initial staging unknown, exposes real overlaps and preserves unsupported items as unknown',()=>{
  const a=home(),b=home('Home B'),workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned(),owned({id:'other',name:'Second chair'})]);
  const p=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot);p.furniture[1].x=p.furniture[0].x;p.furniture[1].z=p.furniture[0].z;
  const report=assessHomeComparison(p,workspace.homes[0],workspace.snapshot,workspace.preferences);expect(report.issues.some(i=>i.kind==='overlap')).toBe(true);expect(report.unknowns.join(' ')).toContain('starting position');
  p.furniture[0].catalogId='unavailable-proxy';expect(assessHomeComparison(p,workspace.homes[0],workspace.snapshot,workspace.preferences).items[0].status).toBe('needs-checking');
 });
 it('marks unavailable retained obstacles as incomplete even when the owned footprint itself is supported',()=>{
  const a=home(),b=home('Home B');a.furniture=[{id:'legacy-sofa',catalogId:'unavailable-legacy-sofa',floorId:a.floors[0].id,x:4000,z:4000,rotation:0,widthMm:4000,depthMm:4000,heightMm:900,variant:'cream'}];
  const workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);workspace.snapshot.measurementsVerified=true;workspace.homes[0].measurementsVerified=true;workspace.homes[0].positions[0]={...workspace.homes[0].positions[0],x:4000,z:4000,reviewed:true};
  const plan=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot),report=assessHomeComparison(plan,workspace.homes[0],workspace.snapshot,workspace.preferences);
  expect(report.issues).toEqual([]);expect(report.existingItems).toBe(1);expect(report.limited).toBe(true);expect(report.items[0].status).toBe('needs-checking');expect(report.unknowns.join(' ')).toMatch(/retained object.*unavailable catalog metadata.*obstacle checks/);
 });
 it('does not mark ordinary rugs or unavailable objects on unassessed floors as incomplete obstacle coverage',()=>{
  const a=home(),b=home('Home B'),rug=catalog.find(c=>c.shape==='rug')!;a.floors.push({...structuredClone(a.floors[0]),id:'upper',name:'Upper'});
  const piece={id:'rug',catalogId:rug.id,floorId:a.floors[0].id,x:4000,z:4000,rotation:0,widthMm:4000,depthMm:4000,heightMm:20,variant:'cream'};a.furniture=[piece,{...piece,id:'legacy-sofa',catalogId:'unavailable-legacy-sofa',floorId:'upper',heightMm:900}];
  const workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);workspace.snapshot.measurementsVerified=true;workspace.homes[0].measurementsVerified=true;workspace.homes[0].positions[0]={...workspace.homes[0].positions[0],x:4000,z:4000,reviewed:true};
  const plan=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot),report=assessHomeComparison(plan,workspace.homes[0],workspace.snapshot,workspace.preferences);
  expect(report.limited).toBe(false);expect(report.items[0].status).toBe('no-issues');expect(report.unknowns).toEqual([]);expect(report.issues).toEqual([]);
 });
 it('rejects duplicate candidates, unmeasured dimensions and oversized or malformed saved workspaces',()=>{
  const a=home(),b=home();expect(()=>createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:a,location:'online'}],[owned()])).toThrow(/distinct/);
  expect(()=>createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned({widthMm:NaN})])).toThrow(/dimensions/);
  const w=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);expect(()=>parseHomeComparisonWorkspace({...w,priorities:'x'.repeat(2001)})).toThrow();expect(()=>parseHomeComparisonWorkspace({...w,unknown:'data'})).toThrow();
 });
 it('keeps every duplicate owned placement at snapshot size and detaches a moved item from a cross-floor group in the copy only',()=>{
  const a=home(),b=home(),item=owned(),floor=a.floors[0].id;a.floors.push({...structuredClone(a.floors[0]),id:'upper',name:'Upper'});
  const placed={id:'first',catalogId:item.catalogId,floorId:floor,x:4000,z:4000,rotation:0,widthMm:600,depthMm:500,heightMm:800,variant:'rose',personalItem:personalMetadata(item)};
  a.furniture=[placed,{...placed,id:'duplicate',x:6000}];a.furnitureGroups={version:1,groups:[{id:'old-group',name:'Old group',floorId:floor,memberIds:['first','duplicate'],locked:false}],lockedItemIds:[]};
  const before=structuredClone(a),workspace=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[item]);workspace.homes[0].positions[0].floorId='upper';const copy=buildHomeComparisonCopy(a,workspace.homes[0],workspace.snapshot);
  expect(copy.furniture.every(p=>p.widthMm===731.5&&p.depthMm===650.25)).toBe(true);expect(copy.furnitureGroups?.groups).toEqual([]);expect(a).toEqual(before);expect(assessHomeComparison(copy,workspace.homes[0],workspace.snapshot,workspace.preferences).unknowns.join(' ')).toContain('Multiple existing copies');
 });
});

describe('atomic comparison storage',()=>{
 it('saves all independent copies plus their workspace, without changing sources or the active key, and rejects stale writers',async()=>{
  const a=home(),b=home('Home B'),db=await openDB('nook-and-nest',1,{upgrade(db){db.createObjectStore('projects');}});await db.put('projects',a,'project:'+a.id);await db.put('projects',b,'project:'+b.id);await db.put('projects',{activeProjectId:a.id},'active');
  const current=await readHomeComparisonWorkspace();const w=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);w.revision=current?.revision??0;
  const draft=await saveHomeComparisonWorkspace(w),copies=w.homes.map((h,i)=>buildHomeComparisonCopy([a,b][i],h,w.snapshot));const saved=await saveHomeComparisonCopies(draft,copies);
  expect(await db.get('projects','active')).toEqual({activeProjectId:a.id});expect(await db.get('projects','project:'+a.id)).toEqual(a);expect(saved.homes.map(h=>h.copyId)).toEqual(copies.map(p=>p.id));expect((await readHomeComparisonWorkspace())?.snapshot).toEqual(w.snapshot);
  await expect(saveHomeComparisonWorkspace(draft)).rejects.toThrow(/another tab/);await expect(saveHomeComparisonCopies(saved,copies)).rejects.toThrow();db.close();
 });
 it('rolls back every copy on quota failure and never overwrites a source identity',async()=>{
  const a=home(),b=home(),previous=await readHomeComparisonWorkspace(),w=createHomeComparisonWorkspace([{plan:a,location:'local'},{plan:b,location:'local'}],[owned()]);w.revision=previous?.revision??0;const draft=await saveHomeComparisonWorkspace(w),copies=w.homes.map((h,i)=>buildHomeComparisonCopy([a,b][i],h,w.snapshot));
  await expect(saveHomeComparisonCopies(draft,[{...copies[0],id:a.id},copies[1]])).rejects.toThrow(/identity/);
  const original=IDBObjectStore.prototype.add;let adds=0;vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){if(++adds===2)throw new DOMException('Device full','QuotaExceededError');return original.apply(this,args);});
  await expect(saveHomeComparisonCopies(draft,copies)).rejects.toThrow('Device full');vi.restoreAllMocks();const db=await openDB('nook-and-nest',1);expect(await db.get('projects','project:'+copies[0].id)).toBeUndefined();expect((await readHomeComparisonWorkspace())?.homes.every(h=>!h.copyId)).toBe(true);db.close();
 });
});
