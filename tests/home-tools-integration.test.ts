import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createSamplePlan,parsePlan,serializePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {captureLayout,saveLayoutAlternative,applyLayoutAlternative,publicLayoutPlan,homeRecordsRestoreNotice,layoutDifference} from '../src/layoutAlternatives';
import {startRenovation} from '../src/designHistory';
import {buildProjectBackup,restoreProjectBackup} from '../src/projectBackup';
import {publicSurveyPlan} from '../src/siteSurvey';
import {usePlanner} from '../src/store';
import {deleteDB} from 'idb';
import type {PlanDocumentV1} from '../src/types';

afterEach(async()=>{for(const name of ['nook-and-nest','nook-listing-studio','nook-studio-references','nook-personal-collection'])await deleteDB(name);});
function homePlan():PlanDocumentV1{
 return {...createSamplePlan('Home tools','metric'),deliveryPlanning:{version:1,steps:[],items:[]},homeManual:{version:1,records:[{id:'manual-record',name:'Washer',notes:'Private serial number',manualUrl:'https://example.com/manual.pdf',warrantyEndsOn:'2028-02-29',history:[]}]}};
}

it('rejects malformed delivery and home manual data instead of accepting unknown private metadata',()=>{
 const plan=createSamplePlan('Home tools','metric');
 for(const key of ['deliveryPlanning','homeManual'])expect(()=>validatePlan({...plan,[key]:{version:500,secret:'malformed'}})).toThrow();
});

it('does not expose private home records or access notes in public plans',()=>{
 const plan={...createSamplePlan('Private home','metric'),deliveryPlanning:{privateNote:'access-key-secret'},homeManual:{privateNote:'serial-number-secret'}};
 const shared=publicLayoutPlan(plan as never);
 expect(shared).not.toHaveProperty('deliveryPlanning');
 expect(shared).not.toHaveProperty('homeManual');
 expect(JSON.stringify(shared)).not.toContain('secret');
});

it('preserves independent home records through alternatives, history and JSON, and strips nested public data',()=>{
 let p=homePlan();const original=JSON.stringify(p);
 p=saveLayoutAlternative(p,'Move-in',p.floors[0].id,validatePlan);
 p=startRenovation(p,p.floors[0].id,validatePlan);
 expect(p.layoutAlternatives!.options[0].snapshot.homeManual).toEqual(p.homeManual);
 expect(p.designHistory!.checkpoints[0].snapshot.deliveryPlanning).toEqual(p.deliveryPlanning);
 const changed={...p,homeManual:{version:1 as const,records:[]},deliveryPlanning:undefined};
 const restored=applyLayoutAlternative(changed,p.layoutAlternatives!.options[0].id,p.floors[0].id,validatePlan).plan;
 expect(restored.homeManual).toEqual(homePlan().homeManual);
 expect(parsePlan(serializePlan(restored)).homeManual).toEqual(restored.homeManual);
 const publicEvidence=publicSurveyPlan(restored);
 expect(JSON.stringify(publicEvidence)).not.toContain('Private serial number');
 const snapshot=captureLayout(p);snapshot.homeManual!.records[0].notes='Independent snapshot';
 expect(p.homeManual!.records[0].notes).toBe('Private serial number');
 expect(original).toContain('Private serial number');
 const older={...captureLayout(p),homeManual:undefined,deliveryPlanning:undefined};
 expect(layoutDifference(p,older).homeManualChanged).toBe(true);
 expect(homeRecordsRestoreNotice(p,older)).toMatch(/Home manual.*absent.*cleared/);
 expect(homeRecordsRestoreNotice(p,captureLayout(p))).toBeUndefined();
});

it('keeps saved home tools in portable backups and restores a distinct project identity',async()=>{
 const p=homePlan(),backup=await buildProjectBackup(p,{includeReferences:false}),restored=await restoreProjectBackup(backup);
 expect(restored.id).not.toBe(p.id);
 expect(restored.homeManual).toEqual(p.homeManual);
 expect(restored.deliveryPlanning).toEqual(p.deliveryPlanning);
});

it('commits home records once, undoes them and rejects a stale project update',()=>{
 const p=homePlan();usePlanner.setState({plan:p,activeFloorId:p.floors[0].id,past:[],future:[]});
 const next={...p,homeManual:{version:1 as const,records:[]}};
 usePlanner.getState().commitDesign(p,next);
 expect(usePlanner.getState().past).toHaveLength(1);
 expect(()=>usePlanner.getState().commitDesign(p,next)).toThrow(/changed/);
 usePlanner.getState().undo();
 expect(usePlanner.getState().plan.homeManual).toEqual(p.homeManual);
});
