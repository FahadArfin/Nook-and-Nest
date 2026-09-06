import {furnitureType} from './library';
import {catalog, isWindow} from './catalog';
import type {FurniturePlacement} from './types';

export const isRailing=(id:string)=>id.startsWith('balcony-rail-');
const cabinetTypes=new Set(['Kitchen cabinets','Cabinets & storage','Counters & islands','Backsplashes']);
export function isExtendable(id:string){
  const c=catalog.find(c=>c.id===id);
  return isRailing(id)||isWindow(id)||!!(c&&c.category==='Kitchen'&&cabinetTypes.has(furnitureType(c))&&!/sink|corner/.test(id));
}
export const isEdgeFurniture=(id:string)=>{const c=catalog.find(c=>c.id===id);return isRailing(id)||!!(c&&c.category==='Kitchen'&&(cabinetTypes.has(furnitureType(c))||furnitureType(c)==='Sinks & counters'));};
/** Local +X is the run direction, at any rotation. The opposite end stays fixed. */
export function extendFurniture(base:FurniturePlacement,width:number,side:-1|1):FurniturePlacement {
  const widthMm=Math.max(200,Math.min(20000,Math.round(width/10)*10));
  const offset=side*(widthMm-base.widthMm)/2,angle=base.rotation*Math.PI/180;
  return {...base,widthMm,x:base.x+offset*Math.cos(angle),z:base.z-offset*Math.sin(angle),moduleRun:true};
}
export function moduleSegments(item:FurniturePlacement){
  const nominal=catalog.find(c=>c.id===item.catalogId)?.widthMm??item.widthMm;
  const count=item.moduleRun&&isExtendable(item.catalogId)?Math.min(32,Math.max(1,Math.ceil(item.widthMm/nominal))):1;
  const width=item.widthMm/count;
  return Array.from({length:count},(_,i)=>({width,offset:-item.widthMm/2+width*(i+.5)}));
}
