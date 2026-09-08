import {openDB} from 'idb';
import type {PlanReference} from './blueprintImport';
type ReferenceSave={reference?:PlanReference;file?:File;page:number;rotation:number};
const db=()=>openDB('nook-studio-references',1,{upgrade(d){d.createObjectStore('references');}});
export async function saveStudioReference(project:string,floor:string,value:ReferenceSave){const d=await db();try{await d.put('references',value,JSON.stringify([project,floor]));}finally{d.close();}}
export async function loadStudioReference(project:string,floor:string):Promise<ReferenceSave|undefined>{const d=await db();try{return await d.get('references',JSON.stringify([project,floor]));}finally{d.close();}}
