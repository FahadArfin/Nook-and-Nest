import {openDB} from 'idb';
import type {BlueprintDraft} from './blueprint';
import type {PlanReference} from './blueprintImport';
import type {PlanDocumentV1,Units} from './types';

export type StudioRecovery={
  fingerprint:string;savedAt:string;draft:BlueprintDraft;corners:{x:number;z:number}[];
  imageScale:number;calibrated:boolean;view:{x:number;z:number;width:number;height:number};units:Units;
  reference?:PlanReference;file?:File;page:number;rotation:number;
};
// Recovery is device-local and never changes the 3D project or its undo history.
export const studioFingerprint=(plan:PlanDocumentV1)=>JSON.stringify([plan.gridSizeMm,plan.floors,plan.furniture]);
const database=()=>openDB('nook-studio-recovery',1,{upgrade(db){db.createObjectStore('drafts');}});
let writes:Promise<unknown>=Promise.resolve();
export function saveStudioRecovery(project:string,floor:string,value:StudioRecovery|undefined){
  const next=writes.catch(()=>{}).then(async()=>{const db=await database();try{const key=JSON.stringify([project,floor]);if(value)await db.put('drafts',value,key);else await db.delete('drafts',key);}finally{db.close();}});
  writes=next;return next;
}
export async function loadStudioRecovery(project:string,floor:string):Promise<StudioRecovery|undefined>{
  await writes.catch(()=>{});const db=await database();try{return await db.get('drafts',JSON.stringify([project,floor]));}finally{db.close();}
}
