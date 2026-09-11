import type {PlanDocumentV1} from './types';
import {floorRects} from './floorGeometry';
import {isVegetation} from './vegetation';
import type {PlantingBrush} from './planting';
export type GrassCoverage=Record<string,number>;
/** Rotation-aware occupancy, indexed once per immutable furniture array. */
const masks=new WeakMap<PlanDocumentV1['furniture'],(x:number,z:number,pad?:number)=>boolean>();
export function furnitureGrassMask(plan:PlanDocumentV1){
 const cached=masks.get(plan.furniture);if(cached)return cached;
 const grid=new Map<string,PlanDocumentV1['furniture']>();
 for(const p of plan.furniture){if(isVegetation(p.catalogId))continue;const r=Math.hypot(p.widthMm,p.depthMm)/2000+1;for(let x=Math.floor((p.x/1000-r)/4);x<=Math.floor((p.x/1000+r)/4);x++)for(let z=Math.floor((p.z/1000-r)/4);z<=Math.floor((p.z/1000+r)/4);z++){const k=x+':'+z,a=grid.get(k)??[];a.push(p);grid.set(k,a)}}
 const mask=(x:number,z:number,pad=0)=>(grid.get(Math.floor(x/4)+':'+Math.floor(z/4))??[]).some(p=>{const a=p.rotation*Math.PI/180,dx=x-p.x/1000,dz=z-p.z/1000;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<p.widthMm/2000+pad&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<p.depthMm/2000+pad});
 if(Object.isFrozen(plan.furniture))masks.set(plan.furniture,mask);return mask;
}
const strokes=new WeakMap<PlanDocumentV1,{signature:string;points:Array<{x:number;z:number}>;coverage:GrassCoverage}>();
/** One-metre world tiles store coverage, never one record per blade. */
export function paintGrassCoverage(plan:PlanDocumentV1,points:Array<{x:number;z:number}>,brush:PlantingBrush):GrassCoverage{
 const signature=JSON.stringify(brush),cached=strokes.get(plan),reuse=cached?.signature===signature&&cached.points.length<=points.length&&cached.points.every((p,i)=>p.x===points[i].x&&p.z===points[i].z);
 const next={...(reuse?cached.coverage:plan.environment?.grassCoverage)},radius=Math.max(.5,Math.min(4,brush.radius)),density=brush.eraseCoverage?0:Math.max(1,Math.min(9,Math.round(brush.density??1)));
 const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
 for(let i=reuse?cached.points.length:0;i<points.length;i++){const b=points[i],a=points[i-1]??b;if(!Number.isFinite(a.x+a.z+b.x+b.z))continue;const steps=Math.min(1600,Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4)));
 for(let t=1;t<=steps;t++){const px=a.x+(b.x-a.x)*t/steps,pz=a.z+(b.z-a.z)*t/steps;
 for(let x=Math.max(-200,Math.floor(px-radius));x<Math.min(200,Math.ceil(px+radius));x++)for(let z=Math.max(-200,Math.floor(pz-radius));z<Math.min(200,Math.ceil(pz+radius));z++){
 if(Math.hypot(x+.5-px,z+.5-pz)>radius)continue;const key=x+':'+z;if(!density){delete next[key];continue;}if(rects.some(r=>(x+1)*1000>r.x&&x*1000<r.x+r.width&&(z+1)*1000>r.z&&z*1000<r.z+r.depth))continue;next[key]=density;
 }}}
 strokes.set(plan,{signature,points:points.map(p=>({...p})),coverage:next});return next;
}
