import {angledRoomProposal} from './angledRooms';
import {shapeEdges} from './polygonGeometry';
import {roomGroups,type BlueprintDraft,type BlueprintRoom,type RoomKind} from './blueprint';
import {unionRects,type FloorRect} from './floorGeometry';
import {regionsFromWalls} from './wallFirstGeometry';
import type {SnapSegment} from './studioSnapping';

/** Cancel shared rectangle edges so concave rooms never acquire artificial seams. */
export function roomOutline(parts:FloorRect[]):SnapSegment[]{
  if(parts.some(r=>r.polygon))return shapeEdges(parts);
  const lines=new Map<string,{h:boolean;line:number;events:Map<number,number>}>();
  const edge=(h:boolean,line:number,start:number,end:number,sign:number)=>{
    const key=`${h}:${line}`,row=lines.get(key)??{h,line,events:new Map<number,number>()};
    row.events.set(start,(row.events.get(start)??0)+sign);row.events.set(end,(row.events.get(end)??0)-sign);lines.set(key,row);
  };
  for(const r of unionRects(parts)){edge(true,r.z,r.x,r.x+r.width,-1);edge(true,r.z+r.depth,r.x,r.x+r.width,1);edge(false,r.x,r.z,r.z+r.depth,-1);edge(false,r.x+r.width,r.z,r.z+r.depth,1);}
  const result:SnapSegment[]=[];
  for(const {h,line,events} of lines.values()){
    const points=[...events.keys()].sort((a,b)=>a-b);let count=0;
    for(let i=0;i<points.length-1;i++){count+=events.get(points[i])!;if(count)result.push({a:{x:h?points[i]:line,z:h?line:points[i]},b:{x:h?points[i+1]:line,z:h?line:points[i+1]}});}
  }
  return result;
}
const area=(parts:FloorRect[])=>unionRects(parts).reduce((n,r)=>n+r.width*r.depth,0);
const overlap=(a:FloorRect[],b:FloorRect[])=>a.reduce((n,r)=>n+b.reduce((sum,s)=>sum+Math.max(0,Math.min(r.x+r.width,s.x+s.width)-Math.max(r.x,s.x))*Math.max(0,Math.min(r.z+r.depth,s.z+s.depth)-Math.max(r.z,s.z)),0),0);

function cutsInterior({a,b}:SnapSegment,parts:FloorRect[]){
  const h=a.z===b.z,lo=Math.min(h?a.x:a.z,h?b.x:b.z),hi=Math.max(h?a.x:a.z,h?b.x:b.z);
  const points=[...new Set([lo,hi,...parts.flatMap(r=>h?[r.x,r.x+r.width]:[r.z,r.z+r.depth])])].filter(n=>n>=lo&&n<=hi).sort((a,b)=>a-b);
  const inside=(x:number,z:number)=>parts.some(r=>x>=r.x&&x<=r.x+r.width&&z>=r.z&&z<=r.z+r.depth);
  return points.slice(1).some((n,i)=>{const mid=(n+points[i])/2;return h?inside(mid,a.z-.1)&&inside(mid,a.z+.1):inside(a.x-.1,mid)&&inside(a.x+.1,mid);});
}

function sharesSpan(edge:SnapSegment,w:SnapSegment){
  const h=edge.a.z===edge.b.z;
  if(h!==(w.a.z===w.b.z)||Math.abs((h?edge.a.z:edge.a.x)-(h?w.a.z:w.a.x))>=.05)return false;
  return Math.min(Math.max(h?edge.a.x:edge.a.z,h?edge.b.x:edge.b.z),Math.max(h?w.a.x:w.a.z,h?w.b.x:w.b.z))>Math.max(Math.min(h?edge.a.x:edge.a.z,h?edge.b.x:edge.b.z),Math.min(h?w.a.x:w.a.z,h?w.b.x:w.b.z));
}

