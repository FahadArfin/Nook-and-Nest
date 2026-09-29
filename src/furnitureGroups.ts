import {catalog, isStairs, isWallOpening} from './catalog';
import type {FurniturePlacement, PlanDocumentV1} from './types';

export const MAX_FURNITURE_GROUPS = 100;
export const MAX_GROUP_MEMBERS = 80;
export const MAX_LOCKED_ITEMS = 2000;
export interface FurnitureGroup {id:string; name:string; floorId:string; memberIds:string[]; locked:boolean}
export interface FurnitureGroups {version:1; groups:FurnitureGroup[]; lockedItemIds:string[]}
export type GroupPlan = PlanDocumentV1 & {furnitureGroups?:FurnitureGroups};
export type GroupCommand =
  | {type:'group'; ids:readonly string[]; name:string}
  | {type:'rename'; groupId:string; name:string}
  | {type:'ungroup'; groupId:string}
  | {type:'lock-group'; groupId:string; locked:boolean}
  | {type:'lock-items'; ids:readonly string[]; locked:boolean}
  | {type:'move'; ids:readonly string[]; dx:number; dz:number}
  | {type:'rotate'; ids:readonly string[]; degrees:number; pivot?:{x:number; z:number}}
  | {type:'duplicate'; ids:readonly string[]; dx:number; dz:number}
  | {type:'delete'; ids:readonly string[]};
