import {openDB,type DBSchema,type IDBPTransaction} from 'idb';
import {parseRemixPackage,REMIX_LIMITS,type RemixPackage} from './remixSnapshot';

export const SAVED_IDEAS_LIMITS={entries:24,bytes:8*1024*1024} as const;
/** bytes is the UTF-8 size of the persisted record, including its small envelope. */
export interface SavedIdea {version:1;id:string;packet:RemixPackage;savedAt:string;bytes:number}
type StoredIdea=Omit<SavedIdea,'bytes'>;
interface SavedIdeasDatabase extends DBSchema {ideas:{key:string;value:StoredIdea}}
type ShelfTransaction=IDBPTransaction<SavedIdeasDatabase,['ideas'],'readonly'|'readwrite'>;
const safeId=(id:unknown):id is string=>typeof id==='string'&&/^saved:(builtin|share|gallery|file):[a-zA-Z0-9_-]{1,100}:([1-9]\d{0,2}|1000)$/.test(id);
const identity=(packet:RemixPackage)=>`saved:${packet.source.source}:${packet.source.id}:${packet.source.revision}`;
const encodedBytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
const database=()=>openDB<SavedIdeasDatabase>('nook-saved-ideas',1,{upgrade(db){db.createObjectStore('ideas',{keyPath:'id'});}});

/** No deletion is automatic. A safe ideaId lets the UI offer targeted recovery. */
export class SavedIdeasCorruptionError extends Error {
  constructor(readonly ideaId?:string){super('A saved idea is damaged or incompatible. Your shelf has not been changed. Remove the damaged saved copy to recover.');this.name='SavedIdeasCorruptionError';}
}

function permittedPacket(input:unknown):RemixPackage {
  // Bound the full package before the existing parser walks its geometry.
  if(encodedBytes(input)>REMIX_LIMITS.bytes+2000)throw new Error('This room package exceeds the saved-idea size limit.');
  const captured=structuredClone(input),packet=parseRemixPackage(captured);
  if(!packet.snapshot.allowCopy)throw new Error('The creator has allowed viewing only. This idea cannot be saved to your shelf.');
  if(canonical(captured)!==canonical(packet))throw new Error('Open a validated room package before saving it. Its snapshot must not change during saving.');
  return packet;
}
/** Property ordering is not a revision; all validated values and array order are. */
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'){const object=value as Record<string,unknown>;return '{'+Object.keys(object).filter(key=>object[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')+'}';}
  return JSON.stringify(value);
}
function savedRecord(value:unknown):SavedIdea {
  const v=value as Partial<StoredIdea>;
  try {
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(key=>!['version','id','packet','savedAt'].includes(key))||v.version!==1||!safeId(v.id)||typeof v.savedAt!=='string'||!Number.isFinite(Date.parse(v.savedAt))||new Date(v.savedAt).toISOString()!==v.savedAt)throw new Error('Invalid saved record.');
    const packet=permittedPacket(v.packet);
    if(v.id!==identity(packet)||canonical(v.packet)!==canonical(packet))throw new Error('Changed saved source.');
    const record:StoredIdea={version:1,id:v.id,packet,savedAt:v.savedAt};
    return {...record,bytes:encodedBytes(record)};
  }catch {throw new SavedIdeasCorruptionError(safeId(v?.id)?v.id:undefined);}
}
async function readShelf(tx:ShelfTransaction):Promise<SavedIdea[]> {
  // Reading at most one excess record detects corruption without loading an unbounded collection.
  const rows=await tx.store.getAll(undefined,SAVED_IDEAS_LIMITS.entries+1);
  if(rows.length>SAVED_IDEAS_LIMITS.entries)throw new SavedIdeasCorruptionError();
  const entries=rows.map(savedRecord);
  if(entries.reduce((sum,entry)=>sum+entry.bytes,0)>SAVED_IDEAS_LIMITS.bytes)throw new SavedIdeasCorruptionError();
  return entries;
}
async function abort(tx:ShelfTransaction){try{tx.abort();}catch{}await tx.done.catch(()=>{});}

/** Newest first, detached from storage. Any damaged entry rejects the read without writes. */
export async function listSavedIdeas():Promise<SavedIdea[]> {
  const db=await database();
  try {const tx=db.transaction('ideas','readonly');try{const entries=await readShelf(tx);await tx.done;return entries.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||a.id.localeCompare(b.id));}catch(error){await abort(tx);throw error;}}
  finally{db.close();}
}

/** Explicit device-only save. Same source/revision/content is a no-op, not an overwrite. */
export async function saveIdea(input:RemixPackage):Promise<SavedIdea> {
  // Capture caller-owned data before yielding, so later UI edits cannot change this request.
  const packet=permittedPacket(input),record:StoredIdea={version:1,id:identity(packet),packet,savedAt:new Date().toISOString()},saved:SavedIdea={...record,bytes:encodedBytes(record)};
  const db=await database();
  try {
    // IndexedDB serializes overlapping readwrite transactions even across separate tabs/connections.
    const tx=db.transaction('ideas','readwrite');
    try {
      const entries=await readShelf(tx),existing=entries.find(entry=>entry.id===saved.id);
      if(existing){if(canonical(existing.packet)!==canonical(packet))throw new Error('Different content already uses this source and revision. Keep the saved idea or remove it explicitly before saving the replacement.');await tx.done;return existing;}
      if(entries.length>=SAVED_IDEAS_LIMITS.entries)throw new Error('Your saved-ideas shelf holds up to 24 ideas. Remove a saved copy before adding another.');
      if(entries.reduce((sum,entry)=>sum+entry.bytes,0)+saved.bytes>SAVED_IDEAS_LIMITS.bytes)throw new Error('Your saved-ideas shelf has reached its 8 MiB limit. Remove a saved copy before adding another.');
      await tx.store.add(record);await tx.done;return saved;
    }catch(error){await abort(tx);throw error;}
  }finally{db.close();}
}

/** Idempotent, targeted deletion also permits recovery when that entry cannot be parsed. */
export async function removeSavedIdea(id:string):Promise<void> {
  if(!safeId(id))throw new Error('Invalid saved-idea identity.');
  const db=await database();
  try {const tx=db.transaction('ideas','readwrite');try{await tx.store.delete(id);await tx.done;}catch(error){await abort(tx);throw error;}}
  finally{db.close();}
}
