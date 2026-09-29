import type {FurniturePlacement,PlanDocumentV1} from './types';

export const MAX_PERSONAL_ITEMS=100;
export const PERSONAL_PHOTO_ID=/^sha256:[a-f0-9]{64}$/;
export interface PersonalItemMetadata {
  version:1;itemId:string;name:string;representation:'catalog-proxy';status:'keep'|'replace';notes?:string;photoAssetId?:string;
}
export interface PersonalCollectionItem {
  version:1;id:string;name:string;catalogId:string;widthMm:number;depthMm:number;heightMm:number;
  status:'keep'|'replace';notes?:string;photoAssetId?:string;revision:number;createdAt:string;updatedAt:string;
}
export type PersonalPlacement=FurniturePlacement&{personalItem?:PersonalItemMetadata};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const label=(v:unknown,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new Error('Enter a valid personal item name or identity.');return v.trim();};
function details(v:Record<string,unknown>):Pick<PersonalItemMetadata,'name'|'status'|'notes'|'photoAssetId'>{
  const name=label(v.name,100);if(v.status!=='keep'&&v.status!=='replace')throw new Error('Choose Keep or Replace for this item.');
  if(v.notes!==undefined&&(typeof v.notes!=='string'||v.notes.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.notes)))throw new Error('Keep personal notes within 2,000 characters.');
  if(v.photoAssetId!==undefined&&(typeof v.photoAssetId!=='string'||!PERSONAL_PHOTO_ID.test(v.photoAssetId)))throw new Error('Invalid private photo reference.');
  return {name,status:v.status, ...(v.notes?{notes:v.notes as string}:{}),...(v.photoAssetId?{photoAssetId:v.photoAssetId as string}:{})};
}
export function parsePersonalItemMetadata(value:unknown):PersonalItemMetadata {
  if(!record(value)||value.version!==1||value.representation!=='catalog-proxy'||Object.keys(value).some(k=>!['version','itemId','name','representation','status','notes','photoAssetId'].includes(k)))throw new Error('Invalid personal furniture details.');
  return {version:1,itemId:label(value.itemId,100),representation:'catalog-proxy',...details(value)};
}
export function parsePersonalCollectionItem(value:unknown):PersonalCollectionItem {
  if(!record(value)||value.version!==1||Object.keys(value).some(k=>!['version','id','name','catalogId','widthMm','depthMm','heightMm','status','notes','photoAssetId','revision','createdAt','updatedAt'].includes(k)))throw new Error('Invalid personal collection item.');
  for(const key of ['widthMm','depthMm','heightMm'])if(typeof value[key]!=='number'||!Number.isFinite(value[key])||(value[key] as number)<1||(value[key] as number)>50000)throw new Error('Enter dimensions between 1 mm and 50 metres.');
  if(!Number.isSafeInteger(value.revision)||(value.revision as number)<0)throw new Error('Invalid personal item revision.');
  for(const key of ['createdAt','updatedAt'])if(typeof value[key]!=='string'||value[key].length>40||!Number.isFinite(Date.parse(value[key])))throw new Error('Invalid personal item date.');
  return {version:1,id:label(value.id,100),catalogId:label(value.catalogId,160),...details(value),widthMm:value.widthMm as number,depthMm:value.depthMm as number,heightMm:value.heightMm as number,revision:value.revision as number,createdAt:value.createdAt as string,updatedAt:value.updatedAt as string};
}
export function personalMetadata(item:PersonalCollectionItem):PersonalItemMetadata {return parsePersonalItemMetadata({version:1,itemId:item.id,name:item.name,representation:'catalog-proxy',status:item.status,notes:item.notes,photoAssetId:item.photoAssetId});}
export function personalItemLabel(item:PersonalPlacement){return item.personalItem?`${item.personalItem.name} · Approximate visual · ${item.personalItem.status==='keep'?'Keep':'Replace'}`:undefined;}
export function publicPersonalMetadata(value:PersonalItemMetadata):PersonalItemMetadata {
  const {notes:_notes,photoAssetId:_photo,...safe}=parsePersonalItemMetadata(value);return safe;
}
/** Call from publicLayoutPlan on both client and worker. Never use for private saves. */
export function publicPersonalPlan<T extends PlanDocumentV1>(plan:T):T {
  const strip=(pieces:FurniturePlacement[])=>pieces.map(piece=>{const personal=(piece as PersonalPlacement).personalItem;return personal?{...piece,personalItem:publicPersonalMetadata(personal)}:piece;});
  return {...plan,furniture:strip(plan.furniture),...(plan.layoutAlternatives?{layoutAlternatives:{...plan.layoutAlternatives,options:plan.layoutAlternatives.options.map(option=>({...option,snapshot:{...option.snapshot,furniture:strip(option.snapshot.furniture)}}))}}:{})};
}
/** Saved alternatives can retain a photo after it is removed from the working layout. */
export function personalPhotoIds(plan:PlanDocumentV1):string[]{
  const designs=[plan,...(plan.layoutAlternatives?.options.map(o=>o.snapshot)??[]),...(plan.designHistory?.checkpoints.map(c=>c.snapshot)??[])];
  const pieces=designs.flatMap(d=>d.furniture);
  const ids=[...designs.flatMap(d=>d.siteSurvey?.notes.flatMap(n=>n.photoAssetIds)??[]),...designs.flatMap(d=>d.installChecklist?.tasks.flatMap(t=>t.photoAssetIds)??[]),...pieces.flatMap(p=>[p.personalItem?.photoAssetId,p.personalSurface?.hidden?undefined:p.personalSurface?.assetId]),...designs.flatMap(d=>d.moodboards?.boards.flatMap(b=>b.pins.flatMap(pin=>pin.kind==='image'?[pin.assetId]:[]))??[])];
  return [...new Set(ids.filter((id):id is string=>!!id&&PERSONAL_PHOTO_ID.test(id)))];
}
