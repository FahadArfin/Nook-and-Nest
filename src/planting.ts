import {catalog} from './catalog';
import {floorRects} from './floorGeometry';
import {terrainSampler} from './terrain';
import type {FurniturePlacement,PlanDocumentV1} from './types';

export const plantingIds=['grass-clump','daisy-clump','lavender-clump','wildflower-patch','fountain-grass','blue-fescue','coneflower-drift'];
export interface PlantingBrush {catalogId:string;radius:number;spacing:number}
export const plantingStrokeLimit=64;
/** Deterministic world-space jittered lattice: retracing a stroke never duplicates plants. */
export function scatterPlants(plan:PlanDocumentV1,points:Array<{x:number;z:number}>,brush:PlantingBrush):FurniturePlacement[]{
 const c=catalog.find(c=>c.id===brush.catalogId),floor=[...plan.floors].sort((a,b)=>a.elevationMm-b.elevationMm)[0];
 if(!c||!floor||!plantingIds.includes(c.id)||!points.length||!Number.isFinite(brush.radius)||!Number.isFinite(brush.spacing))return [];
 const radius=Math.max(.5,Math.min(4,brush.radius)),spacing=Math.max(.3,Math.min(2,brush.spacing)),sample=terrainSampler(plan);
 const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm)),seen=new Set<string>(),result:FurniturePlacement[]=[];
 const pad=Math.max(c.widthMm,c.depthMm)/2000;
 const noise=(x:number,z:number,s:number)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
 for(const point of points.slice(0,128)){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.z)||Math.abs(point.x)>200||Math.abs(point.z)>200)continue;
  for(let ix=Math.floor((point.x-radius)/spacing);ix<=Math.ceil((point.x+radius)/spacing);ix++)for(let iz=Math.floor((point.z-radius)/spacing);iz<=Math.ceil((point.z+radius)/spacing);iz++){
   if(result.length>=Math.min(plantingStrokeLimit,2000-plan.furniture.length))return result;
   const key=`${ix}:${iz}`,x=(ix+(noise(ix,iz,17)-.5)*.45)*spacing,z=(iz+(noise(ix,iz,31)-.5)*.45)*spacing;
   if(seen.has(key)||Math.hypot(x-point.x,z-point.z)>radius)continue;seen.add(key);
   if(rects.some(r=>x*1000>=r.x-pad*1000&&x*1000<=r.x+r.width+pad*1000&&z*1000>=r.z-pad*1000&&z*1000<=r.z+r.depth+pad*1000))continue;
   if(plan.furniture.some(p=>{const a=p.rotation*Math.PI/180,dx=x*1000-p.x,dz=z*1000-p.z;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<p.widthMm/2+pad*1000&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<p.depthMm/2+pad*1000;}))continue;
   const ground=sample(x,z);if(ground.water)continue;
   result.push({id:`plant-${ix}-${iz}`,catalogId:c.id,floorId:floor.id,x:Math.round(x*1000),z:Math.round(z*1000),rotation:Math.round(noise(ix,iz,71)*360),widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,elevationMm:Math.round(ground.height*1000)-floor.elevationMm-50,variant:'sage'});
  }
 }
 return result;
}
