import {catalog} from './catalog';
import {buildKitPlacement,initialKitPosition,type FurnitureKit,type KitPosition} from './furnitureKits';
import {parsePersonalCollectionItem,personalMetadata,type PersonalCollectionItem,type PersonalPlacement} from './personalItems';
import type {PlanDocumentV1} from './types';
import {validatePlan,MAX_PLAN_BYTES} from './planValidation';

// Architectural openings and attachment-specific models need their own workflows.
export const personalProxyCatalog=catalog.filter(c=>!['door','window','stairs','backsplash'].includes(c.shape)&&c.mount!=='wall'&&c.mount!=='ceiling');
function personalKit(input:PersonalCollectionItem):FurnitureKit {
  const item=parsePersonalCollectionItem(input),proxy=personalProxyCatalog.find(c=>c.id===item.catalogId);
  if(!proxy)throw new Error('Choose an available free-standing or tabletop catalog model as the visual approximation.');
  return {version:1,id:item.id,name:item.name,createdAt:item.createdAt,updatedAt:item.updatedAt,pieces:[{catalogId:item.catalogId,x:0,z:0,rotation:0,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,variant:'cream'}]};
}
export function initialPersonalPosition(plan:PlanDocumentV1,floorId:string,item:PersonalCollectionItem):KitPosition {return initialKitPosition(plan,floorId,personalKit(item));}
/** Produces a proposed plan only. The parent's existing bridge owns Apply/Discard and one undo. */
export function buildPersonalPlacement(base:PlanDocumentV1,floorId:string,input:PersonalCollectionItem,position:KitPosition){
  const item=parsePersonalCollectionItem(input),result=buildKitPlacement(base,floorId,personalKit(item),position),added=new Set<string>(result.addedIds);
  const furniture:PersonalPlacement[]=result.plan.furniture.map(p=>added.has(p.id)?{...p,personalItem:personalMetadata(item)}:p);
  const plan={...result.plan,furniture};validatePlan(plan);if(new TextEncoder().encode(JSON.stringify(plan)).byteLength>MAX_PLAN_BYTES)throw new Error('This personal item would exceed the project size limit.');
  return {...result,plan,base,floorId,label:item.name};
}
