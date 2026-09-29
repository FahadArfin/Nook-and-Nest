import {reviewPlan} from './clientReview';
import {validatePlan} from './planValidation';
import {assertLockedFurnitureUnchanged,validateFurnitureGroups} from './furnitureGroups';
import type {FurniturePlacement,PlanDocumentV1} from './types';

export const COLLAB_LIMITS={members:8,rooms:10,history:20,operations:32,operationBytes:800_000,planBytes:750_000,queue:10,queueBytes:4_000_000,presenceMs:45_000,inviteMs:86_400_000} as const;
export type CollaborationRole='owner'|'editor'|'viewer';
export interface CollaborationMember {id:string;name:string;role:CollaborationRole;epoch:number;active:boolean}
export interface CollaborationPresence {memberId:string;name:string;floorId?:string;selectionId?:string;expiresAt:number}
export interface CollaborationSnapshot {roomId:string;revision:number;plan:PlanDocumentV1;me:CollaborationMember;members:CollaborationMember[];presence:CollaborationPresence[];archived:boolean}
export interface FurnitureOperation {kind:'furniture';id:string;before:string|null;value:FurniturePlacement|null}
/** Whole-layout changes are deliberately exclusive, not claimed to be merged. */
export interface LayoutOperation {kind:'layout';before:string;value:Pick<PlanDocumentV1,'floors'|'furniture'|'gridSizeMm'|'furnitureGroups'|'environment'>}
export interface CollaborationBatch {version:1;id:string;baseRevision:number;memberEpoch:number;label:string;architecture:string;allowUnlock?:true;operations:Array<FurnitureOperation|LayoutOperation>}
export class CollaborationConflict extends Error {constructor(public conflicts:string[],message='This change overlaps newer shared work. Keep your local copy or review the latest version before trying again.'){super(message);this.name='CollaborationConflict';}}
export const collabId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v);
export function collabName(v:unknown,max=80):string {if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f<>]/.test(v))throw new Error('Enter a short plain-text name.');return v.trim();}
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value)??'null';}
export const encodedBytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
export async function collaborationHash(value:unknown):Promise<string> {const data=new TextEncoder().encode(canonical(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export const collaborationLayout=(p:PlanDocumentV1):LayoutOperation['value']=>({gridSizeMm:p.gridSizeMm,floors:p.floors,furniture:p.furniture,...(p.furnitureGroups?{furnitureGroups:p.furnitureGroups}:{}),...(p.environment?{environment:p.environment}:{})});
const architecture=(p:PlanDocumentV1)=>({gridSizeMm:p.gridSizeMm,floors:p.floors,furnitureGroups:p.furnitureGroups,environment:p.environment});

/** Explicit shared visual projection: private references, photos, specifications, drafts and future metadata stay local. */
export function collaborationPlan(source:PlanDocumentV1,id=source.id,name=source.name):PlanDocumentV1 {
  const p=reviewPlan(source,collabName(name,120));p.id=id;p.createdAt=source.createdAt;p.updatedAt=source.updatedAt;p.environment={...p.environment!,citySource:'standard'};
  if(source.furnitureGroups){validateFurnitureGroups(source.furnitureGroups,source);p.furnitureGroups=structuredClone(source.furnitureGroups);}
  if(p.furniture.length>500||p.floors.length>4||p.floors.reduce((n,f)=>n+f.cells.length,0)>4000||encodedBytes(p)>COLLAB_LIMITS.planBytes)throw new Error('The collaboration pilot supports up to 4 floors, 500 pieces, 4,000 cells and 750 KB. Keep this home as a private copy.');
  validatePlan(p);return p;
}
export function validateCollaborationPlan(p:unknown):asserts p is PlanDocumentV1 {validatePlan(p);if(canonical(collaborationPlan(p))!==canonical(p))throw new Error('Only the reviewed visual layout can be shared. Private metadata and media are not supported in this pilot.');}
const HASH=/^[a-f0-9]{64}$/;
export function parseCollaborationBatch(v:unknown):CollaborationBatch {
  const b=v as CollaborationBatch;
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['version','id','baseRevision','memberEpoch','label','architecture','operations','allowUnlock'].includes(k))||b.version!==1||!collabId(b.id)||!Number.isSafeInteger(b.baseRevision)||b.baseRevision<1||!Number.isSafeInteger(b.memberEpoch)||b.memberEpoch<1||!HASH.test(b.architecture)||!Array.isArray(b.operations)||!b.operations.length||b.operations.length>COLLAB_LIMITS.operations||encodedBytes(b)>COLLAB_LIMITS.operationBytes)throw new Error('This shared edit is too large or invalid. Save a local copy.');
  if(b.allowUnlock!==undefined&&(b.allowUnlock!==true||b.operations.length!==1||b.operations[0]?.kind!=='layout'))throw new Error('Unlock must be an explicit layout operation.');collabName(b.label,100);const ids=new Set<string>();
  for(const op of b.operations){
    if(!op||typeof op!=='object'||!['furniture','layout'].includes(op.kind))throw new Error('Unsupported shared operation.');
    if(op.kind==='layout'){if(b.operations.length!==1||Object.keys(op).some(k=>!['kind','before','value'].includes(k))||!HASH.test(op.before)||!op.value||Object.keys(op.value).some(k=>!['floors','furniture','gridSizeMm','furnitureGroups','environment'].includes(k)))throw new Error('Invalid layout operation.');}
    else if(Object.keys(op).some(k=>!['kind','id','before','value'].includes(k))||!collabId(op.id)||ids.has(op.id)||op.before!==null&&!HASH.test(op.before)||op.value!==null&&(!op.value||op.value.id!==op.id)||op.before===null&&op.value===null)throw new Error('Invalid furniture operation.');
    if(op.kind==='furniture')ids.add(op.id);
  }return structuredClone(b);
}
export async function makeCollaborationBatch(base:PlanDocumentV1,next:PlanDocumentV1,revision:number,epoch:number,label:string,id=crypto.randomUUID(),options:{allowUnlock?:boolean}={}):Promise<CollaborationBatch|null>{
  validateCollaborationPlan(base);validateCollaborationPlan(next);
  if(base.id!==next.id||base.name!==next.name||base.units!==next.units)throw new Error('Change project identity or units in a private copy.');
  assertLockedFurnitureUnchanged(base,next,options);
  const architectureHash=await collaborationHash(architecture(base));let operations:CollaborationBatch['operations'];
  if(canonical(architecture(base))!==canonical(architecture(next)))operations=[{kind:'layout',before:await collaborationHash(collaborationLayout(base)),value:structuredClone(collaborationLayout(next))}];
  else {const old=new Map(base.furniture.map(p=>[p.id,p])),current=new Map(next.furniture.map(p=>[p.id,p]));operations=[];for(const key of new Set([...old.keys(),...current.keys()]))if(canonical(old.get(key))!==canonical(current.get(key)))operations.push({kind:'furniture',id:key,before:old.has(key)?await collaborationHash(old.get(key)):null,value:structuredClone(current.get(key)??null)});}
  return operations.length?parseCollaborationBatch({version:1,id,baseRevision:revision,memberEpoch:epoch,label:collabName(label,100),architecture:architectureHash,...(options.allowUnlock&&operations[0]?.kind==='layout'?{allowUnlock:true}:{}),operations}):null;
}
export async function applyCollaborationBatch(current:PlanDocumentV1,revision:number,input:CollaborationBatch):Promise<PlanDocumentV1>{
  const b=parseCollaborationBatch(input);validateCollaborationPlan(current);
  if(b.baseRevision>revision)throw new CollaborationConflict(['revision']);
  const layout=b.operations.find((op):op is LayoutOperation=>op.kind==='layout');let next:PlanDocumentV1;
  if(layout){if(b.baseRevision!==revision||layout.before!==await collaborationHash(collaborationLayout(current)))throw new CollaborationConflict(['layout'],'The shared layout changed. Architecture and group changes require a fresh review.');next={...current,...structuredClone(layout.value),furnitureGroups:layout.value.furnitureGroups,environment:layout.value.environment};}
  else {
    if(b.architecture!==await collaborationHash(architecture(current)))throw new CollaborationConflict(['architecture'],'Architecture, supports or locks changed. Review your queued placement against the latest layout.');
    const pieces=new Map(current.furniture.map(p=>[p.id,p])),conflicts:string[]=[];
    for(const op of b.operations as FurnitureOperation[]){const old=pieces.get(op.id),fingerprint=old?await collaborationHash(old):null;if(fingerprint!==op.before)conflicts.push(op.id);}
    if(conflicts.length)throw new CollaborationConflict(conflicts);
    for(const op of b.operations as FurnitureOperation[])if(op.value)pieces.set(op.id,structuredClone(op.value));else pieces.delete(op.id);
    next={...current,furniture:[...pieces.values()]};
  }
  assertLockedFurnitureUnchanged(current,next,{allowUnlock:b.allowUnlock});validateCollaborationPlan(next);return next;
}
/** Recovery is always a download/local copy, never an implicit retry or remote overwrite. */
export function collaborationRecovery(roomId:string,base:CollaborationSnapshot|null,local:PlanDocumentV1,queue:CollaborationBatch[]){validateCollaborationPlan(local);return {schema:'nook-collaboration-recovery/1',roomId,exportedAt:new Date().toISOString(),baseRevision:base?.revision??null,plan:structuredClone(local),queuedOperations:queue.map(parseCollaborationBatch)};}

/** Undo only the caller's changed entities. A whole historical editor snapshot must never replace remote work. */
export async function reverseCollaborationEdit(before:PlanDocumentV1,after:PlanDocumentV1,current:PlanDocumentV1):Promise<PlanDocumentV1>{
  for(const p of [before,after,current])validateCollaborationPlan(p);
  if(before.id!==after.id||current.id!==after.id)throw new Error('Undo belongs to a different shared room.');
  if(canonical(architecture(before))!==canonical(architecture(after))){if(canonical(collaborationLayout(current))!==canonical(collaborationLayout(after)))throw new CollaborationConflict(['layout'],'Other shared work followed this architecture change. Recover the earlier version as a private copy.');const next={...current,...structuredClone(collaborationLayout(before)),furnitureGroups:before.furnitureGroups,environment:before.environment};assertLockedFurnitureUnchanged(current,next,{allowUnlock:true});return next;}
  if(canonical(architecture(current))!==canonical(architecture(after)))throw new CollaborationConflict(['architecture']);
  const old=new Map(before.furniture.map(p=>[p.id,p])),applied=new Map(after.furniture.map(p=>[p.id,p])),pieces=new Map(current.furniture.map(p=>[p.id,p]));
  for(const id of new Set([...old.keys(),...applied.keys()]))if(canonical(old.get(id))!==canonical(applied.get(id))){if(canonical(pieces.get(id))!==canonical(applied.get(id)))throw new CollaborationConflict([id],'This item changed after your edit. Review it instead of overwriting another editor’s work.');if(old.has(id))pieces.set(id,structuredClone(old.get(id)!));else pieces.delete(id);}
  const next={...current,furniture:[...pieces.values()]};assertLockedFurnitureUnchanged(current,next);validateCollaborationPlan(next);return next;
}
