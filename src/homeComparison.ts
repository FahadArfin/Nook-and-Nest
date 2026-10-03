import {catalog} from './catalog';
import {floorRects} from './floorGeometry';
import {createFitReviewEvaluator,defaultFitReviewSettings,type FitIssue} from './fitReview';
import {parsePersonalCollectionItem,personalMetadata,type PersonalCollectionItem} from './personalItems';
import {personalProxyCatalog} from './personalPlacement';
import {reidentifyPrivatePlan} from './projectIdentity';
import {MAX_PLAN_BYTES,validatePlan} from './planValidation';
import type {FurniturePlacement,PlanDocumentV1} from './types';

export const MAX_COMPARISON_ITEMS=40,MAX_COMPARISON_BYTES=256*1024;
export interface HomeFurnitureSnapshot {capturedAt:string;measurementsVerified:boolean;items:PersonalCollectionItem[]}
export interface HomeComparisonPosition {itemId:string;floorId:string;x:number;z:number;rotation:number;elevationMm:number;reviewed:boolean}
export interface HomeComparisonCandidate {sourceId:string;name:string;location:'local'|'online';sourceUpdatedAt:string;sourceFingerprint?:string;copyId?:string;copyFingerprint?:string;measurementsVerified:boolean;assumptions:string;positions:HomeComparisonPosition[]}
export interface HomeComparisonPreferences {passageMm:number;chairPulloutMm:number}
export interface HomeComparisonWorkspace {version:1;id:string;revision:number;createdAt:string;updatedAt:string;snapshot:HomeFurnitureSnapshot;homes:HomeComparisonCandidate[];preferences:HomeComparisonPreferences;priorities:string}
export interface HomeComparisonReport {items:{itemId:string;name:string;status:'needs-checking'|'review'|'no-issues';issues:number;notes:string[]}[];issues:FitIssue[];unknowns:string[];limited:boolean;existingItems:number}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keys(v:Record<string,unknown>,allowed:string[]){if(Object.keys(v).some(k=>!allowed.includes(k)))throw new Error('Unsupported home comparison data.');}
function text(v:unknown,max:number,empty=false):string{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error('Invalid or oversized comparison text.');return v;}
function number(v:unknown,min:number,max:number):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid comparison measurement or position.');return v;}
function flag(v:unknown):boolean{if(typeof v!=='boolean')throw new Error('Invalid comparison verification.');return v;}
function date(v:unknown):string{const s=text(v,40);if(!Number.isFinite(Date.parse(s)))throw new Error('Invalid comparison date.');return s;}
function identity(v:unknown):string{const s=text(v,160);if(s.trim()!==s||/[\r\n\t]/.test(s))throw new Error('Invalid comparison identity.');return s;}
export function parseHomeComparisonWorkspace(value:unknown):HomeComparisonWorkspace{
 if(!object(value)||value.version!==1)throw new Error('Invalid home comparison workspace.');
 keys(value,['version','id','revision','createdAt','updatedAt','snapshot','homes','preferences','priorities']);
 if(!object(value.snapshot)||!Array.isArray(value.snapshot.items)||!value.snapshot.items.length||value.snapshot.items.length>MAX_COMPARISON_ITEMS)throw new Error(`Choose 1–${MAX_COMPARISON_ITEMS} owned items.`);
 keys(value.snapshot,['capturedAt','measurementsVerified','items']);
 const items=value.snapshot.items.map(parsePersonalCollectionItem),ids=new Set(items.map(i=>i.id));if(ids.size!==items.length)throw new Error('Choose distinct owned items.');
 if(!Array.isArray(value.homes)||value.homes.length<2||value.homes.length>3)throw new Error('Choose two or three distinct private homes.');
 const sourceIds=new Set<string>(),copyIds=new Set<string>();
 const homes=value.homes.map(raw=>{
  if(!object(raw))throw new Error('Invalid comparison home.');keys(raw,['sourceId','name','location','sourceUpdatedAt','sourceFingerprint','copyId','copyFingerprint','measurementsVerified','assumptions','positions']);
  const sourceId=identity(raw.sourceId);if(sourceIds.has(sourceId))throw new Error('Choose two or three distinct private homes.');sourceIds.add(sourceId);
  if(raw.location!=='local'&&raw.location!=='online')throw new Error('Choose a private saved project.');
  for(const key of ['sourceFingerprint','copyFingerprint'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||!/^sha256:[a-f0-9]{64}$/.test(raw[key] as string)))throw new Error('Invalid source fingerprint.');
  const copyId=raw.copyId===undefined?undefined:identity(raw.copyId);if(copyId){if(copyIds.has(copyId))throw new Error('Duplicate copy identity.');copyIds.add(copyId);}
  if(!Array.isArray(raw.positions)||raw.positions.length!==items.length)throw new Error('Every snapshot item needs a placement choice.');
  const positionIds=new Set<string>();const positions=raw.positions.map(p=>{
   if(!object(p))throw new Error('Invalid comparison position.');keys(p,['itemId','floorId','x','z','rotation','elevationMm','reviewed']);const itemId=identity(p.itemId);if(!ids.has(itemId)||positionIds.has(itemId))throw new Error('Invalid owned item position.');positionIds.add(itemId);
   return {itemId,floorId:identity(p.floorId),x:number(p.x,-10_000_000,10_000_000),z:number(p.z,-10_000_000,10_000_000),rotation:number(p.rotation,-36000,36000),elevationMm:number(p.elevationMm,-10000,100000),reviewed:flag(p.reviewed)};
  });
  return {sourceId,name:text(raw.name,160),location:raw.location,sourceUpdatedAt:date(raw.sourceUpdatedAt),...(raw.sourceFingerprint?{sourceFingerprint:raw.sourceFingerprint as string}:{}),...(copyId?{copyId}:{}),...(raw.copyFingerprint?{copyFingerprint:raw.copyFingerprint as string}:{}),measurementsVerified:flag(raw.measurementsVerified),assumptions:text(raw.assumptions,2000,true),positions} as HomeComparisonCandidate;
 });
 if([...copyIds].some(id=>sourceIds.has(id))||copyIds.size&&copyIds.size!==homes.length)throw new Error('Invalid independent copy identity.');
 if(!object(value.preferences))throw new Error('Invalid comparison preferences.');keys(value.preferences,['passageMm','chairPulloutMm']);
 const revision=number(value.revision,0,Number.MAX_SAFE_INTEGER);if(!Number.isInteger(revision))throw new Error('Invalid workspace revision.');
 const result:HomeComparisonWorkspace={version:1,id:identity(value.id),revision,createdAt:date(value.createdAt),updatedAt:date(value.updatedAt),snapshot:{capturedAt:date(value.snapshot.capturedAt),measurementsVerified:flag(value.snapshot.measurementsVerified),items},homes,preferences:{passageMm:number(value.preferences.passageMm,100,2500),chairPulloutMm:number(value.preferences.chairPulloutMm,100,1500)},priorities:text(value.priorities,2000,true)};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_COMPARISON_BYTES)throw new Error('Comparison workspace exceeds 256 KiB.');return result;
}

