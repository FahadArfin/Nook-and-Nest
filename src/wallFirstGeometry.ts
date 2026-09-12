import type {WallCandidate} from './recognitionEvidence';
import type {BlueprintDraft,BlueprintRoom} from './blueprint';
import type {WallSegment} from './types';
import {unionRects,type FloorRect} from './floorGeometry';

export function topFrameHints(pixels:Uint8ClampedArray,width:number,height:number,walls:WallCandidate[],sourceWidth=width,sourceHeight=height):WallCandidate[]{
  if(!walls.length)return [];
  const top=Math.min(...walls.map(w=>w.y))*height/sourceHeight,left=Math.min(...walls.map(w=>w.x))*width/sourceWidth,right=Math.max(...walls.map(w=>w.x+w.width))*width/sourceWidth;
  const hints:WallCandidate[]=[];
  for(let y=Math.max(0,Math.floor(top-height*.07));y<top;y++)for(let x=Math.max(0,Math.floor(left));x<Math.min(width,right);){const start=x;while(x<Math.min(width,right)){const i=(y*width+x)*4;if(pixels[i+3]<128||pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114>=150)break;x++;}if(x-start>width*.15)hints.push({axis:'h',x:start*sourceWidth/width,y:y*sourceHeight/height,width:(x-start)*sourceWidth/width,height:sourceHeight/height});x++;}
  return hints.slice(0,160);
}

