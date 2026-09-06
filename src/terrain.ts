import {floorRects} from './floorGeometry';
import type {PlanDocumentV1} from './types';
export interface TerrainStroke {kind:'raise'|'lower'|'river';radius:number;strength:number;points:Array<{x:number;z:number}>}
export const terrainLimit=128;
/** Metres. A bounded height field, with untouched apartment foundations. */
export function terrainSampler(plan:PlanDocumentV1){
  const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
  const strokes=plan.environment?.terrain??[];
  return (x:number,z:number)=>{
    const foundationDistance=rects.reduce((d,r)=>Math.min(d,Math.hypot(Math.max(r.x/1000-x,0,x-(r.x+r.width)/1000),Math.max(r.z/1000-z,0,z-(r.z+r.depth)/1000))),Infinity);
    if(foundationDistance<=.25)return {height:-.15,water:false};
    const t=Math.min(1,(foundationDistance-.25)/1.25),foundationBlend=t*t*(3-2*t);
    let height=-.15,water=false;
    for(const s of strokes){
      let distance=Infinity;
      for(let i=0;i<s.points.length;i++){
        const a=s.points[i],b=s.points[Math.min(i+1,s.points.length-1)],dx=b.x-a.x,dz=b.z-a.z;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
        distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
      }
      if(distance>=s.radius)continue;
      const falloff=(1-(distance/s.radius)**2)**2;
      if(s.kind==='river'){height=Math.min(height,-.15-s.strength*falloff);if(distance<s.radius*.64)water=true;}
      else height+=s.strength*falloff*(s.kind==='raise'?1:-1);
    }
    return {height:Math.max(-4,Math.min(5,-.15+(height+.15)*foundationBlend)),water:water&&foundationBlend>.9};
  };
}
export function terrainRay(plan:PlanDocumentV1,origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number}){
  if(direction.y>=-.00001)return;
  const sample=terrainSampler(plan);let previous=0;
  for(let t=.25;t<=250;t+=.25){
    const x=origin.x+t*direction.x,z=origin.z+t*direction.z;
    if(origin.y+t*direction.y<=sample(x,z).height){
      let lo=previous,hi=t;for(let j=0;j<12;j++){const m=(lo+hi)/2;const p=sample(origin.x+m*direction.x,origin.z+m*direction.z);if(origin.y+m*direction.y>p.height)lo=m;else hi=m;}
      const x=origin.x+hi*direction.x,z=origin.z+hi*direction.z;return {x,z,y:sample(x,z).height,distance:hi};
    }previous=t;
  }
}
