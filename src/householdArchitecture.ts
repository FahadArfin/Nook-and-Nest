import {floorRects, subtractRect, type FloorRect} from './floorGeometry';
import {geometryParts, polygonBounds, shapeCovered, shapeArea, shapeIntersection, unionShapes} from './polygonGeometry';
import type {FloorPlan,FurniturePlacement,PlanDocumentV1} from './types';
import {isRoofSkylight,isStormDoor,isGarageDoor,isStormDoorHostId} from './householdArchitectureGeometry';
export * from './householdArchitectureGeometry';
export const FLAT_ROOF_THICKNESS_MM=100;
const angleDistance=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
type HostedPlacement=FurniturePlacement&{hostDoorId?:string};

export function architectureFootprint(item:FurniturePlacement,width=item.widthMm,depth=item.depthMm,offsetX=0,offsetZ=0):FloorRect {
  const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return polygonBounds([[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([x,z])=>({x:item.x+(x+offsetX)*c+(z+offsetZ)*s,z:item.z-(x+offsetX)*s+(z+offsetZ)*c})));
}

export function garageDoorProblem(plan:PlanDocumentV1,item:FurniturePlacement):string|undefined {
  if(!isGarageDoor(item.catalogId))return;
  if(![item.x,item.z,item.rotation,item.widthMm,item.depthMm,item.heightMm].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return 'Enter valid garage door dimensions.';
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return 'Choose a floor for the garage door.';
  if(item.heightMm>floor.heightMm-20)return 'The overhead garage track and spring need more wall height.';
  // Reserve the horizontal return envelope inside the supporting room boundary.
  // Source tracks span X ±1382, Y 67…2609 mm. The catalog center is Y1259;
  // preserveCatalogCoordinates reverses authored Y into the planning Z axis.
  const tracks=architectureFootprint(item,item.widthMm*2764/2850,item.depthMm*2542/2700,0,-item.depthMm*79/2700);
  if(!shapeCovered(tracks,floorRects(floor,plan.gridSizeMm)))return 'The full overhead tracks must fit inside the garage. Flip the door or choose a deeper room.';
  for(const wall of floor.walls){
    if((wall.heightMm??floor.heightMm)<item.heightMm*2050/2400)continue;
    const ax=wall.ax*plan.gridSizeMm,az=wall.az*plan.gridSizeMm,bx=wall.bx*plan.gridSizeMm,bz=wall.bz*plan.gridSizeMm,length=Math.hypot(bx-ax,bz-az);
    if(length<1)continue;
    const nx=-(bz-az)/length*50,nz=(bx-ax)/length*50;
    const footprint=polygonBounds([{x:ax+nx,z:az+nz},{x:bx+nx,z:bz+nz},{x:bx-nx,z:bz-nz},{x:ax-nx,z:az-nz}]);
    if(shapeIntersection([tracks],[footprint])>.1)return 'The overhead tracks cross an inside wall. Move the doorway or shorten its track envelope.';
  }
}

export function stormDoorHost(plan:PlanDocumentV1,item:HostedPlacement,allowedHostIds?:ReadonlySet<string>):FurniturePlacement|undefined {
  const hosts=plan.furniture.filter(p=>p.id!==item.id&&p.floorId===item.floorId&&isStormDoorHostId(p.catalogId)&&(!allowedHostIds||allowedHostIds.has(p.id)));
  if(item.hostDoorId)return hosts.find(p=>p.id===item.hostDoorId);
  return hosts.filter(p=>Math.hypot(p.x-item.x,p.z-item.z)<1800).sort((a,b)=>Math.hypot(a.x-item.x,a.z-item.z)-Math.hypot(b.x-item.x,b.z-item.z))[0];
}
export function snapStormDoor(plan:PlanDocumentV1,item:HostedPlacement,allowedHostIds?:ReadonlySet<string>):HostedPlacement {
  if(!isStormDoor(item.catalogId))return item;
  const host=stormDoorHost(plan,item,allowedHostIds);if(!host)return item;
  const rotation=[host.rotation,host.rotation+180].sort((a,b)=>angleDistance(a,item.rotation)-angleDistance(b,item.rotation))[0]%360;
  const a=rotation*Math.PI/180,offset=host.depthMm/2+item.depthMm/2+15;
  return {...item,hostDoorId:host.id,widthMm:host.widthMm,heightMm:host.heightMm,elevationMm:0,rotation,x:host.x+Math.sin(a)*offset,z:host.z+Math.cos(a)*offset};
}
export function stormDoorProblem(plan:PlanDocumentV1,item:HostedPlacement):string|undefined {
  if(!isStormDoor(item.catalogId))return;
  if(![item.x,item.z,item.rotation,item.widthMm,item.depthMm,item.heightMm].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return 'Enter valid screen door dimensions.';
  const host=stormDoorHost(plan,item);if(!host)return 'Place the screen door over an existing entry door first.';
  if(host.widthMm>1300||host.widthMm<550)return 'Choose a single entry doorway between 55 and 130 cm wide for this screen door.';
  const expected=snapStormDoor(plan,item);
  if(Math.hypot(item.x-expected.x,item.z-expected.z)>1||Math.abs(item.widthMm-expected.widthMm)>1||Math.abs(item.heightMm-expected.heightMm)>1||angleDistance(item.rotation,expected.rotation)>1||(item.elevationMm??0)!==0)return 'Align the secondary screen door with its entry doorway.';
  if(plan.furniture.some(p=>p.id!==item.id&&isStormDoor(p.catalogId)&&(p as HostedPlacement).hostDoorId===host.id&&angleDistance(p.rotation,item.rotation)<1))return 'This side of the doorway already has a secondary screen door.';
}
/** Recompute linked leaves in the same edit/undo transaction as the host. */
export function syncStormDoors(plan:PlanDocumentV1):PlanDocumentV1 {
  let changed=false;
  const furniture=plan.furniture.flatMap(item=>{
    if(!isStormDoor(item.catalogId)||!(item as HostedPlacement).hostDoorId)return [item];
    if(!stormDoorHost(plan,item)){changed=true;return [];}
    const next=snapStormDoor(plan,item);
    if(['x','z','widthMm','heightMm','rotation','elevationMm'].some(k=>(next as unknown as Record<string,unknown>)[k] !== (item as unknown as Record<string,unknown>)[k])){changed=true;return [next];}
    return [item];
  });
  return changed?{...plan,furniture}:plan;
}

export function roofHostFloor(plan:PlanDocumentV1):FloorPlan|undefined {
  return plan.floors.filter(f=>f.cells.length>0).sort((a,b)=>(b.elevationMm+b.heightMm)-(a.elevationMm+a.heightMm))[0];
}
export function flatRoofEnabled(plan:PlanDocumentV1){return plan.environment?.flatRoof===true;}
export function roofHostRects(plan:PlanDocumentV1,floorId:string):FloorRect[] {
  const floor=roofHostFloor(plan);if(!flatRoofEnabled(plan)||floor?.id!==floorId)return [];
  const parts=floorRects(floor,plan.gridSizeMm).filter(r=>!floor.blueprint?.rooms.some(room=>room.kind==='Outdoor'&&r.x+r.width/2>=room.x&&r.x+r.width/2<=room.x+room.width&&r.z+r.depth/2>=room.z&&r.z+r.depth/2<=room.z+room.depth));
  return geometryParts(unionShapes(parts));
}
export function skylightHole(item:FurniturePlacement){return architectureFootprint(item,item.widthMm*748/900,item.depthMm*1048/1200);}
export function fitRoofSkylight(plan:PlanDocumentV1,item:FurniturePlacement):FurniturePlacement {
  if(!isRoofSkylight(item.catalogId))return item;
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return item;
  return {...item,elevationMm:Math.round(floor.heightMm+FLAT_ROOF_THICKNESS_MM-item.heightMm*160/260-50),rotation:((Math.round(item.rotation/90)*90)%360+360)%360};
}
/** Keep the authored curb's mounting plane attached after a ceiling-height edit. */
export function syncArchitecturalHosts(plan:PlanDocumentV1):PlanDocumentV1 {
  const linked=syncStormDoors(plan);let changed=false;
  const furniture=linked.furniture.map(item=>{
    if(!isRoofSkylight(item.catalogId))return item;
    const next=fitRoofSkylight(linked,item);
    if(next.elevationMm===item.elevationMm&&next.rotation===item.rotation)return item;
    changed=true;return next;
  });
  return changed?{...linked,furniture}:linked;
}
export function roofSkylightProblem(plan:PlanDocumentV1,item:FurniturePlacement):string|undefined {
  if(!isRoofSkylight(item.catalogId))return;
  if(!flatRoofEnabled(plan))return 'Enable Flat roof in Your surroundings before placing a skylight.';
  if(roofHostFloor(plan)?.id!==item.floorId)return 'Place this skylight on the highest occupied floor, where the flat roof is exposed.';
  if(![item.x,item.z,item.rotation,item.widthMm,item.depthMm,item.heightMm].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return 'Enter valid skylight dimensions.';
  const mounted=fitRoofSkylight(plan,item);
  if(!Number.isFinite(item.elevationMm)||Math.abs(item.elevationMm!-mounted.elevationMm!)>1||angleDistance(item.rotation,mounted.rotation)>.01)return 'Align the skylight with its roof mounting plane.';
  if(!shapeCovered(architectureFootprint(item),roofHostRects(plan,item.floorId)))return 'Keep the full skylight curb within the roof boundary.';
  const hole=skylightHole(item);
  if(plan.furniture.some(p=>p.id!==item.id&&p.floorId===item.floorId&&isRoofSkylight(p.catalogId)&&subtractRect(hole,skylightHole(p)).reduce((n,r)=>n+shapeArea(r),0)<shapeArea(hole)-.1))return 'This skylight overlaps another roof opening.';
}
export function flatRoofRects(plan:PlanDocumentV1,floorId:string):FloorRect[] {
  let parts=roofHostRects(plan,floorId);
  for(const p of plan.furniture.filter(p=>p.floorId===floorId&&isRoofSkylight(p.catalogId)&&!roofSkylightProblem(plan,p)))parts=parts.flatMap(r=>subtractRect(r,skylightHole(p)));
  return parts;
}
export function roofPlacementPoint(plan:PlanDocumentV1,item:FurniturePlacement,origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number}) {
  if(!isRoofSkylight(item.catalogId)||!flatRoofEnabled(plan)||Math.abs(direction.y)<.00001)return;
  const floor=roofHostFloor(plan);if(!floor||floor.id!==item.floorId)return;
  const distance=((floor.elevationMm+floor.heightMm+FLAT_ROOF_THICKNESS_MM)/1000-origin.y)/direction.y;if(distance<=0)return;
  const candidate=fitRoofSkylight(plan,{...item,x:Math.round((origin.x+direction.x*distance)*1000/10)*10,z:Math.round((origin.z+direction.z*distance)*1000/10)*10});
  return roofSkylightProblem(plan,candidate)?undefined:candidate;
}

export function spiralStairHole(item:FurniturePlacement):FloorRect {
  const rx=item.widthMm*980/2200,rz=item.depthMm*980/2200,a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return polygonBounds(Array.from({length:64},(_,i)=>{const t=i*Math.PI*2/64,x=rx*Math.cos(t),z=rz*Math.sin(t);return {x:item.x+x*c+z*s,z:item.z-x*s+z*c};}));
}
export function spiralLandings(item:FurniturePlacement):[FloorRect,FloorRect] {
  return [architectureFootprint(item,700,700,item.widthMm*.145,-item.depthMm/2-350),architectureFootprint(item,700,700,-item.widthMm*.145,-item.depthMm/2-350)];
}
export function spiralStairWarnings(plan:PlanDocumentV1,item:FurniturePlacement):string[] {
  const warnings=['Spiral layout model: the flat walkthrough blocks the shaft and stair footprint; stair ascent is not simulated.'];
  const rise=item.stairRiseMm??2800,width=Math.min(item.widthMm,item.depthMm)*(950-92)/2200,run=Math.PI*2*Math.min(item.widthMm,item.depthMm)*.31;
  if(width<800)warnings.push('The spiral walking width is under 80 cm.');
  if(rise/16>200)warnings.push('These 16 spiral risers exceed 20 cm; review the rise and headroom.');
  if(run/16<200)warnings.push('The spiral tread depth at the walking line is under 20 cm.');
  if(rise<2100)warnings.push('A full turn may leave insufficient spiral headroom.');
  if(!plan.floors.some(f=>f.id===item.toFloorId))warnings.push('Connect this staircase to the next floor above to create its circular opening.');
  return warnings;
}
