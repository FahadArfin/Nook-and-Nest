import {openDB} from 'idb';
import type {PlanReference} from './blueprintImport';
import type {PlanDocumentV1} from './types';
export type ReferenceSave={reference?:PlanReference;file?:File;page:number;rotation:number};
const db=()=>openDB('nook-studio-references',1,{upgrade(d){d.createObjectStore('references');}});
export async function saveStudioReference(project:string,floor:string,value:ReferenceSave){const d=await db();try{await d.put('references',value,JSON.stringify([project,floor]));}finally{d.close();}}
export async function loadStudioReference(project:string,floor:string):Promise<ReferenceSave|undefined>{const d=await db();try{return await d.get('references',JSON.stringify([project,floor]));}finally{d.close();}}

/** Immutable, deduplicated reference versions let saved layouts and undo retain their own source. */
export async function saveReferenceVersion(project:string,value:ReferenceSave):Promise<string|undefined>{
  if(!value.reference&&!value.file)return undefined;
  const fileHash=value.file?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await value.file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join(''):'';
  const payload=JSON.stringify({reference:value.reference,page:value.page,rotation:value.rotation,fileHash,fileName:value.file?.name,fileType:value.file?.type});
  const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const d=await db();try{await d.put('references',value,JSON.stringify([project,'version',id]));}finally{d.close();}return id;
}
export async function loadReferenceVersion(project:string,id:string):Promise<ReferenceSave|undefined>{const d=await db();try{return await d.get('references',JSON.stringify([project,'version',id]));}finally{d.close();}}
export async function loadFloorReference(project:string,floor:{id:string;referenceId?:string}):Promise<ReferenceSave|undefined>{return floor.referenceId?loadReferenceVersion(project,floor.referenceId):loadStudioReference(project,floor.id);}
export async function versionLayoutReferences(plan:PlanDocumentV1):Promise<PlanDocumentV1>{
  const floors=[];
  for(const floor of plan.floors){
    if(floor.referenceId){floors.push(floor);continue;}
    const value=await loadStudioReference(plan.id,floor.id);
    const referenceId=value?await saveReferenceVersion(plan.id,value):undefined;
    floors.push(referenceId?{...floor,referenceId}:floor);
  }
  return {...plan,floors};
}
