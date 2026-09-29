import type {FurniturePlacement,PlanDocumentV1} from './types';
import {PERSONAL_PHOTO_ID} from './personalItems';

export const MAX_MOODBOARDS=8,MAX_MOODBOARD_PINS=32,MAX_MOODBOARD_COLORS=8,MAX_MOODBOARD_BYTES=256*1024;
export interface MoodboardColor {id:string;name:string;color:string}
export interface MoodboardTarget {floorId:string;scope:'floor'|'room'|'group';id?:string}
interface PinBase {id:string;label:string}
export type MoodboardPin=(PinBase&{kind:'image';assetId:string;attribution?:string;sourceUrl?:string})|(PinBase&{kind:'catalog';catalogId:string})|(PinBase&{kind:'finish';finishKind:'wall'|'floor'|'countertop';finishId:string})|(PinBase&{kind:'note';text:string});
export interface Moodboard {id:string;name:string;createdAt:string;updatedAt:string;pins:MoodboardPin[];palette:MoodboardColor[];bindings:{paletteId:string;slotId:string}[];target?:MoodboardTarget}
export interface Moodboards {version:1;boards:Moodboard[]}
export type MoodboardPlan=PlanDocumentV1&{moodboards?:Moodboards};
export interface PersonalSurface {
  version:1;kind:'art'|'swatch';assetId?:string;hidden?:true;label:string;slotId:string;
  crop:{x:number;y:number;width:number;height:number};rotation:0|90|180|270;fallbackColor:string;
  repeatWidthMm?:number;repeatHeightMm?:number;frameColor?:string;attribution?:string;sourceUrl?:string;
}
export type SurfacePlacement=FurniturePlacement&{personalSurface?:PersonalSurface};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(v:Record<string,unknown>,allowed:string[])=>{if(Object.keys(v).some(k=>!allowed.includes(k)))throw new Error('Unsupported moodboard or image field.');};
function text(value:unknown,max:number,empty=false){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error('A moodboard label or note is invalid or too long.');return value;}
const color=(v:unknown)=>{if(typeof v!=='string'||!/^#[a-f\d]{6}$/i.test(v))throw new Error('Choose a six-digit color.');return v.toLowerCase();};
const identity=(v:unknown)=>{const id=text(v,160);if(/[\r\n\t]/.test(id)||id!==id.trim())throw new Error('Invalid moodboard identity.');return id;};
function source(value:Record<string,unknown>){const result:{attribution?:string;sourceUrl?:string}={};if(value.attribution!==undefined)result.attribution=text(value.attribution,300,true);if(value.sourceUrl!==undefined){const raw=text(value.sourceUrl,2048);let url:URL;try{url=new URL(raw)}catch{throw new Error('Use an http or https source link.');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an http or https source link without sign-in details.');result.sourceUrl=url.href;}return result;}
export function parseMoodboardPin(value:unknown):MoodboardPin {
  if(!record(value))throw new Error('Invalid moodboard pin.');const base={id:identity(value.id),label:text(value.label,120)};
  if(value.kind==='image'){keys(value,['id','label','kind','assetId','attribution','sourceUrl']);if(typeof value.assetId!=='string'||!PERSONAL_PHOTO_ID.test(value.assetId))throw new Error('Invalid private image reference.');return {...base,kind:'image',assetId:value.assetId,...source(value)};}
  if(value.kind==='catalog'){keys(value,['id','label','kind','catalogId']);return {...base,kind:'catalog',catalogId:identity(value.catalogId)};}
  if(value.kind==='finish'){keys(value,['id','label','kind','finishKind','finishId']);if(!['wall','floor','countertop'].includes(value.finishKind as string))throw new Error('Invalid finish reference.');return {...base,kind:'finish',finishKind:value.finishKind as 'wall'|'floor'|'countertop',finishId:identity(value.finishId)};}
  if(value.kind==='note'){keys(value,['id','label','kind','text']);return {...base,kind:'note',text:text(value.text,2000)};}
  throw new Error('Unknown moodboard pin type.');
}
export function parseMoodboard(value:unknown):Moodboard {
  if(!record(value))throw new Error('Invalid moodboard.');keys(value,['id','name','createdAt','updatedAt','pins','palette','bindings','target']);
  if(!Array.isArray(value.pins)||value.pins.length>MAX_MOODBOARD_PINS||!Array.isArray(value.palette)||value.palette.length>MAX_MOODBOARD_COLORS||!Array.isArray(value.bindings)||value.bindings.length>12)throw new Error('Keep up to 32 pins, 8 colors and 12 linked material roles per board.');
  for(const key of ['createdAt','updatedAt'])if(typeof value[key]!=='string'||value[key].length>40||!Number.isFinite(Date.parse(value[key])))throw new Error('Invalid moodboard date.');
  const pins=value.pins.map(parseMoodboardPin),palette=value.palette.map(v=>{if(!record(v))throw new Error('Invalid palette color.');keys(v,['id','name','color']);return {id:identity(v.id),name:text(v.name,60),color:color(v.color)};});
  if(new Set(pins.map(p=>p.id)).size!==pins.length||new Set(palette.map(p=>p.id)).size!==palette.length)throw new Error('Duplicate pin or color identity.');
  const colors=new Set(palette.map(p=>p.id)),bindings=value.bindings.map(v=>{if(!record(v))throw new Error('Invalid material binding.');keys(v,['paletteId','slotId']);const paletteId=identity(v.paletteId);if(!colors.has(paletteId))throw new Error('A material role refers to a missing palette color.');return {paletteId,slotId:identity(v.slotId)};});
  if(new Set(bindings.map(b=>b.slotId)).size!==bindings.length)throw new Error('Choose one color per material role.');
  let target:MoodboardTarget|undefined;if(value.target!==undefined){const t=value.target;if(!record(t))throw new Error('Invalid moodboard target.');keys(t,['floorId','scope','id']);if(!['floor','room','group'].includes(t.scope as string)||t.scope==='floor'&&t.id!==undefined||t.scope!=='floor'&&t.id===undefined)throw new Error('Choose a valid room or group target.');target={floorId:identity(t.floorId),scope:t.scope as MoodboardTarget['scope'],...(t.id!==undefined?{id:identity(t.id)}:{})};}
  return {id:identity(value.id),name:text(value.name,80),createdAt:value.createdAt as string,updatedAt:value.updatedAt as string,pins,palette,bindings,...(target?{target}:{})};
}
export function parseMoodboards(value:unknown):Moodboards {
  if(!record(value)||value.version!==1||!Array.isArray(value.boards)||value.boards.length>MAX_MOODBOARDS)throw new Error('Keep up to 8 inspiration boards per project.');keys(value,['version','boards']);
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>MAX_MOODBOARD_BYTES)throw new Error('Moodboard notes and links exceed the 256 KB project allowance.');
  const boards=value.boards.map(parseMoodboard);if(new Set(boards.map(b=>b.id)).size!==boards.length)throw new Error('Duplicate moodboard identity.');return {version:1,boards};
}
export function parsePersonalSurface(value:unknown):PersonalSurface {
  if(!record(value)||value.version!==1||!['art','swatch'].includes(value.kind as string))throw new Error('Invalid personal image surface.');
  keys(value,['version','kind','assetId','hidden','label','slotId','crop','rotation','fallbackColor','repeatWidthMm','repeatHeightMm','frameColor','attribution','sourceUrl']);
  if(value.hidden===true){if(value.assetId!==undefined||value.attribution!==undefined||value.sourceUrl!==undefined)throw new Error('Hidden personal surfaces cannot expose a private asset or source.');}else if(value.hidden!==undefined||typeof value.assetId!=='string'||!PERSONAL_PHOTO_ID.test(value.assetId))throw new Error('Choose a private image for this surface.');
  const crop=value.crop;if(!record(crop))throw new Error('Invalid crop.');keys(crop,['x','y','width','height']);for(const key of ['x','y','width','height'])if(typeof crop[key]!=='number'||!Number.isFinite(crop[key])||(crop[key] as number)<0||(crop[key] as number)>1)throw new Error('Crop values must be inside the image.');
  if(!(Number(crop.width)>0&&Number(crop.height)>0)||Number(crop.x)+Number(crop.width)>1.000000001||Number(crop.y)+Number(crop.height)>1.000000001)throw new Error('Crop must have positive area inside the image.');
  if(![0,90,180,270].includes(value.rotation as number))throw new Error('Choose a quarter-turn image rotation.');
  const result:PersonalSurface={version:1,kind:value.kind as 'art'|'swatch',...(value.hidden?{hidden:true}:{assetId:value.assetId as string}),label:text(value.label,120),slotId:identity(value.slotId),crop:{x:crop.x as number,y:crop.y as number,width:crop.width as number,height:crop.height as number},rotation:value.rotation as PersonalSurface['rotation'],fallbackColor:color(value.fallbackColor),...source(value)};
  if(value.kind==='swatch'){if(value.frameColor!==undefined)throw new Error('Frame color belongs to artwork.');for(const key of ['repeatWidthMm','repeatHeightMm'] as const){if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<10||value[key]>10000)throw new Error('Swatch repeats must be between 10 mm and 10 metres.');result[key]=value[key];}}
  else {if(value.repeatWidthMm!==undefined||value.repeatHeightMm!==undefined)throw new Error('Artwork uses a single image, not a repeating swatch.');if(value.frameColor!==undefined)result.frameColor=color(value.frameColor);}
  return result;
}
export function collectMoodboardAssetIds(plan:PlanDocumentV1):string[]{
  const result=new Set<string>();const visit=(value:unknown)=>{const layout=value as {moodboards?:Moodboards;furniture:SurfacePlacement[]};for(const board of layout.moodboards?.boards??[])for(const pin of board.pins)if(pin.kind==='image')result.add(pin.assetId);for(const piece of layout.furniture){const s=piece.personalSurface;if(s?.assetId&&!s.hidden)result.add(s.assetId);}};
  visit(plan);for(const option of plan.layoutAlternatives?.options??[])visit(option.snapshot);return [...result];
}
/** Public plans keep a readable placeholder recipe, with no personal source/hash/label. */
export function publicMoodboardPlan<T extends PlanDocumentV1>(plan:T):T {
  const strip=(value:unknown)=>{const {moodboards:_boards,...layout}=value as {moodboards?:Moodboards;furniture:SurfacePlacement[]};return {...layout,furniture:layout.furniture.map(piece=>{if(!piece.personalSurface)return piece;const {assetId:_asset,attribution:_credit,sourceUrl:_url,...safe}=parsePersonalSurface(piece.personalSurface);return {...piece,personalSurface:{...safe,hidden:true as const,label:safe.kind==='art'?'Private artwork':'Private material'}};})};};
  return {...strip(plan),...(plan.layoutAlternatives?{layoutAlternatives:{...plan.layoutAlternatives,options:plan.layoutAlternatives.options.map(option=>({...option,snapshot:strip(option.snapshot)}))}}:{})} as T;
}