/** Local proposals only. No room labels, dimensions, or ownership are inferred. */
export function wallFirstProposal(candidates:WallCandidate[],width:number,height:number):BlueprintDraft {
  const step=Math.max(2,Math.round(Math.max(width,height)/400));
  const snap=(n:number)=>Math.round(n/step)*step;
  const ink=candidates.filter(w=>Math.max(w.width,w.height)>=Math.max(width,height)*.04);
  if(ink.length<3)throw new Error('Not enough clear wall lines. Use manual tracing for this image.');
  // Bridge collinear interruptions for the OUTLINE only (windows and entry doors).
  // Physical wall proposals below retain the actual gaps.
  const outline=ink.map(w=>({...w}));
  const edges:{x:number;top:number;bottom:number}[]=[];
  for(const w of ink.filter(w=>w.axis==='h'))for(const x of [w.x,w.x+w.width]){const old=edges.find(e=>Math.abs(e.x-x)<step*3);if(old){old.top=Math.min(old.top,w.y);old.bottom=Math.max(old.bottom,w.y+w.height);}else edges.push({x,top:w.y,bottom:w.y+w.height});}
  for(const e of edges)if(e.bottom-e.top>height*.15)outline.push({axis:'v',x:e.x-step/2,y:e.top,width:step,height:e.bottom-e.top});
  for(const axis of ['h','v'] as const){const lines:{cross:number;start:number;end:number;lo:number;hi:number}[]=[];
    for(const w of ink.filter(w=>w.axis===axis)){const h=axis==='h',cross=h?w.y+w.height/2:w.x+w.width/2,start=h?w.x:w.y,end=start+(h?w.width:w.height),lo=h?w.y:w.x,hi=lo+(h?w.height:w.width);const old=lines.find(l=>Math.abs(l.cross-cross)<Math.max(width,height)*.022);if(old){old.start=Math.min(old.start,start);old.end=Math.max(old.end,end);old.lo=Math.min(old.lo,lo);old.hi=Math.max(old.hi,hi);}else lines.push({cross,start,end,lo,hi});}
    for(const l of lines)outline.push(axis==='h'?{axis,x:l.start,y:l.lo,width:l.end-l.start,height:l.hi-l.lo}:{axis,x:l.lo,y:l.start,width:l.hi-l.lo,height:l.end-l.start});
  }
  const ys=[...new Set(outline.flatMap(w=>[snap(w.y),snap(w.y+w.height)]))].sort((a,b)=>a-b);
  const bands:FloorRect[]=[];
  for(let i=0;i<ys.length-1;i++){
    const z=ys[i],depth=ys[i+1]-z,mid=z+depth/2,active=outline.filter(w=>w.y-step/2<=mid&&w.y+w.height+step/2>=mid);
    if(!active.length||!depth)continue;
    const x=snap(Math.min(...active.map(w=>w.x))),right=snap(Math.max(...active.map(w=>w.x+w.width)));
    if(right-x<width*.12)continue;
    bands.push({x,z,width:right-x,depth});
  }
  // Ignore short offset noise at thick junctions, retaining substantial steps.
  for(let i=1;i<bands.length;i++)if(bands[i].z===bands[i-1].z+bands[i-1].depth&&Math.abs(bands[i].x-bands[i-1].x)<=step*3&&Math.abs(bands[i].x+bands[i].width-bands[i-1].x-bands[i-1].width)<=step*3){bands[i].x=bands[i-1].x;bands[i].width=bands[i-1].width;}
  const footprint=compactRects(bands);
  if(!footprint.length||footprint.length>100)throw new Error('The outline is too fragmented. Use manual tracing for this image.');
  const tolerance=Math.max(step*2,Math.max(width,height)*.019);
  const lines:{h:boolean;line:number;start:number;end:number;weight:number}[]=[];
  for(const w of ink){
    const h=w.axis==='h';if((h?w.width:w.height)<(h?w.height:w.width)*2.5)continue;
    const line=h?w.y+w.height/2:w.x+w.width/2,start=h?w.x:w.y,end=start+(h?w.width:w.height);
    const old=lines.find(l=>l.h===h&&Math.abs(l.line-line)<=tolerance&&Math.min(l.end,end)>=Math.max(l.start,start)-step);
    if(old){old.line=(old.line*old.weight+line*(end-start))/(old.weight+end-start);old.weight+=end-start;old.start=Math.min(old.start,start);old.end=Math.max(old.end,end);}else lines.push({h,line,start,end,weight:end-start});
  }
  for(let i=0;i<lines.length;i++)for(let j=lines.length-1;j>i;j--){const a=lines[i],b=lines[j];if(a.h===b.h&&Math.abs(a.line-b.line)<=tolerance*1.3&&Math.min(a.end,b.end)>Math.max(a.start,b.start)){a.line=(a.line*a.weight+b.line*b.weight)/(a.weight+b.weight);a.weight+=b.weight;a.start=Math.min(a.start,b.start);a.end=Math.max(a.end,b.end);lines.splice(j,1);}}
  const inside=(x:number,z:number)=>footprint.some(r=>x>r.x&&x<r.x+r.width&&z>r.z&&z<r.z+r.depth);
  const walls=lines.filter(l=>{
    const mid=(l.start+l.end)/2;
    return l.h?inside(mid,l.line-tolerance*1.5)&&inside(mid,l.line+tolerance*1.5):inside(l.line-tolerance*1.5,mid)&&inside(l.line+tolerance*1.5,mid);
  }).map((l,i)=>({id:`wall-first:${i}`,ax:snap(l.h?l.start:l.line),az:snap(l.h?l.line:l.start),bx:snap(l.h?l.end:l.line),bz:snap(l.h?l.line:l.end)} as WallSegment));
  // Join nearby actual junctions. Door-size gaps remain open for human review.
  for(const w of walls)for(const end of ['a','b'] as const){const x=w[`${end}x`],z=w[`${end}z`];for(const other of walls){if(w===other||(w.az===w.bz)===(other.az===other.bz))continue;const h=w.az===w.bz,cross=h?other.ax:other.az,along=h?x:z,lo=Math.min(h?other.az:other.ax,h?other.bz:other.bx),hi=Math.max(h?other.az:other.ax,h?other.bz:other.bx);if(Math.abs(cross-along)<=tolerance*2&&(h?z:x)>=lo-tolerance&&(h?z:x)<=hi+tolerance){if(h)w[end==='a'?'ax':'bx']=cross;else w[end==='a'?'az':'bz']=cross;}}}
  for(const w of walls)for(const end of ['a','b'] as const){const h=w.az===w.bz,key=h?(end==='a'?'ax':'bx'):(end==='a'?'az':'bz'),cross=h?w.az:w.ax;
    const edges=footprint.flatMap(r=>h?[r.x,r.x+r.width]:[r.z,r.z+r.depth]).filter(n=>h?inside(n-1,cross)!==inside(n+1,cross):inside(cross,n-1)!==inside(cross,n+1));edges.sort((a,b)=>Math.abs(a-w[key])-Math.abs(b-w[key]));if(edges.length&&Math.abs(edges[0]-w[key])<=tolerance*2)w[key]=edges[0];
  }
  return {rooms:footprint.map((r,i)=>({...r,id:`footprint:${i}`,groupId:'footprint',name:'Home footprint',kind:'Hall',enclosed:false})),walls,omittedWalls:[],fixtures:[],wallFirst:true,regionDividers:[]};
}

export function compactRects(rects:FloorRect[]):FloorRect[]{
  const rows=new Map<string,FloorRect[]>();
  for(const r of rects){const key=`${r.z}:${r.depth}`,list=rows.get(key)??[];list.push({...r});rows.set(key,list);}
  const horizontal:FloorRect[]=[];
  for(const row of rows.values()){row.sort((a,b)=>a.x-b.x);let previous:FloorRect|undefined;for(const r of row){if(previous&&Math.abs(previous.x+previous.width-r.x)<.001)previous.width+=r.width;else {horizontal.push(r);previous=r;}}}
  const result:FloorRect[]=[],active=new Map<string,FloorRect>();
  for(const r of horizontal.sort((a,b)=>a.z-b.z||a.x-b.x)){const key=`${r.x}:${r.width}`,old=active.get(key);if(old&&Math.abs(old.z+old.depth-r.z)<.001)old.depth+=r.depth;else {result.push(r);active.set(key,r);}}
  return result;
}

