import {floorRects} from './floorGeometry';
import type {PlanDocumentV1} from './types';
export interface TerrainStroke {kind:'raise'|'lower'|'river';radius:number;strength:number;carve?:boolean;points:Array<{x:number;z:number}>}
export const terrainLimit=128;
const samplerCache=new WeakMap<PlanDocumentV1,ReturnType<typeof buildTerrainSampler>>();
export function terrainSampler(plan:PlanDocumentV1){if(!Object.isFrozen(plan))return buildTerrainSampler(plan);let sample=samplerCache.get(plan);if(!sample){sample=buildTerrainSampler(plan);samplerCache.set(plan,sample)}return sample}
/** Metres. A bounded height field, with untouched apartment foundations. */
function buildTerrainSampler(plan:PlanDocumentV1){
  const rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
  const strokes=plan.environment?.terrain??[];
  const buckets=new Map<string,typeof rects>();
  for(const r of rects)for(let bx=Math.floor((r.x/1000-1.5)/4);bx<=Math.floor(((r.x+r.width)/1000+1.5)/4);bx++)for(let bz=Math.floor((r.z/1000-1.5)/4);bz<=Math.floor(((r.z+r.depth)/1000+1.5)/4);bz++){const key=bx+':'+bz;const entries=buckets.get(key)??[];entries.push(r);buckets.set(key,entries)}

  // Index segments, preserving stroke order and minimum distance within each stroke.
  const segments=new Map<string,Array<{stroke:number;a:{x:number;z:number};dx:number;dz:number;length2:number}>>();
  const broad:Array<{stroke:number;a:{x:number;z:number};dx:number;dz:number;length2:number}>=[];
  strokes.forEach((s,stroke)=>s.points.forEach((a,i)=>{const b=s.points[Math.min(i+1,s.points.length-1)],dx=b.x-a.x,dz=b.z-a.z,entry={stroke,a,dx,dz,length2:dx*dx+dz*dz||1};
    if((Math.abs(dx)+2*s.radius)*(Math.abs(dz)+2*s.radius)>65536){broad.push(entry);return;}
    for(let bx=Math.floor((Math.min(a.x,b.x)-s.radius)/4);bx<=Math.floor((Math.max(a.x,b.x)+s.radius)/4);bx++)for(let bz=Math.floor((Math.min(a.z,b.z)-s.radius)/4);bz<=Math.floor((Math.max(a.z,b.z)+s.radius)/4);bz++){const key=bx+':'+bz,list=segments.get(key)??[];list.push(entry);segments.set(key,list)}
  }));
  return (x:number,z:number)=>{
    const foundationDistance=(buckets.get(Math.floor(x/4)+':'+Math.floor(z/4))??[]).reduce((d,r)=>Math.min(d,Math.hypot(Math.max(r.x/1000-x,0,x-(r.x+r.width)/1000),Math.max(r.z/1000-z,0,z-(r.z+r.depth)/1000))),Infinity);
    if(foundationDistance<=.25)return {height:-.15,water:false};
    const t=Math.min(1,(foundationDistance-.25)/1.25),foundationBlend=t*t*(3-2*t);
    let height=-.15,water=false,sourceDepth=0;
    const distances=new Map<number,number>();
    for(const e of [...broad,...(segments.get(Math.floor(x/4)+':'+Math.floor(z/4))??[])]){const t=Math.max(0,Math.min(1,((x-e.a.x)*e.dx+(z-e.a.z)*e.dz)/e.length2));const distance=Math.hypot(x-e.a.x-t*e.dx,z-e.a.z-t*e.dz);distances.set(e.stroke,Math.min(distances.get(e.stroke)??Infinity,distance));}
    for(const [index,distance] of [...distances].sort((a,b)=>a[0]-b[0])){const s=strokes[index];
      if(distance>=s.radius)continue;
      const falloff=(1-(distance/s.radius)**2)**2;
      if(s.kind==='river'){if(s.carve!==false)height=Math.min(height,-.15-s.strength*falloff);if(distance<s.radius*.64){water=true;if(s.carve===false)sourceDepth=Math.max(sourceDepth,s.strength);}}
      else height+=s.strength*falloff*(s.kind==='raise'?1:-1);
    }
    height=Math.max(-4,Math.min(5,-.15+(height+.15)*foundationBlend));return {height,water:water&&foundationBlend>.9,waterLevel:sourceDepth?height+sourceDepth:-.2};
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
