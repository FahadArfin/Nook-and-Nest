import {designedHomeTopIds,designedHomeRoundIds} from './designedHomeCollection';
import { modernTopIds, modernMediaIds, modernRoundTopIds } from './modernCollection';
import { shelfSurfaces,fitsShelf,shelfChoices } from "./shelfSurfaces";
import { kitchenTopIds,kitchenSurfaceIds } from "./kitchenCatalog";
import { catalog } from "./catalog";
import {householdSurfaceHostIds} from './householdCollection';
import {supportFootprint,modelCenterForSupport} from './supportFootprint';
import type { FurniturePlacement, PlanDocumentV1 } from "./types";

export interface PlacementPoint { rotation?:number; x:number; z:number; elevationMm?:number; hostDoorId?:string }
interface Point3 { x:number;y:number;z:number }
export function tabletopChoices(plan:PlanDocumentV1,item:FurniturePlacement){
  return plan.furniture.filter(owner=>owner.id!==item.id&&owner.floorId===item.floorId&&(supportsDesktop(owner)||householdSurfaceHostIds.has(owner.catalogId))).flatMap<{owner:FurniturePlacement;placement:PlacementPoint}>(owner=>{
    if(householdSurfaceHostIds.has(owner.catalogId)){
      const choice=shelfChoices({...plan,furniture:[owner]},item).sort((a,b)=>b.surface.height-a.surface.height)[0];
      return choice?[{owner,placement:choice.placement}]:[];
    }
    const floor=plan.floors.find(f=>f.id===item.floorId)!;
    const candidate={...item,x:owner.x,z:owner.z,rotation:owner.rotation};
    const point=tabletopPoint({...plan,furniture:[owner]},candidate,{x:owner.x/1000,y:(floor.elevationMm+(owner.elevationMm??0)+owner.heightMm+1000)/1000,z:owner.z/1000},{x:0,y:-1,z:0});
    return point?[{owner,placement:{...point,rotation:owner.rotation}}]:[];
  });
}
// Only simple continuous tops: L-shaped desks need an explicit height input
// rather than a misleading rectangular hit area across their empty corner.
export function supportsDesktop(item:FurniturePlacement) {
  if(householdSurfaceHostIds.has(item.catalogId))return false;
  return (designedHomeTopIds.has(item.catalogId)||item.catalogId==="bambu-p2s"||item.catalogId.startsWith("desk-mat-")||modernTopIds.has(item.catalogId)||modernMediaIds.has(item.catalogId)||kitchenTopIds.has(item.catalogId)||["cane-nightstand","floating-nightstand","base-cabinet","kitchen-counter","tv-stand","slatted-tv-stand","open-media-bench","cane-tv-stand"].includes(item.catalogId)||catalog.find(c=>c.id===item.catalogId)?.shape==="table")&&!['corner-desk','nesting-tables','tray-side-table'].includes(item.catalogId);
}
export function tabletopPoint(plan:PlanDocumentV1,item:FurniturePlacement,origin:Point3,direction:Point3):PlacementPoint|undefined {
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor||Math.abs(direction.y)<.00001)return;
  const footprint=supportFootprint(item);
  const shelfHits=plan.furniture.filter(other=>other.id!==item.id&&other.floorId===item.floorId).flatMap(owner=>shelfSurfaces(owner).flatMap(surface=>{
    const elevationMm=Math.round(surface.height-footprint.offset),distance=((floor.elevationMm+50+surface.height)/1000-origin.y)/direction.y;
    if(elevationMm<0)return [];
    if(distance<=0)return [];
    const {x,z}=modelCenterForSupport(item,Math.round((origin.x+distance*direction.x)*1000/10)*10,Math.round((origin.z+distance*direction.z)*1000/10)*10);
    return fitsShelf(item,owner,surface,x,z)?[{x,z,elevationMm,distance,rotation:item.rotation}]:[];
  }));
  const hits=plan.furniture.filter(other=>other.id!==item.id&&other.floorId===item.floorId&&supportsDesktop(other)).flatMap(table=>{
    if(item.catalogId==='trailing-pothos-in-shelf-pot')return [];
    const top=(table.elevationMm??0)+table.heightMm,elevationMm=top-footprint.offset;
    if(elevationMm<0)return [];
    const distance=((floor.elevationMm+50+top)/1000-origin.y)/direction.y;
    if(distance<=0)return [];
    const x=Math.round((origin.x+distance*direction.x)*1000/10)*10,z=Math.round((origin.z+distance*direction.z)*1000/10)*10;
    const angle=table.rotation*Math.PI/180,dx=x-table.x,dz=z-table.z;
    let localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
    let rotation=item.rotation;
    const appliance=kitchenSurfaceIds.has(item.catalogId);
    const clamp=item.catalogId==='desk-monitor-arm';
    if(clamp&&catalog.find(c=>c.id===table.catalogId)?.shape!=='table')return [];
    if(appliance||clamp)rotation=table.rotation;
    const relative=(rotation-table.rotation)*Math.PI/180;
    const halfW=(Math.abs(Math.cos(relative))*footprint.width+Math.abs(Math.sin(relative))*footprint.depth)/2;
    const halfD=(Math.abs(Math.sin(relative))*footprint.width+Math.abs(Math.cos(relative))*footprint.depth)/2;
    const frontInset=kitchenTopIds.has(table.catalogId)?100*table.depthMm/620:0;
    if(clamp){
      if(Math.abs(localX)>table.widthMm/2||Math.abs(localZ)>table.depthMm/2||halfW>table.widthMm/2||halfD>table.depthMm/2)return [];
      localX=Math.max(-table.widthMm/2+halfW,Math.min(table.widthMm/2-halfW,localX));
      localZ=-table.depthMm/2+halfD+4;
    }
    if(appliance&&Math.abs(localX)<=table.widthMm/2&&Math.abs(localZ)<=table.depthMm/2&&halfW<=table.widthMm/2&&halfD*2<=table.depthMm-frontInset){
      localX=Math.max(-table.widthMm/2+halfW,Math.min(table.widthMm/2-halfW,localX));
      localZ=Math.max(-table.depthMm/2+halfD,Math.min(table.depthMm/2-frontInset-halfD,localZ));
    }
    if(Math.abs(localX)+halfW>table.widthMm/2||localZ-halfD< -table.depthMm/2||localZ+halfD>table.depthMm/2-frontInset)return [];
    // Round/oval coffee tables need an ellipse containment check at each corner.
    if(designedHomeRoundIds.has(table.catalogId)||modernRoundTopIds.has(table.catalogId)||['apartment-bedside-round-pedestal','pedestal-dining-table','patio-bistro-table','pedestal-nightstand','drum-coffee-table','oval-coffee-table','round-table','side-table'].includes(table.catalogId)){
      if(((Math.abs(localX)+halfW)/(table.widthMm/2))**2+((Math.abs(localZ)+halfD)/(table.depthMm/2))**2>1)return [];
    }
    const center=modelCenterForSupport({...item,rotation},table.x+localX*Math.cos(angle)+localZ*Math.sin(angle),table.z-localX*Math.sin(angle)+localZ*Math.cos(angle));
    return [{...center,rotation,elevationMm,distance}];
  }).concat(shelfHits).sort((a,b)=>a.distance-b.distance);
  if(hits[0])return {x:hits[0].x,z:hits[0].z,elevationMm:hits[0].elevationMm,...(hits[0].rotation!==item.rotation?{rotation:hits[0].rotation}:{})};
}