/** Flood the finite line arrangement and discard the unbounded exterior face. */
export function connectedRoomProposal(draft:BlueprintDraft,grid:number,strokes:SnapSegment[],kind:RoomKind='Living'){
  if(strokes.length>80)throw new Error('Apply these rooms before drawing more than 80 wall lines.');
  if(!strokes.length)return {rooms:draft.rooms,changed:[] as BlueprintRoom[],count:0};
  if(strokes.some(({a,b})=>![a.x,a.z,b.x,b.z].every(Number.isFinite)||Math.max(Math.abs(a.x),Math.abs(a.z),Math.abs(b.x),Math.abs(b.z))>100000||Math.hypot(a.x-b.x,a.z-b.z)<100))throw new Error('Draw edges at least 10 cm long, within 100 metres.');
  if(draft.rooms.some(r=>r.polygon)||strokes.some(({a,b})=>a.x!==b.x&&a.z!==b.z))return angledRoomProposal(draft,grid,strokes,kind);
  if(strokes.some(({a,b})=>![a.x,a.z,b.x,b.z].every(Number.isFinite)||Math.max(Math.abs(a.x),Math.abs(a.z),Math.abs(b.x),Math.abs(b.z))>100000||(a.x!==b.x&&a.z!==b.z)||Math.hypot(a.x-b.x,a.z-b.z)<100))throw new Error('Draw horizontal or vertical lines at least 10 cm long, within 100 metres.');
  const originals=roomGroups(draft.rooms);
  const lines=[...originals.flatMap(g=>roomOutline(g.parts)),...draft.walls.map(w=>({a:{x:w.ax*grid,z:w.az*grid},b:{x:w.bx*grid,z:w.bz*grid}})),...strokes];
  if(lines.length>600)throw new Error('This drawing has too many boundaries for connected-room detection.');
  const xs=lines.flatMap(w=>[w.a.x,w.b.x]),zs=lines.flatMap(w=>[w.a.z,w.b.z]);
  const x=Math.min(...xs)-1000,z=Math.min(...zs)-1000,right=Math.max(...xs)+1000,bottom=Math.max(...zs)+1000;
  const bounds:BlueprintRoom={id:'bounds',name:'Bounds',kind:'Hall',enclosed:false,x,z,width:right-x,depth:bottom-z};
  const result=regionsFromWalls({rooms:[bounds],walls:[],fixtures:[],omittedWalls:[]},1,lines.map((w,i)=>({id:`line:${i}`,ax:w.a.x,az:w.a.z,bx:w.b.x,bz:w.b.z})));
  const faces=roomGroups(result.rooms).filter(g=>!g.parts.some(r=>r.x===x||r.z===z||r.x+r.width===right||r.z+r.depth===bottom));
  const rooms:BlueprintRoom[]=[],changed:BlueprintRoom[]=[];let count=0;
  const used=new Set<string>();
  for(const face of faces){
    const size=area(face.parts),owner=originals.find(g=>Math.abs(overlap(unionRects(g.parts),face.parts)-size)<1);
    if(owner&&Math.abs(area(owner.parts)-size)<1){rooms.push(...owner.parts);used.add(owner.id);continue;}
    if(owner&&!strokes.some(w=>cutsInterior(w,owner.parts)))continue;
    // An untouched enclosed courtyard/gap is not a newly drawn room.
    if(!owner&&!roomOutline(face.parts).some(edge=>strokes.some(w=>sharesSpan(edge,w))))continue;
    if(face.parts.some(r=>r.width>60000||r.depth>60000))throw new Error('Keep each room edge within 60 metres.');
    const id=`connected:${++count}`,name=owner?`${owner.name} ${count}`:`${kind} ${originals.length+count}`;
    const parts=face.parts.map((r,i)=>({...r,id:`${id}:${i}`,groupId:id,name,kind:owner?.kind??kind,enclosed:true}));
    rooms.push(...parts);changed.push(...parts);
  }
  // Keep original room data when no new line actually splits its area.
  for(const g of originals)if(!used.has(g.id)&&!changed.some(r=>overlap(g.parts,[r])>1))rooms.push(...g.parts);
  if(rooms.length>100)throw new Error('This creates too many room parts. Apply a smaller set of wall lines.');
  return {rooms,changed,count};
}
