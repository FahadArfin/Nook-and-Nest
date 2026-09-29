// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {originalRemixExamples,remixCopySeed,parseRemixSnapshot} from '../src/remixSnapshot';
import {independentRemixPlan,copyRemixFromPublicRoute} from '../src/remixProjectCopy';
import {createFurnitureKit,parseFurnitureKit,buildKitPlacement} from '../src/furnitureKits';
import {createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare} from '../src/domain';
import {applyLayoutAlternative,saveLayoutAlternative,captureLayout} from '../src/layoutAlternatives';
import {validatePlan} from '../src/planValidation';
import {reviewPlan} from '../src/clientReview';
import {reidentifyPrivatePlan} from '../src/projectIdentity';
import * as storage from '../src/store';

function seed(){const value=originalRemixExamples()[0];return remixCopySeed(value.snapshot,{source:'builtin',id:value.id,revision:1});}
beforeEach(async()=>{window.history.replaceState(null,'','/');for(const plan of await storage.listLocalPlans())await storage.deleteLocalPlan(plan.id);storage.usePlanner.getState().replacePlan(createSamplePlan('My existing home','metric'));});
afterEach(()=>vi.restoreAllMocks());
it('allocates independent project/floor/piece geometry without dropping measured transforms, colors or public credit',async()=>{
  const source=seed();source.furniture[0].materialColors={upholstery:'#aabbcc'};source.furniture[0].rotation=12.5;
  const before=structuredClone(source),a=await independentRemixPlan(source),b=await independentRemixPlan(source);
  expect(source).toEqual(before);expect(new Set([a.id,b.id,source.id]).size).toBe(3);
  expect(a.floors[0].id).not.toBe(source.floors[0].id);expect(a.floors[0].cellRects).toEqual(source.floors[0].cellRects);
  expect(a.furniture.map(p=>p.id)).not.toEqual(source.furniture.map(p=>p.id));
  expect(a.furniture[0]).toMatchObject({floorId:a.floors[0].id,widthMm:source.furniture[0].widthMm,rotation:12.5,materialColors:{upholstery:'#aabbcc'}});
  expect(a.remixAttribution).toEqual(source.remixAttribution);
  expect(parsePlan(serializePlan(a)).remixAttribution).toEqual(source.remixAttribution);
  expect(reidentifyPrivatePlan(a,'private-copy').remixAttribution).toEqual(source.remixAttribution);
  expect(decodeShare(encodeShare(a)).remixAttribution).toEqual(source.remixAttribution);
  expect(reviewPlan(a,'Review').remixAttribution).toEqual(source.remixAttribution);
  expect(parseRemixSnapshot(originalRemixExamples()[0].snapshot)).toBeTruthy();
});
it('retains credits through reusable kits and exact layout/history snapshots, rejects malformed or overflowing chains before a proposal',async()=>{
  const a=await independentRemixPlan(seed()),credit=a.remixAttribution!;
  const kit=createFurnitureKit(a,a.floors[0].id,[a.furniture[0].id],'Attributed chair');
  expect(parseFurnitureKit(JSON.parse(JSON.stringify(kit))).remixAttribution).toEqual(credit);
  const base=createSamplePlan('Target','metric'),proposed=buildKitPlacement(base,base.floors[0].id,kit,{x:2000,z:2000,rotation:0});
  expect(base.remixAttribution).toBeUndefined();expect(proposed.plan.remixAttribution).toEqual(credit);
  const captured=saveLayoutAlternative(a,'Credit at this point',a.floors[0].id,validatePlan);
  const changed={...captured,remixAttribution:undefined};expect(captureLayout(a).remixAttribution).toEqual(credit);
  expect(applyLayoutAlternative(changed,captured.layoutAlternatives!.options[0].id,a.floors[0].id,validatePlan).plan.remixAttribution).toEqual(credit);
  expect(()=>parsePlan(JSON.stringify({...a,remixAttribution:{...credit,secret:'private'}}))).toThrow();
  const full={...base,remixAttribution:{version:1 as const,credits:Array.from({length:8},(_,i)=>({...credit.credits[0],id:'earlier-'+i}))}};
  expect(()=>buildKitPlacement(full,base.floors[0].id,kit,{x:2000,z:2000,rotation:0})).toThrow('too long');expect(full.furniture).toEqual(base.furniture);
});
it('explicit public copy preserves the active local project and does not follow competing share fragments',async()=>{
  const old=storage.usePlanner.getState().plan;await storage.savePlan(old);
  window.history.replaceState(null,'','/#idea=original-starter-reading');await copyRemixFromPublicRoute(seed());
  const next=storage.usePlanner.getState().plan,all=await storage.listLocalPlans();expect(all.find(p=>p.id===old.id)).toEqual(old);expect(all.find(p=>p.id===next.id)).toEqual(next);expect(next.id).not.toBe(old.id);expect(next.remixAttribution?.credits).toHaveLength(1);
});
it('storage failure or a stale public route cannot replace the current project',async()=>{
  const old=storage.usePlanner.getState().plan;await storage.savePlan(old);
  const real=storage.savePlan;vi.spyOn(storage,'savePlan').mockImplementation(async p=>{if(p.id!==old.id)throw Error('Device quota reached');await real(p);});
  await expect(copyRemixFromPublicRoute(seed())).rejects.toThrow('quota');expect(storage.usePlanner.getState().plan).toBe(old);expect((await storage.listLocalPlans()).map(p=>p.id)).toEqual([old.id]);
  await expect(copyRemixFromPublicRoute(seed(),()=>false)).rejects.toThrow('active view');expect(storage.usePlanner.getState().plan).toBe(old);
});
