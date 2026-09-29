import {parseRemixAttribution,type RemixCredit,type RemixAttribution} from './remixAttribution';
export {parseRemixAttribution,remixCreditPath,mergeRemixAttributions,withRemixAttribution,type RemixCredit,type RemixAttribution} from './remixAttribution';
import {reviewPlan} from './clientReview';
import {catalog} from './catalog';
import {createSamplePlan} from './domain';
import {floorFromRooms,geometryKey,roomGroups} from './blueprint';
import {footprint} from './agentDesign';
import {polygonBounds,shapeCovered} from './polygonGeometry';
import {floorRects} from './floorGeometry';
import {kitPieceProblem,cozyStarterKits,kitBounds,type FurnitureKit} from './furnitureKits';
import {validatePlan} from './planValidation';
import type {PlanDocumentV1} from './types';

export const REMIX_LIMITS={pieces:40,cells:2000,bytes:512*1024,ancestors:8,page:12,shares:40,revisions:10,pending:10,reports:100,reportHourly:5} as const;
export const remixTags=['small-space','reading','work','dining','bedroom','hobby','natural','colorful','calm','budget-unknown'] as const;
export type RemixTag=typeof remixTags[number];
export interface RemixSnapshot {version:1;kind:'kit'|'room';title:string;description:string;creator:string;tags:RemixTag[];allowCopy:boolean;attribution:RemixAttribution;plan:PlanDocumentV1}
export type RemixPlan=PlanDocumentV1&{remixAttribution?:RemixAttribution};
export interface RemixSelection {kind:'kit'|'room';floorId:string;roomKey?:string;selectedIds:string[];title:string;description:string;creator:string;tags:RemixTag[];allowCopy:boolean}
export const remixId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[])=>{if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new Error('This room package contains unsupported data.');return v;};
export function remixText(v:unknown,max:number,required=true){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(v)||required&&!v.trim())throw new Error('Use short plain text without markup.');return v.trim();}
/** Only canonical same-origin gallery references; unlisted bearer tokens never become attribution. */
export function remixRooms(plan:PlanDocumentV1,floorId:string){const f=plan.floors.find(f=>f.id===floorId);if(!f?.blueprint||f.blueprint.geometryKey!==geometryKey(f))return [];return roomGroups(f.blueprint.rooms).map(r=>({key:r.groupId??r.id,name:r.name,parts:r.parts}));}
const publicPlan=(plan:PlanDocumentV1)=>{const {remixAttribution:_credits,...p}=reviewPlan(plan,'Shared arrangement') as RemixPlan;p.environment={background:'plain',grass:'off',citySource:'standard'};return p;};
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':object(value)?'{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
export function parseRemixSnapshot(value:unknown):RemixSnapshot{
 const v=exact(value,['version','kind','title','description','creator','tags','allowCopy','attribution','plan']);if(v.version!==1||!['kit','room'].includes(v.kind)||typeof v.allowCopy!=='boolean'||!Array.isArray(v.tags)||v.tags.length>4||new Set(v.tags).size!==v.tags.length||v.tags.some(t=>!remixTags.includes(t)))throw new Error('Check the room type, tags and copying permission.');
 validatePlan(v.plan);const p=v.plan as PlanDocumentV1;if(p.floors.length!==1||!p.furniture.length||p.furniture.length>REMIX_LIMITS.pieces||!p.floors[0].cells.length||p.floors[0].cells.length>REMIX_LIMITS.cells||p.floors[0].walls.length||p.floors[0].stairs.length||p.floors[0].openings.length||p.floors[0].blueprint||canonical(p)!==canonical(publicPlan(p)))throw new Error('Only a bounded, sanitized single-room arrangement can be shared.');
 for(const item of p.furniture){if(kitPieceProblem(item)||item.floorId!==p.floors[0].id)throw new Error('This snapshot contains unavailable or unsupported catalog pieces.');const points=footprint(item);if(!shapeCovered(polygonBounds([points[0],points[1],points[3],points[2]]),floorRects(p.floors[0],p.gridSizeMm)))throw new Error('Every shared piece must fit inside the room outline.');}
 const result:RemixSnapshot={version:1,kind:v.kind,title:remixText(v.title,80),description:remixText(v.description,400,false),creator:remixText(v.creator,60),tags:[...v.tags],allowCopy:v.allowCopy,attribution:parseRemixAttribution(v.attribution),plan:structuredClone(p)};
 if(new TextEncoder().encode(JSON.stringify(result)).length>REMIX_LIMITS.bytes)throw new Error('This room package is too large. Use fewer pieces or a smaller room.');return result;
}
export function buildRemixSnapshot(source:RemixPlan,input:RemixSelection):RemixSnapshot{
 validatePlan(source);if(!input.selectedIds.length||input.selectedIds.length>40||new Set(input.selectedIds).size!==input.selectedIds.length)throw new Error('Choose 1–40 individual pieces to include.');const original=source.floors.find(f=>f.id===input.floorId);if(!original)throw new Error('Choose an existing floor.');const selected=source.furniture.filter(p=>input.selectedIds.includes(p.id));if(selected.length!==input.selectedIds.length||selected.some(p=>p.floorId!==original.id||kitPieceProblem(p)))throw new Error('Choose supported catalog furniture from this floor.');
 const clean=publicPlan(source);let floor={...clean.floors.find(f=>f.id===original.id)!,id:'shared-floor',name:'Shared room',elevationMm:0,walls:[],openings:[],stairs:[]};let x=0,z=0;
 const pieces=clean.furniture.filter(p=>input.selectedIds.includes(p.id));
 if(input.kind==='room'){const room=remixRooms(source,original.id).find(r=>r.key===input.roomKey);if(!room)throw new Error('Choose a current measured room.');x=Math.min(...room.parts.map(p=>p.x));z=Math.min(...room.parts.map(p=>p.z));const parts=room.parts.map(p=>({...p,id:'shared-room',name:'Shared room',x:p.x-x,z:p.z-z,...(p.polygon?{polygon:p.polygon.map(q=>({x:q.x-x,z:q.z-z}))}:{}),groupId:undefined}));floor=floorFromRooms(floor,source.gridSizeMm,parts) as typeof floor;
 }else{const corners=pieces.flatMap(footprint),left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.z)),bottom=Math.max(...corners.map(p=>p.z));x=left-500;z=top-500;floor=floorFromRooms(floor,source.gridSizeMm,[{id:'kit-room',name:'Shared room',kind:'Living',enclosed:true,x:0,z:0,width:right-left+1000,depth:bottom-top+1000}]) as typeof floor;}
 const plan=publicPlan({...clean,floors:[floor],furniture:pieces.map((p,i)=>({...p,id:'piece-'+(i+1),floorId:floor.id,x:p.x-x,z:p.z-z}))});
 return parseRemixSnapshot({version:1,kind:input.kind,title:input.title,description:input.description,creator:input.creator,tags:input.tags,allowCopy:input.allowCopy,attribution:source.remixAttribution??{version:1,credits:[]},plan});
}
/** Returns a copy seed, never saves or mutates any project. Parent remaps identity with its shared copy helper. */
export function remixCopySeed(input:unknown,source:{source:RemixCredit['source'];id:string;revision:number}):RemixPlan{const snapshot=parseRemixSnapshot(input);if(!snapshot.allowCopy)throw new Error('The creator has allowed viewing only.');const entry:RemixCredit={...source,title:snapshot.title,creator:snapshot.creator,permission:'remix-with-credit-v1'},credits=[...snapshot.attribution.credits.filter(c=>!(c.source===entry.source&&c.id===entry.id&&c.revision===entry.revision)),entry],attribution=parseRemixAttribution({version:1,credits});return {...structuredClone(snapshot.plan),name:snapshot.title+' · my copy',remixAttribution:attribution};}
export interface RemixPackage {schema:'nook-remix-package/1';snapshot:RemixSnapshot;source:Pick<RemixCredit,'source'|'id'|'revision'>}
export function parseRemixPackage(value:unknown):RemixPackage{const v=exact(value,['schema','snapshot','source']);if(v.schema!=='nook-remix-package/1')throw new Error('Unsupported room package.');const snapshot=parseRemixSnapshot(v.snapshot),source=exact(v.source,['source','id','revision']);parseRemixAttribution({version:1,credits:[{...source,title:snapshot.title,creator:snapshot.creator,permission:'remix-with-credit-v1'}]});return {schema:v.schema,snapshot,source:{source:source.source,id:source.id,revision:source.revision}};}
export function exportRemixSnapshot(value:unknown,source:RemixPackage['source']){const packet=parseRemixPackage({schema:'nook-remix-package/1',snapshot:value,source}),url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nook-room-'+packet.snapshot.kind+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function importRemixSnapshot(file:File){if(file.size>REMIX_LIMITS.bytes+2000)throw new Error('This room package exceeds 512 KB.');return parseRemixPackage(JSON.parse(await file.text()));}
export function originalRemixExamples():Array<{id:string;snapshot:RemixSnapshot}>{return cozyStarterKits.filter(k=>['starter-reading','starter-dining','starter-office'].includes(k.id)).map(kit=>{const base=createSamplePlan(kit.name,'metric');base.gridSizeMm=1000;base.floors=base.floors.slice(0,1);const bounds=kitBounds(kit);base.floors[0]=floorFromRooms(base.floors[0],1000,[{id:'example',name:'Example room',kind:'Living',enclosed:true,x:0,z:0,width:bounds.width+1600,depth:bounds.depth+1600}]);base.furniture=kit.pieces.map((p,i)=>({...p,id:'original-'+i,floorId:base.floors[0].id,x:p.x-bounds.left+800,z:p.z-bounds.top+800}));return {id:kit.id,snapshot:buildRemixSnapshot(base,{kind:'kit',floorId:base.floors[0].id,selectedIds:base.furniture.map(p=>p.id),title:kit.name,description:'An original Nook & Nest arrangement. Edit independent pieces in your own private copy.',creator:'Nook & Nest',tags:['calm','budget-unknown'],allowCopy:true})};});}
export function remixKitAttribution(plan:RemixPlan,kit:FurnitureKit){return {...kit,...(plan.remixAttribution?{remixAttribution:parseRemixAttribution(plan.remixAttribution)}:{})};}
