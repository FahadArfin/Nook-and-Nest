import {openDB} from 'idb';
import {fingerprintHomePlan,parseHomeComparisonWorkspace,type HomeComparisonWorkspace} from './homeComparison';
import {MAX_PLAN_BYTES,validatePlan} from './planValidation';
import {plannerCollaborationActive} from './store';
import type {PlanDocumentV1} from './types';

const workspaceKey='home-comparison:workspace';
const database=()=>openDB('nook-and-nest',1,{upgrade(db){if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects');}});
function privateOnly(){if(plannerCollaborationActive())throw new Error('Leave the shared room before saving a private home comparison.');}
export async function readHomeComparisonWorkspace():Promise<HomeComparisonWorkspace|undefined>{const db=await database();try{const data=await db.get('projects',workspaceKey);return data?parseHomeComparisonWorkspace(data):undefined;}finally{db.close();}}

async function write(input:HomeComparisonWorkspace,copies?:PlanDocumentV1[]):Promise<HomeComparisonWorkspace>{
 privateOnly();const workspace=parseHomeComparisonWorkspace(input);
 if(copies){
  if(copies.length!==workspace.homes.length||workspace.homes.some(h=>h.copyId))throw new Error('This comparison already has copies, or some homes are missing.');
  const ids=new Set(copies.map(p=>p.id));if(ids.size!==copies.length||workspace.homes.some(h=>ids.has(h.sourceId)))throw new Error('Invalid independent copy identity.');
  for(const plan of copies){validatePlan(plan);if(new TextEncoder().encode(JSON.stringify(plan)).byteLength>MAX_PLAN_BYTES)throw new Error('A comparison copy exceeds the project size limit.');}
 }
 const fingerprints=copies?await Promise.all(copies.map(fingerprintHomePlan)):[];
 const db=await database();try{
  privateOnly();const tx=db.transaction('projects','readwrite');
  try{
   const previous=await tx.store.get(workspaceKey);if((previous?.revision??0)!==workspace.revision)throw new Error('This comparison changed in another tab. Reload it before saving.');privateOnly();
   const saved=parseHomeComparisonWorkspace({...workspace,revision:workspace.revision+1,updatedAt:new Date().toISOString(),homes:workspace.homes.map((h,i)=>copies?{...h,copyId:copies[i].id,copyFingerprint:fingerprints[i]}:h)});
   if(copies)for(const plan of copies){privateOnly();await tx.store.add(structuredClone(plan),'project:'+plan.id);}
   privateOnly();await tx.store.put(saved,workspaceKey);await tx.done;return saved;
  }catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
 }finally{db.close();}
}
export const saveHomeComparisonWorkspace=(workspace:HomeComparisonWorkspace)=>write(workspace);
/** add(), a single transaction and no active-key write prevent overwrites and partial batches. */
export const saveHomeComparisonCopies=(workspace:HomeComparisonWorkspace,copies:PlanDocumentV1[])=>write(workspace,copies);
