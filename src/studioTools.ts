import {unionRects, type FloorRect} from './floorGeometry';

export type DrawingPoint = {x:number;z:number};
export type DrawingAnnotation = {id:string;kind:'dimension'|'note';a:DrawingPoint;b:DrawingPoint;text:string};
export const roomArea = (parts:FloorRect[]) => unionRects(parts).reduce((sum,r)=>sum+r.width*r.depth,0);
export const areaLabel = (area:number,imperial:boolean) => `${(area/(imperial?92903.04:1e6)).toLocaleString(undefined,{maximumFractionDigits:2})} ${imperial?'ft²':'m²'}`;

/** Exact decomposition of a simple orthogonal polygon; never fills its concave recesses. */
export function polygonRooms(points:DrawingPoint[]):FloorRect[] {
  if(points.length<4||points.length>40)throw new Error('Use 4 to 40 corners for a custom room.');
  const edges=points.map((a,i)=>({a,b:points[(i+1)%points.length]}));
  for(const {a,b} of edges){
    if(![a.x,a.z,b.x,b.z].every(Number.isFinite)||Math.max(Math.abs(a.x),Math.abs(a.z))>100000)throw new Error('Keep corners within 100 metres of the origin.');
    if((a.x!==b.x&&a.z!==b.z)||Math.hypot(a.x-b.x,a.z-b.z)<100)throw new Error('Use horizontal or vertical edges at least 10 cm long. Align the last corner with the first.');
  }
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    if(j===i+1||(i===0&&j===edges.length-1))continue;
    const {a,b}=edges[i],{a:c,b:d}=edges[j];
    if(Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z)))throw new Error('Room edges cannot cross or touch themselves. Undo the last corner.');
  }
  const zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b),rects:FloorRect[]=[];
  for(let i=0;i<zs.length-1;i++){
    const z=zs[i],depth=zs[i+1]-z,mid=z+depth/2;
    const xs=edges.filter(({a,b})=>a.x===b.x&&mid>Math.min(a.z,b.z)&&mid<Math.max(a.z,b.z)).map(({a})=>a.x).sort((a,b)=>a-b);
    for(let j=0;j<xs.length;j+=2)rects.push({x:xs[j],z,width:xs[j+1]-xs[j],depth});
  }
  if(!rects.length||rects.some(r=>r.width>60000||r.depth>60000))throw new Error('Use a room no larger than 60 metres per edge.');
  return rects;
}

export function lRoom(a:DrawingPoint,b:DrawingPoint):FloorRect[]{
  const x=Math.min(a.x,b.x),z=Math.min(a.z,b.z),width=Math.abs(b.x-a.x),depth=Math.abs(b.z-a.z);
  if(width<400||depth<400)throw new Error('Draw an L-shaped room at least 40 cm wide and deep.');
  const legWidth=Math.round(width/2),legDepth=Math.round(depth/2);
  return [{x,z,width:legWidth,depth},{x:x+legWidth,z:z+depth-legDepth,width:width-legWidth,depth:legDepth}];
}
