import { floorRects } from './floorGeometry';
import { pavingIds } from './outdoorCatalog';
import type { FurniturePlacement,PlanDocumentV1 } from './types';
import {terrainRay,terrainSampler} from './terrain';
export const groundY=-.15;
export function landscapeBounds(plan:PlanDocumentV1){
  const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
  const xs=rects.flatMap(r=>[r.x/1000,(r.x+r.width)/1000]),zs=rects.flatMap(r=>[r.z/1000,(r.z+r.depth)/1000]);
  for(const f of plan.furniture){xs.push((f.x-f.widthMm/2)/1000,(f.x+f.widthMm/2)/1000);zs.push((f.z-f.depthMm/2)/1000,(f.z+f.depthMm/2)/1000);}
  if(!xs.length)return {x:0,z:0,radius:18};
  const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
  return {x,z,radius:Math.max(18,(Math.hypot(Math.max(...xs)-x,Math.max(...zs)-z)+8)/.70)};
}
export function insidePaving(item:FurniturePlacement,paver:FurniturePlacement,x:number,z:number){
  const a=paver.rotation*Math.PI/180,dx=x-paver.x,dz=z-paver.z,r=(item.rotation-paver.rotation)*Math.PI/180;
  const hw=(Math.abs(Math.cos(r))*item.widthMm+Math.abs(Math.sin(r))*item.depthMm)/2,hd=(Math.abs(Math.sin(r))*item.widthMm+Math.abs(Math.cos(r))*item.depthMm)/2;
  return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))+hw<=paver.widthMm/2&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))+hd<=paver.depthMm/2;
}
export function outsidePlacementPoint(plan:PlanDocumentV1,item:FurniturePlacement,origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number}){
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor||Math.abs(direction.y)<.00001)return;
  const rects=floorRects(floor,plan.gridSizeMm),hits:Array<{x:number;z:number;elevationMm:number;distance:number}>=[];
  const point=(y:number)=>{const distance=(y-origin.y)/direction.y;return {x:Math.round((origin.x+distance*direction.x)*1000/10)*10,z:Math.round((origin.z+distance*direction.z)*1000/10)*10,distance}};
  const onFloor=point((floor.elevationMm+50)/1000);
  if(onFloor.distance>0&&rects.some(r=>onFloor.x>=r.x&&onFloor.x<=r.x+r.width&&onFloor.z>=r.z&&onFloor.z<=r.z+r.depth))hits.push({...onFloor,elevationMm:0});
  if(floor.elevationMm===Math.min(...plan.floors.map(f=>f.elevationMm))){
    if(plan.environment?.terrain?.length){const p=terrainRay(plan,origin,direction);if(p)hits.push({x:Math.round(p.x*1000),z:Math.round(p.z*1000),distance:p.distance,elevationMm:Math.round(p.y*1000-floor.elevationMm-50)});}
    else {const p=point(groundY);if(p.distance>0)hits.push({...p,elevationMm:Math.round(groundY*1000-floor.elevationMm-50)});}
  }
  if(!pavingIds.has(item.catalogId)&&item.catalogId!=='stepping-stones')for(const paver of plan.furniture.filter(p=>p.id!==item.id&&p.floorId===floor.id&&pavingIds.has(p.catalogId))){
    const elevationMm=(paver.elevationMm??0)+paver.heightMm,p=point((floor.elevationMm+50+elevationMm)/1000);
    if(p.distance>0&&insidePaving(item,paver,p.x,p.z))hits.push({...p,elevationMm});
  }
  hits.sort((a,b)=>a.distance-b.distance);const p=hits[0];return p?{x:p.x,z:p.z,elevationMm:p.elevationMm}:undefined;
}
/** Deterministic bounded grass, never generated through floors or furnishing. */
export function grassPoints(plan:PlanDocumentV1){
  if(!plan.environment||plan.environment.grass==='off')return [];
  const bounds=landscapeBounds(plan),radius=Math.min(bounds.radius-5,30),count=plan.environment.grass==='lush'?1800:600;
  const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm)),items=plan.furniture;
  let seed=87123;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const points=[],sample=terrainSampler(plan);
  for(let i=0;i<count*3&&points.length<count;i++){
    const x=bounds.x+(rand()*2-1)*radius,z=bounds.z+(rand()*2-1)*radius;
    if(Math.hypot(x-bounds.x,z-bounds.z)>radius)continue;
    if(rects.some(r=>x*1000>r.x-200&&x*1000<r.x+r.width+200&&z*1000>r.z-200&&z*1000<r.z+r.depth+200))continue;
    if(items.some(p=>{const a=p.rotation*Math.PI/180,dx=x*1000-p.x,dz=z*1000-p.z;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<p.widthMm/2+200&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<p.depthMm/2+200}))continue;
    const terrain=sample(x,z);if(terrain.water)continue;
    points.push({x,z,y:terrain.height,angle:rand()*Math.PI*2,scale:.65+rand()*.6});
  }
  return points;
}
