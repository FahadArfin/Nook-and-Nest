import {polygonRooms, type DrawingPoint} from './studioTools';

export type SnapSegment = {a:DrawingPoint;b:DrawingPoint};
export type PolygonSnap = {point:DrawingPoint;kind?:'wall'|'corner'|'alignment'|'close';guide?:DrawingPoint};

/** Screen-space magnetism, constrained before snapping so a snapped edge stays orthogonal. */
export function snapPolygon(raw:DrawingPoint,corners:DrawingPoint[],walls:SnapSegment[],tolerance:number,enabled=true):PolygonSnap {
  const last=corners.at(-1),horizontal=!!last&&Math.abs(raw.x-last.x)>Math.abs(raw.z-last.z);
  const point=last?(horizontal?{x:raw.x,z:last.z}:{x:last.x,z:raw.z}):{...raw};
  if(!enabled)return {point};
  const distance=(a:DrawingPoint,b:DrawingPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
  const reachable=(p:DrawingPoint)=>!last||(horizontal?p.z===last.z:p.x===last.x);
  const start=corners[0];
  if(corners.length>=4&&reachable(start)&&distance(raw,start)<=tolerance*1.25){
    try{polygonRooms(corners);return {point:start,kind:'close'};}catch{/* Keep invalid drawings editable. */}
  }
  const candidates:(PolygonSnap&{distance:number;priority:number})[]=[];
  const add=(p:DrawingPoint,kind:PolygonSnap['kind'],priority:number,guide?:DrawingPoint)=>{
    const d=distance(point,p);
    if(d<=tolerance&&(!last||distance(last,p)>=100))candidates.push({point:p,kind,guide,distance:d,priority});
  };
  for(const {a,b} of walls){
    for(const p of [a,b])if(reachable(p))add(p,'corner',0);
    if(a.x===b.x){
      const z=last&&horizontal?last.z:Math.max(Math.min(a.z,b.z),Math.min(Math.max(a.z,b.z),point.z));
      const p={x:a.x,z};
      if(reachable(p)&&z>=Math.min(a.z,b.z)&&z<=Math.max(a.z,b.z))add(p,'wall',1);
    }else if(a.z===b.z){
      const x=last&&!horizontal?last.x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),point.x));
      const p={x,z:a.z};
      if(reachable(p)&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x))add(p,'wall',1);
    }
  }
  // Align to this room's earlier corners, making the final edge easy to close.
  for(const p of corners.slice(0,-1)){
    if(reachable(p))add(p,'corner',0);
    if(last)add(horizontal?{x:p.x,z:last.z}:{x:last.x,z:p.z},'alignment',2,p);
  }
  candidates.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
  return candidates[0]??{point};
}
