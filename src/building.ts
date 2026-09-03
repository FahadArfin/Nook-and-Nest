import { catalog, isStairs } from "./catalog";
import { floorRects, intersects, subtractRect, type FloorRect } from "./floorGeometry";
import type { FurniturePlacement, PlanDocumentV1 } from "./types";

export function fitStair(plan:PlanDocumentV1,item:FurniturePlacement):FurniturePlacement {
  if(!isStairs(item.catalogId))return item;
  const floor=plan.floors.find(f=>f.id===item.floorId),target=plan.floors.find(f=>f.id===item.toFloorId&&plan.floors.indexOf(f)===plan.floors.indexOf(floor!)+1&&f.elevationMm>(floor?.elevationMm??Infinity));
  const rise=target&&floor?target.elevationMm-floor.elevationMm:Math.max(100,Math.min(10000,item.stairRiseMm??2800));
  const def=catalog.find(c=>c.id===item.catalogId)!;
  return {...item,toFloorId:target?.id,rotation:((Math.round(item.rotation/90)*90)%360+360)%360,elevationMm:0,stairRiseMm:rise,heightMm:Math.round(def.heightMm*rise/2800)};
}
export function stairFootprint(item:FurniturePlacement):FloorRect {
  const turned=Math.abs(Math.sin(item.rotation*Math.PI/180))>.5;
  const width=turned?item.depthMm:item.widthMm,depth=turned?item.widthMm:item.depthMm;
  return {x:item.x-width/2,z:item.z-depth/2,width,depth};
}
export function stairHoles(plan:PlanDocumentV1,floorId:string):FloorRect[] {
  return plan.furniture.filter(i=>isStairs(i.catalogId)&&i.toFloorId===floorId&&i.floorId!==floorId).flatMap(item=>{
    if(item.catalogId!=="stairs-l-turn")return [stairFootprint(item)];
    const w=item.widthMm,d=item.depthMm,fw=w/3.2,fd=d/3.2;
    return [worldRect(item,-(w-fw)/2,0,fw,d),worldRect(item,fw/2,(d-fd)/2,w-fw,fd)];
  });
}
// New stair GLBs are oriented to match these editor-local X/Z coordinates.
function worldRect(item:FurniturePlacement,x:number,z:number,width:number,depth:number):FloorRect {
  const angle=item.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),turned=Math.abs(s)>.5;
  const cx=item.x+c*x+s*z,cz=item.z-s*x+c*z,w=turned?depth:width,d=turned?width:depth;
  return {x:cx-w/2,z:cz-d/2,width:w,depth:d};
}
export function stairLandings(item:FurniturePlacement):[FloorRect,FloorRect] {
  const w=item.widthMm,d=item.depthMm,l=item.catalogId==="stairs-l-turn",u=item.catalogId==="stairs-switchback";
  const fw=l?w/3.2:u?w*.45:w;
  const lower=worldRect(item,l||u?-(w-fw)/2:0,-d/2-350,700,700);
  const upper=l?worldRect(item,w/2+350,(d-d/3.2)/2,700,700):worldRect(item,u?(w-fw)/2:0,u?-d/2-350:d/2+350,700,700);
  return [lower,upper];
}
export function visibleFloorRects(plan:PlanDocumentV1,floorId:string) {
  const floor=plan.floors.find(f=>f.id===floorId);if(!floor)return [];
  let rectangles=floorRects(floor,plan.gridSizeMm);
  for(const hole of stairHoles(plan,floorId))rectangles=rectangles.flatMap(r=>subtractRect(r,hole).map(part=>({...part,cell:r.cell})));
  return rectangles;
}
export function stairWarnings(plan:PlanDocumentV1,item:FurniturePlacement):string[] {
  if(!isStairs(item.catalogId))return [];
  const warnings:string[]=[],floor=plan.floors.find(f=>f.id===item.floorId),target=plan.floors.find(f=>f.id===item.toFloorId);
  if(!target)warnings.push("Not connected to an upper floor. Add a floor or choose a destination.");
  else if(!floor||plan.floors.indexOf(target)!==plan.floors.indexOf(floor)+1)warnings.push("Connect stairs to the next floor above.");
  const rise=item.stairRiseMm??2800,turning=item.catalogId==="stairs-switchback"||item.catalogId==="stairs-l-turn";
  const flightWidth=item.catalogId==="stairs-l-turn"?Math.min(item.widthMm,item.depthMm)/3.2:turning?item.widthMm*.45:item.widthMm;
  if(flightWidth<800)warnings.push("The walking width is under 80 cm.");
  const run=item.catalogId==="stairs-l-turn"?(item.widthMm+item.depthMm)*(1-1/3.2):turning?item.depthMm*(1-.99/3.2)*2:item.depthMm;
  if(run<rise*1.2)warnings.push("The run is short for this rise; the stairs may be too steep.");
  if(rise/16>200)warnings.push("These 16 risers are over 20 cm high. Consider a longer/custom staircase.");
  if(floor&&floor.heightMm<2100)warnings.push("The lower ceiling may leave insufficient headroom.");
  if(item.catalogId.includes("cantilever")||item.catalogId.includes("led"))warnings.push("Cantilever treads need an engineered support wall; this is a layout model only.");
  const footprint=stairFootprint(item);
  for(const f of [floor,target].filter(Boolean)){
    const landing=stairLandings(item)[f===floor?0:1];
    let uncovered=[landing];
    for(const rect of visibleFloorRects(plan,f!.id))uncovered=uncovered.flatMap(part=>subtractRect(part,rect));
    if(uncovered.reduce((sum,r)=>sum+r.width*r.depth,0)>1)warnings.push(`${f===floor?"Lower":"Upper"} landing is not fully supported by floor.`);
    if(plan.furniture.some(other=>other.id!==item.id&&other.floorId===f!.id&&!isStairs(other.catalogId)&&intersects(stairFootprint(other),landing)))warnings.push(`${f===floor?"Lower":"Upper"} landing overlaps furniture.`);
  }
  if(target&&!floorRects(target,plan.gridSizeMm).some(r=>intersects(r,footprint)))warnings.push("Stairs do not reach the upper floor footprint.");
  return warnings;
}
