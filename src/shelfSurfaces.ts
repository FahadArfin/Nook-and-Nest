import { catalog } from './catalog';
import studioShelves from './studioShelfSurfaces.json';
import type { FurniturePlacement,PlanDocumentV1 } from './types';
/** Runtime local X/Z, millimetres, measured from the model's lowest point.
 * Matches the authored planes in tools/blender/interior_models.py. Insets keep
 * objects clear of side panels, back lips, cubby dividers and beveled edges. */
export interface ShelfSurface { id:string;label:string;x:number;z:number;width:number;depth:number;height:number;clearance:number }
const shelf=(id:string,label:string,height:number,width:number,depth:number,clearance:number,x=0,z=0):ShelfSurface=>({id,label,height,width,depth,clearance,x,z});
const authored:Record<string,ShelfSurface[]>={
  ...studioShelves,
  'open-pantry':[77.5,502.5,927.5,1352.5,1777.5].map((height,i)=>shelf(`level-${i+1}`,`Pantry shelf ${i+1}`,height,810,320,i===4?600:385)),
  'display-bookcase':[150,740,1330].map((height,i)=>shelf(`level-${i+1}`,`Shelf ${i+1} (bottom to top)`,height,1100,340,i===2?530:550,0,20)),
  'ladder-display-shelf':[200,660,1120,1580].map((height,i)=>shelf(`level-${i+1}`,`Shelf ${i+1} (bottom to top)`,height,640,[370,300,230,160][i],i===3?700:420,0,[0,-35,-70,-105][i])),
  'cube-display-shelf':[40,466.667,893.333].flatMap((height,row)=>[-426.667,0,426.667].map((x,col)=>shelf(`bay-${row+1}-${col+1}`,`Row ${row+1}, cubby ${col+1}`,height,376,300,376,x,10))),
};
// Conservative clear planes inside Batch 12's open carcasses, including each
// divider. Match the retained panels in modern_models.py, in millimetres.
for(const id of ['modular-media-console','modular-low-storage','open-metal-upper']){
  const def=catalog.find(c=>c.id===id)!;
  const bottom=id==='open-metal-upper'?0:90,top=def.heightMm-35;
  const cols=Math.round(def.widthMm/600),bay=(def.widthMm-40)/cols;
  authored[id]=[bottom+24,bottom+(top-bottom)/2+9].flatMap((height,row)=>Array.from({length:cols},(_,col)=>shelf(`modern-${row}-${col}`,`Shelf ${row+1}, bay ${col+1}`,height,bay-35,def.depthMm-100,(top-bottom)/2-40,(col-(cols-1)/2)*bay,0)));
}
export function shelfSurfaces(item:FurniturePlacement):ShelfSurface[]{
  const def=catalog.find(c=>c.id===item.catalogId);if(!def)return [];
  return (authored[item.catalogId]??[]).map(s=>({...s,x:s.x*item.widthMm/def.widthMm,z:s.z*item.depthMm/def.depthMm,width:s.width*item.widthMm/def.widthMm,depth:s.depth*item.depthMm/def.depthMm,height:s.height*item.heightMm/def.heightMm+(item.elevationMm??0),clearance:s.clearance*item.heightMm/def.heightMm}));
}
export function fitsShelf(item:FurniturePlacement,owner:FurniturePlacement,surface:ShelfSurface,x=item.x,z=item.z){
  const a=owner.rotation*Math.PI/180,dx=x-owner.x,dz=z-owner.z;
  const lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);
  const r=(item.rotation-owner.rotation)*Math.PI/180;
  const hw=(Math.abs(Math.cos(r))*item.widthMm+Math.abs(Math.sin(r))*item.depthMm)/2;
  const hd=(Math.abs(Math.sin(r))*item.widthMm+Math.abs(Math.cos(r))*item.depthMm)/2;
  return item.heightMm<=surface.clearance&&Math.abs(lx-surface.x)+hw<=surface.width/2+.001&&Math.abs(lz-surface.z)+hd<=surface.depth/2+.001;
}
export function restsOnShelf(item:FurniturePlacement,owner:FurniturePlacement){
  return item.id!==owner.id&&item.floorId===owner.floorId&&shelfSurfaces(owner).some(s=>Math.abs((item.elevationMm??0)-s.height)<1&&fitsShelf(item,owner,s));
}
export function shelfChoices(plan:PlanDocumentV1,item:FurniturePlacement){
  return plan.furniture.filter(s=>s.id!==item.id&&s.floorId===item.floorId).flatMap(owner=>shelfSurfaces(owner).flatMap(surface=>{
    const a=owner.rotation*Math.PI/180;
    const x=Math.round(owner.x+surface.x*Math.cos(a)+surface.z*Math.sin(a)),z=Math.round(owner.z-surface.x*Math.sin(a)+surface.z*Math.cos(a));
    const candidate={...item,x,z,rotation:owner.rotation,elevationMm:Math.round(surface.height)};
    if(!fitsShelf(candidate,owner,surface,x,z))return [];
    return [{key:`${owner.id}/${surface.id}`,owner,surface,placement:{x,z,rotation:owner.rotation,elevationMm:Math.round(surface.height)}}];
  }));
}
