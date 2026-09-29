import {it,expect} from 'vitest';
import {rectangleCells,createBlankPlan,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {saveLayoutAlternative,applyLayoutAlternative} from '../src/layoutAlternatives';
import {validatePlan} from '../src/planValidation';
import {usePlanner} from '../src/store';
import {cozyStarterKits,buildKitPlacement,initialKitPosition} from '../src/furnitureKits';

it('restores an idea and its floor atomically, preserves private saves, and undoes the complete change',()=>{
  const original=createBlankPlan('My home','metric');
  const saved=saveLayoutAlternative(original,'Original layout',original.floors[0].id,validatePlan);
  const working={...saved,floors:[{...original.floors[0],id:'new-floor',name:'Experiment'}]};
  usePlanner.getState().replacePlan(working);
  const base=usePlanner.getState().plan;
  const candidate=applyLayoutAlternative(base,saved.layoutAlternatives!.options[0].id,'new-floor',validatePlan);
  usePlanner.getState().commitDesign(base,candidate.plan,candidate.activeFloorId);
  expect(usePlanner.getState().past).toHaveLength(1);
  expect(usePlanner.getState().activeFloorId).toBe(original.floors[0].id);
  expect(parsePlan(serializePlan(usePlanner.getState().plan)).layoutAlternatives).toEqual(saved.layoutAlternatives);
  expect(decodeShare(encodeShare(usePlanner.getState().plan)).layoutAlternatives).toBeUndefined();
  usePlanner.getState().undo();
  expect(usePlanner.getState().plan).toEqual(base);
  expect(usePlanner.getState().activeFloorId).toBe('new-floor');
  usePlanner.getState().redo();
  expect(usePlanner.getState().activeFloorId).toBe(original.floors[0].id);
  expect(()=>validatePlan({...base,layoutAlternatives:{version:1,options:[{...saved.layoutAlternatives!.options[0],snapshot:{...saved.layoutAlternatives!.options[0].snapshot,layoutAlternatives:{version:1,options:[]}}}]}})).toThrow();
});

it('keeps arrangement previews unsaved, rejects a stale apply, and adds independent pieces in one undo',()=>{
  const room=createBlankPlan('Arrangements','metric');room.floors[0].cells=rectangleCells(12,12);usePlanner.getState().replacePlan(room);
  const base=usePlanner.getState().plan,floorId=base.floors[0].id,kit=cozyStarterKits[0];
  const preview=buildKitPlacement(base,floorId,kit,initialKitPosition(base,floorId,kit));
  expect(usePlanner.getState().plan).toBe(base);
  expect(usePlanner.getState().past).toHaveLength(0);
  usePlanner.getState().rename('Changed while reviewing');
  expect(()=>usePlanner.getState().commitDesign(base,preview.plan)).toThrow(/changed/);
  usePlanner.getState().replacePlan(base);
  const current=usePlanner.getState().plan;
  usePlanner.getState().commitDesign(current,preview.plan);
  expect(usePlanner.getState().past).toHaveLength(1);
  expect(usePlanner.getState().plan.floors).toEqual(base.floors);
  expect(new Set(usePlanner.getState().plan.furniture.map(p=>p.id)).size).toBe(kit.pieces.length);
  usePlanner.getState().undo();expect(usePlanner.getState().plan).toEqual(current);
});
