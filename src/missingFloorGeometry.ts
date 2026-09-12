import {mergePixelRects,repairDoorBoundary,type BoundaryInput,type PixelRect} from './doorBoundaryGeometry';
export interface MissingFloorInput extends BoundaryInput {all:PixelRect[]}
export interface FloorRegion {id:string;rects:PixelRect[];added:boolean}
const inside=(r:PixelRect,x:number,y:number)=>x>=r.x-1e-7&&x<r.x+r.width+1e-7&&y>=r.y-1e-7&&y<r.y+r.height+1e-7;

/** Find holes enclosed by existing coverage. Exterior-connected white space is never a candidate. */
export function missingFloorRegions(input:MissingFloorInput):FloorRegion[]{
  const {all,sourceWidth:sw,sourceHeight:sh,width:w,height:h,walls,door}=input;
  if(!all.length||all.length>100||w*h>2_560_000||walls.length!==w*h||all.some(r=>![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0||r.x<0||r.y<0||r.x+r.width>sw+1||r.y+r.height>sh+1))throw new Error('Invalid floor coverage.');
  const axis=(values:number[])=>[...new Set(values.map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b);
  const xs=axis([-1,sw+1,...all.flatMap(r=>[r.x,r.x+r.width])]),ys=axis([-1,sh+1,...all.flatMap(r=>[r.y,r.y+r.height])]);
  const nx=xs.length-1,ny=ys.length-1,seen=new Uint8Array(nx*ny),regions:PixelRect[][]=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(all.some(r=>inside(r,(xs[i]+xs[i+1])/2,(ys[j]+ys[j+1])/2)))seen[j*nx+i]=1;
  for(let seed=0;seed<seen.length;seed++){
    if(seen[seed])continue;const queue=[seed],cells:PixelRect[]=[];seen[seed]=1;let exterior=false;
    for(let head=0;head<queue.length;head++){
      const p=queue[head],x=p%nx,y=Math.floor(p/nx);if(!x||!y||x===nx-1||y===ny-1)exterior=true;
      cells.push({x:xs[x],y:ys[y],width:xs[x+1]-xs[x],height:ys[y+1]-ys[y]});
      for(const q of [x?p-1:-1,x<nx-1?p+1:-1,y?p-nx:-1,y<ny-1?p+nx:-1])if(q>=0&&!seen[q]){seen[q]=1;queue.push(q);}
    }
    if(!exterior)regions.push(mergePixelRects(cells));
  }
  const length=Math.hypot(door.bx-door.ax,door.by-door.ay),cx=(door.ax+door.bx)/2,cy=(door.ay+door.by)/2;
  const pairArea=[...input.room,...input.hall].reduce((n,r)=>n+r.width*r.height,0);
  const touches=(a:PixelRect,b:PixelRect)=>((Math.abs(a.x+a.width-b.x)<.01||Math.abs(b.x+b.width-a.x)<.01)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+2)||((Math.abs(a.y+a.height-b.y)<.01||Math.abs(b.y+b.height-a.y)<.01)&&Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+2);
  return regions.filter(parts=>{
    const area=parts.reduce((n,r)=>n+r.width*r.height,0);
    if(parts.length>12||area<16||area>pairArea*.2||!parts.some(r=>input.room.some(p=>touches(r,p)))||!parts.some(r=>input.hall.some(p=>touches(r,p))))return false;
    if(!parts.some(r=>Math.hypot(Math.max(r.x-cx,0,cx-r.x-r.width),Math.max(r.y-cy,0,cy-r.y-r.height))<length*3))return false;
    let count=0,ink=0;for(const r of parts)for(let y=Math.max(0,Math.ceil(r.y*h/sh));y<Math.min(h,Math.floor((r.y+r.height)*h/sh));y++)for(let x=Math.max(0,Math.ceil(r.x*w/sw));x<Math.min(w,Math.floor((r.x+r.width)*w/sw));x++){count++;if(walls[y*w+x])ink++;}
    return count>8&&ink/count<.2;
  }).slice(0,6).map((rects,i)=>({id:`region-${i+1}`,rects,added:true}));
}

export function traceMissingFloor(input:MissingFloorInput):{regions:FloorRegion[]}{
  const missing=missingFloorRegions(input);if(!missing.length)throw new Error('No enclosed missing floor connects this room and hall. Adjust the nearby edges or trace the area manually.');
  const result=repairDoorBoundary({...input,hall:[...input.hall,...missing.flatMap(r=>r.rects)]});
  const snap=(v:number,axis:'x'|'y')=>{const edges=input.all.flatMap(r=>axis==='x'?[r.x,r.x+r.width]:[r.y,r.y+r.height]);return edges.find(e=>Math.abs(e-v)<.002)??v;};
  result.transferred=result.transferred.map(r=>{const x=snap(r.x,'x'),y=snap(r.y,'y');return {x,y,width:snap(r.x+r.width,'x')-x,height:snap(r.y+r.height,'y')-y};});
  // Keep only candidate portions reached from the receiving room after closing the confirmed door.
  const intersection=(a:PixelRect,b:PixelRect):PixelRect|undefined=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),width=Math.min(a.x+a.width,b.x+b.width)-x,height=Math.min(a.y+a.height,b.y+b.height)-y;return width>.01&&height>.01?{x,y,width,height}:undefined;};
  const regions=missing.map(r=>({...r,rects:mergePixelRects(r.rects.flatMap(a=>result.transferred.flatMap(b=>{const c=intersection(a,b);return c?[c]:[];})))})).filter(r=>r.rects.length);
  const transferred=mergePixelRects(input.hall.flatMap(a=>result.transferred.flatMap(b=>{const c=intersection(a,b);return c?[c]:[];})));
  if(!regions.length)throw new Error('The missing area is not connected to the selected room in the source drawing.');
  if(transferred.length)regions.push({id:'region-transfer',rects:transferred,added:false});
  if(regions.flatMap(r=>r.rects).length>30)throw new Error('The candidate floor is too fragmented. Trace it manually.');
  return {regions};
}