/** Exact coordinate subdivision: every bit of the footprint belongs to a region. */
export function regionsFromWalls(draft:BlueprintDraft,grid:number,physicalWalls:WallSegment[]):BlueprintDraft {
  if(!draft.rooms.length)throw new Error('Add a footprint first.');
  const footprint=unionRects(draft.rooms);let segments=[...physicalWalls,...draft.regionDividers??[]].map(w=>({ax:w.ax*grid,az:w.az*grid,bx:w.bx*grid,bz:w.bz*grid}));
  if(segments.some(w=>![w.ax,w.az,w.bx,w.bz].every(Number.isFinite)||(w.ax!==w.bx&&w.az!==w.bz)))throw new Error('Use horizontal or vertical boundaries.');
  // Boundary rendering quantizes grid coordinates. Canonicalize sub-millimetre
  // roundoff to the original footprint, never to a new floor-area approximation.
  const xc=[...new Set(footprint.flatMap(r=>[r.x,r.x+r.width]))],zc=[...new Set(footprint.flatMap(r=>[r.z,r.z+r.depth]))];
  const canonical=(n:number,values:number[])=>{const match=values.find(v=>Math.abs(v-n)<.05);if(match!==undefined)return match;values.push(n);return n;};
  segments=segments.map(w=>({ax:canonical(w.ax,xc),az:canonical(w.az,zc),bx:canonical(w.bx,xc),bz:canonical(w.bz,zc)}));
  const xs=[...new Set([...footprint.flatMap(r=>[r.x,r.x+r.width]),...segments.flatMap(w=>[w.ax,w.bx])])].sort((a,b)=>a-b);
  const zs=[...new Set([...footprint.flatMap(r=>[r.z,r.z+r.depth]),...segments.flatMap(w=>[w.az,w.bz])])].sort((a,b)=>a-b);
  const columns=xs.length-1,rows=zs.length-1;
  if(columns*rows>100000)throw new Error('Too many boundaries. Remove duplicate or unnecessary segments.');
  const cells=new Int32Array(columns*rows).fill(-1);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const cx=(xs[x]+xs[x+1])/2,cz=(zs[y]+zs[y+1])/2;if(footprint.some(r=>cx>r.x&&cx<r.x+r.width&&cz>r.z&&cz<r.z+r.depth))cells[y*columns+x]=0;}
  const blocked=(x:number,y:number,nx:number,ny:number)=>{const vertical=x!==nx,line=vertical?xs[Math.max(x,nx)]:zs[Math.max(y,ny)],mid=vertical?(zs[y]+zs[y+1])/2:(xs[x]+xs[x+1])/2;return segments.some(w=>vertical?w.ax===w.bx&&Math.abs(w.ax-line)<.001&&mid>Math.min(w.az,w.bz)&&mid<Math.max(w.az,w.bz):w.az===w.bz&&Math.abs(w.az-line)<.001&&mid>Math.min(w.ax,w.bx)&&mid<Math.max(w.ax,w.bx));};
  let count=0;const queue=new Int32Array(cells.length);
  for(let p=0;p<cells.length;p++)if(cells[p]===0){count++;let head=0,tail=1;queue[0]=p;cells[p]=count;while(head<tail){const q=queue[head++],x=q%columns,y=Math.floor(q/columns);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=columns||ny>=rows)continue;const n=ny*columns+nx;if(cells[n]===0&&!blocked(x,y,nx,ny)){cells[n]=count;queue[tail++]=n;}}}}
  const rooms:BlueprintRoom[]=[];
  for(let group=1;group<=count;group++){const pieces:FloorRect[]=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;){if(cells[y*columns+x]!==group){x++;continue;}const start=x;while(x<columns&&cells[y*columns+x]===group)x++;pieces.push({x:xs[start],z:zs[y],width:xs[x]-xs[start],depth:zs[y+1]-zs[y]});}for(const r of compactRects(pieces)){if(r.width<10||r.depth<10)throw new Error('Boundaries create a strip smaller than 10 mm. Align or remove the nearby duplicate lines.');rooms.push({...r,id:`region:${group}:${rooms.length}`,groupId:`region:${group}`,name:`Region ${group}`,kind:'Hall',enclosed:false});}}
  if(rooms.length>100)throw new Error('These boundaries create too many polygon parts. Remove small or duplicate partitions.');
  return {...draft,rooms};
}

export function scaleWallFirst(draft:BlueprintDraft,ratio:number):BlueprintDraft {
  const wall=(w:WallSegment)=>({...w,ax:w.ax*ratio,az:w.az*ratio,bx:w.bx*ratio,bz:w.bz*ratio});
  return {...draft,rooms:draft.rooms.map(r=>({...r,x:r.x*ratio,z:r.z*ratio,width:r.width*ratio,depth:r.depth*ratio})),walls:draft.walls.map(wall),wallCuts:draft.wallCuts?.map(wall),regionDividers:draft.regionDividers?.map(wall),fixtures:draft.fixtures.map(f=>({...f,x:f.x*ratio,z:f.z*ratio}))};
}
