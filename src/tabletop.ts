import { modernTopIds, modernMediaIds, modernRoundTopIds } from './modernCollection';
import { shelfSurfaces,fitsShelf } from "./shelfSurfaces";
import { kitchenTopIds } from "./kitchenCatalog";
import { catalog } from "./catalog";
import type { FurniturePlacement, PlanDocumentV1 } from "./types";

export interface PlacementPoint { x:number; z:number; elevationMm?:number }
interface Point3 { x:number;y:number;z:number }
export function tabletopChoices(plan:PlanDocumentV1,item:FurniturePlacement){
  return plan.furniture.filter(owner=>owner.id!==item.id&&owner.floorId===item.floorId&&supportsDesktop(owner)).flatMap(owner=>{
    const floor=plan.floors.find(f=>f.id===item.floorId)!;
    const candidate={...item,x:owner.x,z:owner.z,rotation:owner.rotation};
    const point=tabletopPoint({...plan,furniture:[owner]},candidate,{x:owner.x/1000,y:(floor.elevationMm+(owner.elevationMm??0)+owner.heightMm+1000)/1000,z:owner.z/1000},{x:0,y:-1,z:0});
    return point?[{owner,placement:{...point,rotation:owner.rotation}}]:[];
  });
}
// Only simple continuous tops: L-shaped desks need an explicit height input
// rather than a misleading rectangular hit area across their empty corner.
export function supportsDesktop(item:FurniturePlacement) {
  return (item.catalogId==="bambu-p2s"||item.catalogId.startsWith("desk-mat-")||modernTopIds.has(item.catalogId)||modernMediaIds.has(item.catalogId)||kitchenTopIds.has(item.catalogId)||["cane-nightstand","floating-nightstand","base-cabinet","kitchen-counter","tv-stand","slatted-tv-stand","open-media-bench","cane-tv-stand"].includes(item.catalogId)||catalog.find(c=>c.id===item.catalogId)?.shape==="table")&&!['corner-desk','nesting-tables','tray-side-table'].includes(item.catalogId);
}
export function tabletopPoint(plan:PlanDocumentV1,item:FurniturePlacement,origin:Point3,direction:Point3):PlacementPoint|undefined {
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor||Math.abs(direction.y)<.00001)return;
  const shelfHits=plan.furniture.filter(other=>other.id!==item.id&&other.floorId===item.floorId).flatMap(owner=>shelfSurfaces(owner).flatMap(surface=>{
    const elevationMm=Math.round(surface.height),distance=((floor.elevationMm+50+elevationMm)/1000-origin.y)/direction.y;
    if(distance<=0)return [];
    const x=Math.round((origin.x+distance*direction.x)*1000/10)*10,z=Math.round((origin.z+distance*direction.z)*1000/10)*10;
    return fitsShelf(item,owner,surface,x,z)?[{x,z,elevationMm,distance}]:[];
  }));
  const hits=plan.furniture.filter(other=>other.id!==item.id&&other.floorId===item.floorId&&supportsDesktop(other)).flatMap(table=>{
    const elevationMm=(table.elevationMm??0)+table.heightMm;
    const distance=((floor.elevationMm+50+elevationMm)/1000-origin.y)/direction.y;
    if(distance<=0)return [];
    const x=Math.round((origin.x+distance*direction.x)*1000/10)*10,z=Math.round((origin.z+distance*direction.z)*1000/10)*10;
    const angle=table.rotation*Math.PI/180,dx=x-table.x,dz=z-table.z;
    const localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
    const relative=(item.rotation-table.rotation)*Math.PI/180;
    const halfW=(Math.abs(Math.cos(relative))*item.widthMm+Math.abs(Math.sin(relative))*item.depthMm)/2;
    const halfD=(Math.abs(Math.sin(relative))*item.widthMm+Math.abs(Math.cos(relative))*item.depthMm)/2;
    const frontInset=kitchenTopIds.has(table.catalogId)?100*table.depthMm/620:0;
    if(Math.abs(localX)+halfW>table.widthMm/2||localZ-halfD< -table.depthMm/2||localZ+halfD>table.depthMm/2-frontInset)return [];
    // Round/oval coffee tables need an ellipse containment check at each corner.
    if(modernRoundTopIds.has(table.catalogId)||['pedestal-dining-table','patio-bistro-table','pedestal-nightstand','drum-coffee-table','oval-coffee-table','round-table','side-table'].includes(table.catalogId)){
      if(((Math.abs(localX)+halfW)/(table.widthMm/2))**2+((Math.abs(localZ)+halfD)/(table.depthMm/2))**2>1)return [];
    }
    return [{x,z,elevationMm,distance}];
  }).concat(shelfHits).sort((a,b)=>a.distance-b.distance);
  if(hits[0])return {x:hits[0].x,z:hits[0].z,elevationMm:hits[0].elevationMm};
}