/** Explicitly selected collection records are detached from future edits to the collection. */
export function createHomeComparisonWorkspace(sources:{plan:PlanDocumentV1;location:'local'|'online'}[],items:PersonalCollectionItem[]):HomeComparisonWorkspace{
 const now=new Date().toISOString(),snapshot=items.map(parsePersonalCollectionItem);
 const homes=sources.map(({plan,location})=>{
  validatePlan(plan);const floor=plan.floors.find(f=>f.cells.length)??plan.floors[0],rects=floorRects(floor,plan.gridSizeMm),left=rects.length?Math.min(...rects.map(r=>r.x)):0,top=rects.length?Math.min(...rects.map(r=>r.z)):0;
  const columns=Math.max(1,Math.ceil(Math.sqrt(items.length))),width=Math.max(1000,...snapshot.map(i=>i.widthMm))+900,depth=Math.max(1000,...snapshot.map(i=>i.depthMm))+900;
  return {sourceId:plan.id,name:plan.name,location,sourceUpdatedAt:plan.updatedAt,measurementsVerified:false,assumptions:'',positions:snapshot.map((item,index)=>{
   const existing=plan.furniture.find(p=>p.personalItem?.itemId===item.id);
   return {itemId:item.id,floorId:existing?.floorId??floor.id,x:existing?.x??left+900+item.widthMm/2+index%columns*width,z:existing?.z??top+900+item.depthMm/2+Math.floor(index/columns)*depth,rotation:existing?.rotation??0,elevationMm:existing?.elevationMm??0,reviewed:false};
  })};
 });
 return parseHomeComparisonWorkspace({version:1,id:crypto.randomUUID(),revision:0,createdAt:now,updatedAt:now,snapshot:{capturedAt:now,measurementsVerified:false,items:snapshot},homes,preferences:{passageMm:900,chairPulloutMm:600},priorities:''});
}

export async function fingerprintHomePlan(plan:PlanDocumentV1):Promise<string>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(plan)));return 'sha256:'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}

