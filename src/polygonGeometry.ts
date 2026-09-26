import clipping, {type MultiPolygon, type Polygon} from 'polygon-clipping';
import earcut from 'earcut';
import type {FloorRect} from './floorGeometry';

export interface PlanPoint {x:number;z:number}
export const signedArea=(p:PlanPoint[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.z-b.x*a.z;},0)/2;
export const ringOf=(r:FloorRect):PlanPoint[]=>r.polygon??[{x:r.x,z:r.z},{x:r.x+r.width,z:r.z},{x:r.x+r.width,z:r.z+r.depth},{x:r.x,z:r.z+r.depth}];
export const shapeOf=(r:FloorRect):Polygon=>[ringOf(r).map(p=>[p.x,p.z])];
export const polygonBounds=(polygon:PlanPoint[]):FloorRect=>{const x=Math.min(...polygon.map(p=>p.x)),z=Math.min(...polygon.map(p=>p.z));return {x,z,width:Math.max(...polygon.map(p=>p.x))-x,depth:Math.max(...polygon.map(p=>p.z))-z,polygon};};
export const unionShapes=(parts:FloorRect[]):MultiPolygon=>parts.length?clipping.union(shapeOf(parts[0]),...parts.slice(1).map(shapeOf)):[];
export function geometryArea(polys:MultiPolygon):number{return polys.reduce((sum,rings)=>sum+rings.reduce((s,ring,i)=>s+(i?-1:1)*Math.abs(signedArea(ring.map(([x,z])=>({x,z})))),0),0);}
export const shapeArea=(r:FloorRect)=>Math.abs(signedArea(ringOf(r)));
export function shapeIntersection(a:FloorRect[],b:FloorRect[]):number{return a.length&&b.length?geometryArea(clipping.intersection(unionShapes(a),unionShapes(b))):0;}
export function shapeCovered(r:FloorRect,parts:FloorRect[]):boolean{return parts.length>0&&geometryArea(clipping.difference(shapeOf(r),unionShapes(parts)))<.1;}
export function shapeEdges(parts:FloorRect[]){return unionShapes(parts).flatMap(rings=>rings.flatMap(ring=>{
 const points=ring.slice(0,-1).map(([x,z])=>({x,z}));let changed=true;
 while(changed&&points.length>3){changed=false;for(let i=0;i<points.length;i++){const p=points[i],a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],q=projectPoint(p,a,b);if(Math.hypot(p.x-q.x,p.z-q.z)<.001){points.splice(i,1);changed=true;break;}}}
 return points.map((a,i)=>({a,b:points[(i+1)%points.length]}));
 }));}
export function geometryParts(polys:MultiPolygon):FloorRect[]{return polys.flatMap(rings=>{
  if(rings.length===1)return [polygonBounds(rings[0].slice(0,-1).map(([x,z])=>({x,z})))];
  // Holes remain empty: triangulate them instead of replacing them with a bounding box.
  const points=rings.flatMap(r=>r.slice(0,-1)),holes:number[]=[];let n=0;for(const r of rings){if(n)holes.push(n);n+=r.length-1;}
  const indices=earcut(points.flat(),holes);return Array.from({length:indices.length/3},(_,i)=>polygonBounds(indices.slice(i*3,i*3+3).map(j=>({x:points[j][0],z:points[j][1]}))));
});}
export const clipShape=(a:FloorRect,b:FloorRect)=>geometryParts(clipping.intersection(shapeOf(a),shapeOf(b)));
export const differenceShape=(a:FloorRect,b:FloorRect)=>geometryParts(clipping.difference(shapeOf(a),shapeOf(b)));
export function projectPoint(p:PlanPoint,a:PlanPoint,b:PlanPoint){
 if(a.x===b.x)return {x:a.x,z:Math.max(Math.min(a.z,b.z),Math.min(Math.max(a.z,b.z),p.z))};
 if(a.z===b.z)return {x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),p.x)),z:a.z};
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return {x:a.x+dx*t,z:a.z+dz*t};
}
export function validatePolygon(p:PlanPoint[],minEdge=0.001):void{
  if(!Array.isArray(p)||p.length<3||p.length>160||p.some(a=>!a||![a.x,a.z].every(Number.isFinite)||Math.max(Math.abs(a.x),Math.abs(a.z))>100000))throw new Error('Draw 3 to 160 valid corners within 100 metres.');
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(b.x-a.x,b.z-a.z)<minEdge)throw new Error('Keep each edge at least 10 cm long.');
    for(let j=i+1;j<p.length;j++){
      if(j===i+1||(i===0&&j===p.length-1))continue;
      const c=p[j],d=p[(j+1)%p.length],cross=(u:PlanPoint,v:PlanPoint,w:PlanPoint)=>(v.x-u.x)*(w.z-u.z)-(v.z-u.z)*(w.x-u.x);
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+.0001&&Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z))+.0001)throw new Error('Room edges cannot cross or fold back. Undo the last corner.');
    }
  }
  if(Math.abs(signedArea(p))<.001)throw new Error('Close an outline with an area.');
}
/** True polygon prism, with world-space UVs and no bounding-box floor outside angled edges. */
export function polygonPrism(p:PlanPoint[],height=.08){
  const positions:number[]=[],indices:number[]=[],uvs:number[]=[];
  const add=(x:number,y:number,z:number)=>{positions.push(x,y,z);uvs.push(x,z);};
  for(const y of [height/2,-height/2])for(const v of p)add(v.x/1000,y,v.z/1000);
  const triangles=earcut(p.flatMap(v=>[v.x,v.z]));const n=p.length;
  for(let i=0;i<triangles.length;i+=3){const [a,b,c]=triangles.slice(i,i+3);indices.push(c,b,a,a+n,b+n,c+n);}
  for(let i=0;i<n;i++){const j=(i+1)%n,k=positions.length/3;for(const v of [p[i],p[j]]){add(v.x/1000,height/2,v.z/1000);add(v.x/1000,-height/2,v.z/1000);}if(signedArea(p)>0)indices.push(k,k+2,k+1,k+2,k+3,k+1);else indices.push(k+1,k+2,k,k+1,k+3,k+2);}
  return {positions,indices,uvs};
}