export interface GroupResult {plan:GroupPlan; selectedIds:string[]}
export interface FurnitureSelectionTransform {deltaX:number;deltaZ:number;degrees:number;pivot?:{x:number;z:number}}
type Validator = (value:unknown)=>void;
const empty = ():FurnitureGroups=>({version:1,groups:[],lockedItemIds:[]});
const groupsOf = (plan:GroupPlan)=>plan.furnitureGroups??empty();
const catalogById = new Map(catalog.map(item=>[item.id,item]));
const record = (v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text = (v:unknown,max=160):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const finite = (v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=10_000_000;
const keys = (v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(key=>allowed.includes(key));
export function furnitureGroupName(value:unknown):string {
  if(!text(value,80))throw new Error('Give this group a name of 1–80 characters.');
  return value.trim();
}

/** Shared import/server guard. Missing metadata means an ordinary legacy plan. */
export function validateFurnitureGroups(value:unknown, plan:Pick<PlanDocumentV1,'floors'|'furniture'>):asserts value is FurnitureGroups|undefined {
  if(value===undefined)return;
  function fail():never {throw new Error('This project contains invalid furniture groups or locks.');}
  if(!record(value)||!keys(value,['version','groups','lockedItemIds'])||value.version!==1||!Array.isArray(value.groups)||value.groups.length>MAX_FURNITURE_GROUPS||!Array.isArray(value.lockedItemIds)||value.lockedItemIds.length>MAX_LOCKED_ITEMS)fail();
  if(new TextEncoder().encode(JSON.stringify(value)).length>250_000)fail();
  const pieces=new Map(plan.furniture.map(p=>[p.id,p])), floors=new Set(plan.floors.map(f=>f.id));
  if(pieces.size!==plan.furniture.length)fail();
  const groupIds=new Set<string>(), members=new Set<string>(), locked=new Set<string>();
  for(const candidate of value.groups as unknown[]){
    if(!record(candidate)||!keys(candidate,['id','name','floorId','memberIds','locked'])||!text(candidate.id)||pieces.has(candidate.id)||groupIds.has(candidate.id)||!text(candidate.name,80)||candidate.name!==candidate.name.trim()||!text(candidate.floorId)||!floors.has(candidate.floorId)||typeof candidate.locked!=='boolean'||!Array.isArray(candidate.memberIds)||candidate.memberIds.length<2||candidate.memberIds.length>MAX_GROUP_MEMBERS)fail();
    groupIds.add(candidate.id);
    for(const id of candidate.memberIds){if(!text(id)||members.has(id)||pieces.get(id)?.floorId!==candidate.floorId)fail();members.add(id);}
  }
  for(const id of value.lockedItemIds){if(!text(id)||locked.has(id)||!pieces.has(id))fail();locked.add(id);}
}

export function furnitureGroupFor(plan:GroupPlan,id:string):FurnitureGroup|undefined {
  return plan.furnitureGroups?.groups.find(group=>group.memberIds.includes(id));
}
export function furnitureIsLocked(plan:GroupPlan,id:string):boolean {
  return !!plan.furnitureGroups?.lockedItemIds.includes(id)||!!furnitureGroupFor(plan,id)?.locked;
}
export const groupForItem=furnitureGroupFor;
export const isFurnitureLocked=furnitureIsLocked;
export function expandedFurnitureSelection(plan:GroupPlan,ids:readonly string[]):string[] {
  if(!ids.length)return [];
  const floorId=plan.furniture.find(p=>p.id===ids[0])?.floorId;
  if(!floorId)throw new Error('A selected piece is no longer available.');
  return expandFurnitureSelection(plan,floorId,ids);
}
/** Scene picking may explicitly select a whole saved group; never auto-include a support. */
export function expandFurnitureSelection(plan:GroupPlan,floorId:string,ids:readonly string[]):string[] {
  validateFurnitureGroups(plan.furnitureGroups,plan);
  const selected=selection(plan,floorId,ids), result=new Set(selected.map(p=>p.id));
  for(const piece of selected)for(const id of furnitureGroupFor(plan,piece.id)?.memberIds??[])result.add(id);
  if(result.size>MAX_GROUP_MEMBERS)throw new Error(`Select up to ${MAX_GROUP_MEMBERS} pieces at once.`);
  return [...result];
}
function selection(plan:GroupPlan,floorId:string,ids:readonly string[]):FurniturePlacement[] {
  if(!plan.floors.some(f=>f.id===floorId))throw new Error('Choose an existing floor.');
  if(!Array.isArray(ids)||!ids.length||ids.length>MAX_GROUP_MEMBERS||ids.some(id=>!text(id))||new Set(ids).size!==ids.length)throw new Error(`Select 1–${MAX_GROUP_MEMBERS} distinct pieces.`);
  const byId=new Map(plan.furniture.map(p=>[p.id,p]));
  return ids.map(id=>{const p=byId.get(id);if(!p||p.floorId!==floorId)throw new Error('The selection changed. Choose pieces on the current floor.');return p;});
}
export function assertFurnitureEditable(plan:GroupPlan,ids:readonly string[],wholeGroups=false):void {
  const existing=new Set(plan.furniture.map(p=>p.id)),selected=new Set(ids),locked=new Set(plan.furnitureGroups?.lockedItemIds??[]),byMember=new Map<string,FurnitureGroup>();
  for(const group of plan.furnitureGroups?.groups??[])for(const id of group.memberIds)byMember.set(id,group);
  for(const id of ids){
    if(!existing.has(id))throw new Error('A selected piece is no longer available.');
    const group=byMember.get(id);
    if(locked.has(id)||group?.locked)throw new Error('Unlock the selected pieces or group before editing.');
    if(wholeGroups&&group&&!group.memberIds.every(member=>selected.has(member)))throw new Error('Select the whole group, or ungroup it before editing one piece.');
  }
}
/** A commit-level guard for direct edits, proposals, clear-floor and replacement layouts. */
export function assertLockedFurnitureUnchanged(base:GroupPlan,next:GroupPlan,options:{allowUnlock?:boolean}={}):void {
  const lockedIds=(plan:GroupPlan)=>new Set([...(plan.furnitureGroups?.lockedItemIds??[]),...(plan.furnitureGroups?.groups??[]).filter(g=>g.locked).flatMap(g=>g.memberIds)]);
  const nextPieces=new Map(next.furniture.map(p=>[p.id,p])),locked=lockedIds(base),nextLocked=lockedIds(next);
  for(const piece of base.furniture)if(locked.has(piece.id)){
    if(canonical(piece)!==canonical(nextPieces.get(piece.id)))throw new Error('Unlock protected furniture before changing or removing it.');
    if(!options.allowUnlock&&!nextLocked.has(piece.id))throw new Error('Use Unlock explicitly before removing a furniture lock.');
  }
}
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(record(value))return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value)??'undefined';
}
export function groupPieceProblem(piece:FurniturePlacement):string|undefined {
  const item=catalogById.get(piece.catalogId);
  if(!item)return `The catalog no longer includes ${piece.catalogId}.`;
  if(isStairs(item.id)||isWallOpening(item.id)||piece.toFloorId||piece.hostDoorId||item.mount==='wall'||item.mount==='ceiling'||piece.terrainAnchored)return 'Move wall attachments, doors, stairs and terrain pieces with their individual placement tools.';
  return undefined;
}
/** Use after explicit deletion/replacement, inside the SAME history commit. */
export function reconcileFurnitureGroups(plan:GroupPlan):GroupPlan;
export function reconcileFurnitureGroups(base:GroupPlan,next:GroupPlan):GroupPlan;
export function reconcileFurnitureGroups(base:GroupPlan,next:GroupPlan=base):GroupPlan {
  // One-argument cleanup is for an already-authorized mutation; run the lock guard BEFORE it.
  if(next!==base){validateFurnitureGroups(base.furnitureGroups,base);assertLockedFurnitureUnchanged(base,next);}
  if(!base.furnitureGroups)return next;
  const pieces=new Map(next.furniture.map(p=>[p.id,p])), floors=new Set(next.floors.map(f=>f.id));
  const metadata:FurnitureGroups={version:1,groups:base.furnitureGroups.groups.filter(g=>floors.has(g.floorId)).map(g=>({...g,memberIds:g.memberIds.filter(id=>pieces.get(id)?.floorId===g.floorId)})).filter(g=>g.memberIds.length>=2),lockedItemIds:base.furnitureGroups.lockedItemIds.filter(id=>pieces.has(id))};
  validateFurnitureGroups(metadata,next);
  return {...next,furnitureGroups:metadata};
}

/** Returns one candidate only. The host owns validation, preview, commit and one-step undo. */
export function applyFurnitureGroupCommand(base:GroupPlan,current:GroupPlan,floorId:string,command:GroupCommand,validate:Validator,allocateId:()=>string=()=>crypto.randomUUID()):GroupResult {
  if(base!==current)throw new Error('The project changed. Review the selection again.');
  validate(base);validateFurnitureGroups(base.furnitureGroups,base);
  if(!planHasFloor(base,floorId))throw new Error('Choose an existing floor.');
  const data=groupsOf(base), usedIds=new Set([...base.furniture.map(p=>p.id),...data.groups.map(g=>g.id)]);
  const freshId=()=>{const id=allocateId();if(!text(id)||usedIds.has(id))throw new Error('Could not allocate a unique furniture identity. Try again.');usedIds.add(id);return id;};
  const groupById=(id:string)=>{const group=data.groups.find(g=>g.id===id&&g.floorId===floorId);if(!group)throw new Error('This group is no longer on the current floor.');return group;};
  let next:GroupPlan=base, selectedIds:string[]=[];
  const metadata=(groups:FurnitureGroup[],lockedItemIds=data.lockedItemIds)=>({...base,furnitureGroups:{version:1 as const,groups,lockedItemIds}});
  switch(command.type){
    case 'group':{
      const chosen=selection(base,floorId,command.ids);assertFurnitureEditable(base,command.ids);
      if(chosen.length<2)throw new Error('Select at least two pieces to make a group.');
      if(chosen.some(p=>furnitureGroupFor(base,p.id)))throw new Error('Ungroup existing sets before making a new group.');
      for(const piece of chosen){const problem=groupPieceProblem(piece);if(problem)throw new Error(problem);}
      next=metadata([...data.groups,{id:freshId(),name:furnitureGroupName(command.name),floorId,memberIds:[...command.ids],locked:false}]);selectedIds=[...command.ids];break;
    }
    case 'rename':{const group=groupById(command.groupId);next=metadata(data.groups.map(g=>g===group?{...g,name:furnitureGroupName(command.name)}:g));selectedIds=[...group.memberIds];break;}
    case 'ungroup':{const group=groupById(command.groupId);assertFurnitureEditable(base,group.memberIds);next=metadata(data.groups.filter(g=>g!==group));selectedIds=[...group.memberIds];break;}
    case 'lock-group':{const group=groupById(command.groupId);if(typeof command.locked!=='boolean')throw new Error('Choose Lock or Unlock.');next=metadata(data.groups.map(g=>g===group?{...g,locked:command.locked}:g));selectedIds=[...group.memberIds];break;}
    case 'lock-items':{selection(base,floorId,command.ids);if(typeof command.locked!=='boolean')throw new Error('Choose Lock or Unlock.');const locked=new Set(data.lockedItemIds);for(const id of command.ids)if(command.locked)locked.add(id);else locked.delete(id);next=metadata(data.groups,[...locked]);selectedIds=[...command.ids];break;}
    case 'move':case 'rotate':case 'duplicate':case 'delete':{
      const chosen=selection(base,floorId,command.ids);assertFurnitureEditable(base,command.ids,true);selectedIds=[...command.ids];
      for(const piece of chosen){const problem=groupPieceProblem(piece);if(problem&&command.type!=='delete')throw new Error(problem);}
      const selected=new Set(command.ids);
      if(command.type==='delete'){next=reconcileFurnitureGroups(base,{...base,furniture:base.furniture.filter(p=>!selected.has(p.id))});selectedIds=[];break;}
      let transform:(piece:FurniturePlacement)=>FurniturePlacement;
      if(command.type==='rotate'){
        if(!finite(command.degrees)||command.pivot&&(!finite(command.pivot.x)||!finite(command.pivot.z)))throw new Error('Enter a valid rotation and pivot.');
        const pivot=command.pivot??{x:chosen.reduce((sum,p)=>sum+p.x,0)/chosen.length,z:chosen.reduce((sum,p)=>sum+p.z,0)/chosen.length};
        const degrees=command.degrees%360,a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
        if(degrees===0)return {plan:base,selectedIds};
        transform=p=>({...p,x:pivot.x+(p.x-pivot.x)*c+(p.z-pivot.z)*s,z:pivot.z-(p.x-pivot.x)*s+(p.z-pivot.z)*c,rotation:((p.rotation+degrees)%360+360)%360});
      }else{
        if(!finite(command.dx)||!finite(command.dz))throw new Error('Enter a valid movement distance.');
        if(command.type==='move'&&command.dx===0&&command.dz===0)return {plan:base,selectedIds};
        const {dx,dz}=command;transform=p=>({...p,x:p.x+dx,z:p.z+dz});
      }
      if(command.type==='duplicate'){
        const mapping=new Map(chosen.map(p=>[p.id,freshId()]));
        const copies=chosen.map(p=>({...transform(structuredClone(p)),id:mapping.get(p.id)!}));
        const copiedGroups=data.groups.filter(g=>g.memberIds.every(id=>selected.has(id))).map(g=>({...g,id:freshId(),name:(g.name.slice(0,75)+' copy'),memberIds:g.memberIds.map(id=>mapping.get(id)!),locked:false}));
        next={...metadata([...data.groups,...copiedGroups]),furniture:[...base.furniture,...copies]};selectedIds=copies.map(p=>p.id);
      }else next={...base,furniture:base.furniture.map(p=>selected.has(p.id)?transform(p):p)};
      break;
    }
    default:throw new Error('Unknown group action.');
  }
  validateFurnitureGroups(next.furnitureGroups,next);validate(next);
  if(new TextEncoder().encode(JSON.stringify(next)).length>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');
  return {plan:next,selectedIds};
}
const planHasFloor=(plan:GroupPlan,id:string)=>plan.floors.some(f=>f.id===id);

/** Cheap transient transform of a previously validated plan. No serialization, storage or history. */
export function transformSelectedPlacements(plan:GroupPlan,floorId:string,ids:readonly string[],delta:FurnitureSelectionTransform):GroupResult {
  if(!finite(delta.deltaX)||!finite(delta.deltaZ)||!finite(delta.degrees)||delta.pivot&&(!finite(delta.pivot.x)||!finite(delta.pivot.z)))throw new Error('Enter a valid group transform.');
  const chosen=selection(plan,floorId,ids);assertFurnitureEditable(plan,ids,true);
  for(const piece of chosen){const problem=groupPieceProblem(piece);if(problem)throw new Error(problem);}
  const degrees=delta.degrees%360;
  if(!degrees&&!delta.deltaX&&!delta.deltaZ)return {plan,selectedIds:[...ids]};
  const pivot=delta.pivot??{x:chosen.reduce((sum,p)=>sum+p.x,0)/chosen.length,z:chosen.reduce((sum,p)=>sum+p.z,0)/chosen.length};
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),selected=new Set(ids);
  const furniture=plan.furniture.map(p=>{
    if(!selected.has(p.id))return p;
    const x=pivot.x+(p.x-pivot.x)*c+(p.z-pivot.z)*s+delta.deltaX,z=pivot.z-(p.x-pivot.x)*s+(p.z-pivot.z)*c+delta.deltaZ;
    const rotation=degrees?((p.rotation+degrees)%360+360)%360:p.rotation;
    if(!finite(x)||!finite(z)||!finite(rotation))throw new Error('The transformed furniture is outside the planning limits.');
    return {...p,x,z,rotation};
  });
  return {plan:{...plan,furniture},selectedIds:[...ids]};
}

/** One combined rotation/translation candidate, one full validation and one size check. */
export function transformFurnitureSelection(base:GroupPlan,current:GroupPlan,floorId:string,ids:readonly string[],delta:FurnitureSelectionTransform,validate:Validator):GroupResult {
  if(base!==current)throw new Error('The project changed. Review the selection again.');
  validateFurnitureGroups(base.furnitureGroups,base);
  const result=transformSelectedPlacements(base,floorId,ids,delta);
  validate(result.plan);
  if(new TextEncoder().encode(JSON.stringify(result.plan)).length>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');
  return result;
}