/** Copy-only changes. Existing architecture, obstacles, colors and linked identities remain intact. */
export function buildHomeComparisonCopy(source:PlanDocumentV1,home:HomeComparisonCandidate,snapshot:HomeFurnitureSnapshot,id=crypto.randomUUID()):PlanDocumentV1{
 validatePlan(source);if(source.id!==home.sourceId||id===source.id)throw new Error('Invalid source or independent copy identity.');
 const plan=reidentifyPrivatePlan(source,id,`${source.name.slice(0,130)} · furniture comparison`),proxies=new Set(personalProxyCatalog.map(p=>p.id));
 for(const item of snapshot.items){
  parsePersonalCollectionItem(item);if(!proxies.has(item.catalogId))throw new Error(`${item.name}: choose an available catalog approximation in My furniture first.`);
  const position=home.positions.find(p=>p.itemId===item.id);if(!position||!plan.floors.some(f=>f.id===position.floorId&&f.cells.length))throw new Error(`${item.name}: choose a floor with measured geometry before creating a copy.`);
  const index=plan.furniture.findIndex(p=>p.personalItem?.itemId===item.id),old=index<0?undefined:plan.furniture[index];
  const piece:FurniturePlacement={...(old??{}),id:old?.id??crypto.randomUUID(),catalogId:item.catalogId,floorId:position.floorId,x:position.x,z:position.z,rotation:position.rotation,elevationMm:position.elevationMm,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,variant:old?.variant??'cream',personalItem:personalMetadata(item)};
  if(index<0)plan.furniture.push(piece);else plan.furniture[index]=piece;
  // Retain extra source copies as disclosed obstacles, with the same measured size.
  plan.furniture=plan.furniture.map(p=>p.id!==piece.id&&p.personalItem?.itemId===item.id?{...p,catalogId:item.catalogId,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,personalItem:personalMetadata(item)}:p);
 }
 // A manual floor choice may split an old furniture group; only that copy is detached.
 if(plan.furnitureGroups){const floors=new Map(plan.furniture.map(p=>[p.id,p.floorId]));plan.furnitureGroups={...plan.furnitureGroups,groups:plan.furnitureGroups.groups.map(group=>({...group,memberIds:group.memberIds.filter(id=>floors.get(id)===group.floorId)})).filter(group=>group.memberIds.length>=2)};}
 validatePlan(plan);if(new TextEncoder().encode(JSON.stringify(plan)).byteLength>MAX_PLAN_BYTES)throw new Error('A comparison copy exceeds the project size limit.');return plan;
}

/** Counts only checks involving the shared owned set; unrelated existing objects remain obstacles. */
export function assessHomeComparison(plan:PlanDocumentV1,home:HomeComparisonCandidate,snapshot:HomeFurnitureSnapshot,preferences:HomeComparisonPreferences):HomeComparisonReport{
 const selected=new Set(snapshot.items.map(i=>i.id)),placements=plan.furniture.filter(p=>p.personalItem&&selected.has(p.personalItem.itemId)),placementIds=new Set(placements.map(p=>p.id));
 const ordered={...plan,furniture:[...placements,...plan.furniture.filter(p=>!placementIds.has(p.id))]},issues:FitIssue[]=[],checked=new Set<string>(),unknowns:string[]=[];let limited=false;
 if(!snapshot.measurementsVerified)unknowns.push('Owned-item outside measurements are unverified; catalog defaults may still need replacing.');
 if(!home.measurementsVerified)unknowns.push('Property measurements and clear room boundaries are unverified.');
 const floors=new Set(placements.map(p=>p.floorId));
 for(const floorId of floors){const review=createFitReviewEvaluator().evaluate(ordered,floorId,{...defaultFitReviewSettings,...preferences,enabled:true,checkGaps:true,checkChairs:true,checkDoors:false,checkDrawers:false});issues.push(...review.issues.filter(i=>i.itemIds.some(id=>placementIds.has(id))));for(const id of review.stats.recomputedIds)checked.add(id);limited ||=review.stats.limited;}
 if(limited)unknowns.push('A bounded fit review omitted some checks; these totals are incomplete.');
 const unsupportedObstacles=plan.furniture.filter(p=>floors.has(p.floorId)&&!placementIds.has(p.id)&&!comparisonCatalogNames.has(p.catalogId));
 if(unsupportedObstacles.length){limited=true;unknowns.push(`${unsupportedObstacles.length} retained object${unsupportedObstacles.length===1?' has':'s have'} unavailable catalog metadata and cannot be included in obstacle checks on the compared floors; these totals are incomplete.`);}
 const items=snapshot.items.map(item=>{
  const matches=placements.filter(p=>p.personalItem?.itemId===item.id),notes:string[]=[];
  if(!matches.length)notes.push('This owned item is not placed in the saved copy.');
  if(matches.length>1)notes.push('Multiple existing copies of this owned item need review.');
  if(matches.some(p=>['widthMm','depthMm','heightMm'].some(key=>p[key as 'widthMm']!==item[key as 'widthMm'])||p.catalogId!==item.catalogId))notes.push('Saved dimensions differ from the frozen snapshot or its catalog approximation.');
  if(matches.some(p=>!checked.has(p.id)))notes.push('This item is outside the supported solid-footprint review or available catalog metadata.');
  if(!home.positions.find(p=>p.itemId===item.id)?.reviewed)notes.push('Its starting position has not been reviewed.');
  for(const note of notes)unknowns.push(`${item.name}: ${note}`);
  const count=issues.filter(issue=>issue.itemIds.some(id=>matches.some(p=>p.id===id))).length;
  return {itemId:item.id,name:item.name,status:notes.length||!snapshot.measurementsVerified||!home.measurementsVerified||limited?'needs-checking' as const:count?'review' as const:'no-issues' as const,issues:count,notes};
 });
 return {items,issues,unknowns,limited,existingItems:plan.furniture.length-placements.length};
}

export const comparisonCatalogNames=new Map(catalog.map(c=>[c.id,c.name]));
