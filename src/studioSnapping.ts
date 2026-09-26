import {projectPoint} from './polygonGeometry';
import {polygonRooms, type DrawingPoint} from './studioTools';

export type SnapSegment = {a:DrawingPoint;b:DrawingPoint};
export type PolygonSnap = {point:DrawingPoint;kind?:'wall'|'corner'|'alignment'|'close'|'length';guide?:DrawingPoint;guides?:SnapSegment[];matchedWall?:SnapSegment;rightAngle?:boolean};

/** Soft construction guides never replace a real wall/corner connection. */
function snapFreePolygon(raw:DrawingPoint,corners:DrawingPoint[],walls:SnapSegment[],tolerance:number):PolygonSnap {
  const last=corners.at(-1),previous=corners.at(-2);
  const distance=(a:DrawingPoint,b:DrawingPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
  const anchors=[...corners.slice(0,-1),...walls.flatMap(w=>[w.a,w.b])];
  const edges=[...corners.slice(1).map((b,i)=>({a:corners[i],b})),...walls];
  const length=(w:SnapSegment)=>distance(w.a,w.b);
  const decorate=(result:PolygonSnap):PolygonSnap=>{
    const p=result.point;
    const guides:SnapSegment[]=[];
    // One nearby anchor per axis keeps crowded plans readable.
    for(const axis of last?['x','z'] as const:[]){
      const anchor=anchors.filter(a=>Math.abs(a[axis]-p[axis])<.01&&distance(a,p)>1).sort((a,b)=>distance(a,p)-distance(b,p))[0];
      if(anchor)guides.push({a:anchor,b:p});
    }
    const activeLength=last?distance(last,p):0;
    const matchedWall=activeLength>=100?edges.find(w=>Math.abs(length(w)-activeLength)<.1):undefined;
    const rightAngle=!!last&&!!previous&&activeLength>=100&&distance(last,previous)>=100&&Math.abs((last.x-previous.x)*(p.x-last.x)+(last.z-previous.z)*(p.z-last.z))/(distance(last,previous)*activeLength)<.00001;
    return {...result,guides,guide:guides[0]?.a,matchedWall,rightAngle};
  };
  const usable=(p:DrawingPoint)=>!last||distance(last,p)>=100;
  if(corners.length>=3&&distance(raw,corners[0])<=tolerance*1.25){
    try{polygonRooms(corners);return decorate({point:corners[0],kind:'close'});}catch{/* Keep invalid outlines editable. */}
  }
  const corner=anchors.filter(usable).sort((a,b)=>distance(raw,a)-distance(raw,b))[0];
  if(corner&&distance(raw,corner)<=tolerance)return decorate({point:corner,kind:'corner'});
  if(!last||distance(raw,last)<100){
    const wall=walls.map(w=>projectPoint(raw,w.a,w.b)).filter(usable).sort((a,b)=>distance(raw,a)-distance(raw,b))[0];
    return wall&&distance(raw,wall)<=tolerance?decorate({point:wall,kind:'wall'}):{point:raw};
  }
  const dx=raw.x-last.x,dz=raw.z-last.z,rawLength=distance(raw,last);
  const angles=[0,Math.PI/4,Math.PI/2,3*Math.PI/4];
  if(previous)angles.push(Math.atan2(last.z-previous.z,last.x-previous.x)+Math.PI/2);
  const directions=angles.map(angle=>{
    const u={x:Math.cos(angle),z:Math.sin(angle)},along=dx*u.x+dz*u.z;
    const point={x:Math.round((last.x+along*u.x)*1000)/1000,z:Math.round((last.z+along*u.z)*1000)/1000};
    return {u,point,offset:distance(raw,point)};
  }).filter(d=>d.offset<=tolerance&&d.offset/rawLength<.12).sort((a,b)=>a.offset-b.offset);
  const direction=directions[0];
  const base=direction?.point??raw;
  // Intersect the constrained ray with the wall instead of projecting sideways:
  // the connection stays on the real segment and the new corner stays square.
  const wallTargets=walls.map(w=>{
    if(direction){
      const vx=w.b.x-w.a.x,vz=w.b.z-w.a.z,u=direction.u,det=u.x*vz-u.z*vx;
      if(Math.abs(det)>.00001){
        const ax=w.a.x-last.x,az=w.a.z-last.z;
        const t=(ax*vz-az*vx)/det,s=(ax*u.z-az*u.x)/det;
        const p={x:last.x+t*u.x,z:last.z+t*u.z};
        if(s>=0&&s<=1&&distance(base,p)<=tolerance&&usable(p))return p;
      }
    }
    return projectPoint(raw,w.a,w.b);
  }).filter(p=>usable(p)&&distance(raw,p)<=tolerance*Math.SQRT2).sort((a,b)=>distance(base,a)-distance(base,b));
  const wall=wallTargets.find(p=>distance(base,p)<=tolerance);
  if(wall)return decorate({point:wall,kind:'wall'});
  const candidates:DrawingPoint[]=[];
  for(const anchor of anchors){
    for(const axis of ['x','z'] as const){
      let p:DrawingPoint;
      if(direction){
        if(Math.abs(direction.u[axis])<.00001)continue;
        const along=(anchor[axis]-last[axis])/direction.u[axis];
        p={x:last.x+along*direction.u.x,z:last.z+along*direction.u.z};
        p[axis]=anchor[axis];
      }else p={...base,[axis]:anchor[axis]};
      if(distance(base,p)<=tolerance&&usable(p))candidates.push(p);
    }
  }
  // A corner's level takes precedence over a coincidental matching length.
  candidates.sort((a,b)=>distance(base,a)-distance(base,b));
  if(candidates[0])return decorate({point:candidates[0],kind:'alignment'});
  const baseLength=distance(last,base);
  const equal=edges.filter(w=>length(w)>=100&&Math.abs(length(w)-baseLength)<=tolerance).sort((a,b)=>Math.abs(length(a)-baseLength)-Math.abs(length(b)-baseLength))[0];
  if(equal&&baseLength>=100){
    const ratio=length(equal)/baseLength;
    return decorate({point:{x:last.x+(base.x-last.x)*ratio,z:last.z+(base.z-last.z)*ratio},kind:'length'});
  }
  return decorate({point:base,...(direction?{kind:'alignment' as const}:{})});
}

/** Screen-space magnetism, constrained before snapping so a snapped edge stays orthogonal. */
export function snapPolygon(raw:DrawingPoint,corners:DrawingPoint[],walls:SnapSegment[],tolerance:number,enabled=true,freeAngles=false):PolygonSnap {
  if(freeAngles){
    if(!enabled)return {point:raw};
    return snapFreePolygon(raw,corners,walls,tolerance);
  }
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
    for(const p of [a,b]){
      if(reachable(p))add(p,'corner',0);
      // Project existing corners onto the active axis even beyond the wall end.
      // This is an alignment guide, not a claim that a physical wall is there.
      if(last)add(horizontal?{x:p.x,z:last.z}:{x:last.x,z:p.z},'alignment',2,p);
    }
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
