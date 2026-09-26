import clipping from 'polygon-clipping';
import {shapeOf,geometryParts,polygonBounds,signedArea,shapeIntersection,shapeArea,shapeEdges,projectPoint,validatePolygon,type PlanPoint} from './polygonGeometry';
import {roomGroups,type BlueprintDraft,type BlueprintRoom,type RoomKind} from './blueprint';
import type {SnapSegment} from './studioSnapping';

/** Split crossings and walk directed half-edges; positive faces are enclosed rooms. */
export function enclosedFaces(lines:SnapSegment[]):PlanPoint[][]{
  if(lines.length>600)throw new Error('Finish this drawing before adding more wall lines.');
  const cuts=lines.map(()=>[0,1]);
  const cross=(x:number,z:number,a:number,b:number)=>x*b-z*a;
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const {a,b}=lines[i],{a:c,b:d}=lines[j],dx=b.x-a.x,dz=b.z-a.z,ex=d.x-c.x,ez=d.z-c.z,det=cross(dx,dz,ex,ez);
    if(Math.abs(det)>1e-7){const t=cross(c.x-a.x,c.z-a.z,ex,ez)/det,u=cross(c.x-a.x,c.z-a.z,dx,dz)/det;if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8){cuts[i].push(Math.max(0,Math.min(1,t)));cuts[j].push(Math.max(0,Math.min(1,u)));}}
    else for(const [idx,p,q,ends] of [[i,a,b,[c,d]],[j,c,d,[a,b]]] as [number,PlanPoint,PlanPoint,PlanPoint[]][]){for(const v of ends){const near=projectPoint(v,p,q);if(Math.hypot(near.x-v.x,near.z-v.z)<.001)cuts[idx].push(((v.x-p.x)*(q.x-p.x)+(v.z-p.z)*(q.z-p.z))/((q.x-p.x)**2+(q.z-p.z)**2));}}
  }
  const nodes=new Map<string,PlanPoint>(),links=new Map<string,Set<string>>();
  const key=(p:PlanPoint)=>`${Math.round(p.x*1000)/1000},${Math.round(p.z*1000)/1000}`;
  lines.forEach(({a,b},i)=>{const ts=[...new Set(cuts[i])].sort((a,b)=>a-b);for(let j=1;j<ts.length;j++){const points=[ts[j-1],ts[j]].map(t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}));const [u,v]=points.map(key);if(u===v)continue;nodes.set(u,points[0]);nodes.set(v,points[1]);for(const [x,y] of [[u,v],[v,u]]){const set=links.get(x)??new Set();set.add(y);links.set(x,set);}}});
  // Remove dangling tails so an unfinished extra line cannot corrupt a closed face.
  let changed=true;while(changed){changed=false;for(const [u,vs] of links)if(vs.size<2){for(const v of vs)links.get(v)?.delete(u);links.delete(u);changed=true;}}
  const ordered=new Map([...links].map(([u,vs])=>{const p=nodes.get(u)!;return [u,[...vs].sort((a,b)=>{const x=nodes.get(a)!,y=nodes.get(b)!;return Math.atan2(x.z-p.z,x.x-p.x)-Math.atan2(y.z-p.z,y.x-p.x);})];}));
  const seen=new Set<string>(),faces:PlanPoint[][]=[];
  for(const [start,vs] of ordered)for(const next of vs){if(seen.has(`${start}|${next}`))continue;let u=start,v=next;const ring:PlanPoint[]=[];let closed=false;
    for(let step=0;step<links.size*4;step++){const edge=`${u}|${v}`;if(seen.has(edge)){closed=u===start&&v===next;break;}seen.add(edge);ring.push(nodes.get(u)!);const neighbors=ordered.get(v)!;const w=neighbors[(neighbors.indexOf(u)+neighbors.length-1)%neighbors.length];u=v;v=w;}
    if(closed&&signedArea(ring)>100){try{validatePolygon(ring);faces.push(ring);}catch{/* A self-touching exterior is not a room. */}}
  }
  return faces;
}
export function angledRoomProposal(draft:BlueprintDraft,grid:number,strokes:SnapSegment[],kind:RoomKind){
  const groups=roomGroups(draft.rooms),lines=[...groups.flatMap(g=>shapeEdges(g.parts)),...draft.walls.map(w=>({a:{x:w.ax*grid,z:w.az*grid},b:{x:w.bx*grid,z:w.bz*grid}})),...strokes];
  const faces=enclosedFaces(lines).map(polygonBounds),rooms:BlueprintRoom[]=[],changed:BlueprintRoom[]=[];let count=0;
  for(const face of faces){
    const children=faces.filter(f=>f!==face&&shapeArea(f)<shapeArea(face)-1&&Math.abs(shapeIntersection([face],[f])-shapeArea(f))<1);
    const parts=children.length?geometryParts(clipping.difference(shapeOf(face),...children.map(shapeOf))):[face];
    const area=parts.reduce((n,p)=>n+shapeArea(p),0),owner=groups.find(g=>Math.abs(shapeIntersection(g.parts,parts)-area)<1);
    if(owner&&Math.abs(owner.parts.reduce((s,p)=>s+shapeArea(p),0)-area)<1){rooms.push(...owner.parts);continue;}
    if(!shapeEdges(parts).some(({a,b})=>strokes.some(w=>{const m={x:(a.x+b.x)/2,z:(a.z+b.z)/2},q=projectPoint(m,w.a,w.b);return Math.hypot(m.x-q.x,m.z-q.z)<.01;})))continue;
    if(face.width>60000||face.depth>60000)throw new Error('Keep each room within 60 metres.');
    const id=`connected:${++count}`,added:BlueprintRoom[]=parts.map((p,i)=>({...p,id:`${id}:${i}`,groupId:id,name:owner?`${owner.name} ${count}`:`${kind} ${groups.length+count}`,kind:owner?.kind??kind,enclosed:true}));rooms.push(...added);changed.push(...added);
  }
  for(const g of groups)if(!rooms.some(r=>g.parts.some(p=>p.id===r.id))&&!changed.some(r=>shapeIntersection(g.parts,[r])>1))rooms.push(...g.parts);
  if(rooms.length>100)throw new Error('Keep this floor within 100 room areas.');
  return {rooms,changed,count};
}
