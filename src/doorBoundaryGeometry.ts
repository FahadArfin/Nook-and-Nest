import type {Span} from './openingReviewContract';
import type {WallCandidate} from './recognitionEvidence';
export interface PixelRect {x:number;y:number;width:number;height:number}
export interface BoundaryInput {width:number;height:number;sourceWidth:number;sourceHeight:number;walls:Uint8Array;lines:WallCandidate[];room:PixelRect[];hall:PixelRect[];door:Span}
export interface BoundaryResult {transferred:PixelRect[];pixels:number;roomSeed:{x:number;y:number};hallSeed:{x:number;y:number}}
const inside=(r:PixelRect,x:number,y:number)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;

/** Local ownership repair. The selected pair's union bounds growth; no exterior floor is invented. */
export function repairDoorBoundary(input:BoundaryInput):BoundaryResult {
  const {width:w,height:h,sourceWidth:sw,sourceHeight:sh,walls,lines,room,hall,door}=input,n=w*h;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||n>2_560_000||walls.length!==n||!room.length||!hall.length||room.length+hall.length>100||lines.length>160||![sw,sh].every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid boundary evidence.');
  const rects=[...room,...hall];
  if(rects.some(r=>![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0||r.x<0||r.y<0||r.x+r.width>sw+1||r.y+r.height>sh+1))throw new Error('Keep both room areas inside the reference before repairing.');
  const length=Math.hypot(door.bx-door.ax,door.by-door.ay);
  if(![door.ax,door.ay,door.bx,door.by].every(Number.isFinite)||length<8||length>Math.max(sw,sh)*.2||(door.ax!==door.bx&&door.ay!==door.by))throw new Error('Choose a straight closed doorway span.');
  const sx=sw/w,sy=sh/h,horizontal=door.ay===door.by,line=horizontal?door.ay:door.ax;
  const start=Math.min(horizontal?door.ax:door.ay,horizontal?door.bx:door.by),end=start+length;
  const inkAt=(x:number,y:number)=>{const ix=Math.round(x/sx),iy=Math.round(y/sy);return ix>=0&&iy>=0&&ix<w&&iy<h&&walls[iy*w+ix];};
  const jamb=(x:number,y:number)=>{for(let dy=-10;dy<=10;dy+=2)for(let dx=-10;dx<=10;dx+=2)if(inkAt(x+dx,y+dy))return true;return false;};
  if(!jamb(door.ax,door.ay)||!jamb(door.bx,door.by))throw new Error('Both doorway ends must meet source walls. Adjust the span to the jambs.');
  let solid=0;for(let i=2;i<9;i++)solid+=Number(inkAt(door.ax+(door.bx-door.ax)*i/10,door.ay+(door.by-door.ay)*i/10));
  if(solid>3)throw new Error('This span crosses solid source ink. Check the closed doorway orientation.');
  const free=new Uint8Array(n),labels=new Uint8Array(n),queue=new Int32Array(n);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const px=(x+.5)*sx,py=(y+.5)*sy,p=y*w+x;
    const closure=Math.abs((horizontal?py:px)-line)<=Math.max(3,sx,sy)&&((horizontal?px:py)>=start-10&&(horizontal?px:py)<=end+10);
    if(!walls[p]&&!closure&&rects.some(r=>inside(r,px,py)))free[p]=1;
  }
  const seed=(parts:PixelRect[])=>{
    const r=parts.reduce((a,b)=>a.width*a.height>b.width*b.height?a:b),cx=(r.x+r.width/2)/sx,cy=(r.y+r.height/2)/sy;
    for(let radius=0;radius<=25;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;const x=Math.floor(cx)+dx,y=Math.floor(cy)+dy;
      if(x>=0&&y>=0&&x<w&&y<h&&free[y*w+x]&&parts.some(r=>inside(r,(x+.5)*sx,(y+.5)*sy)))return y*w+x;
    }throw new Error('Could not find clear floor inside a selected room. Check the room selection.');
  };
  const a=seed(room),b=seed(hall);
  const flood=(p:number,id:number)=>{let head=0,tail=1;queue[0]=p;labels[p]=id;while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);for(const next of [x?q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1])if(next>=0&&free[next]&&!labels[next]){labels[next]=id;queue[tail++]=next;}}};
  flood(a,1);if(labels[b])throw new Error('The two rooms still connect around this doorway. Correct missing wall spans or choose a different doorway; no repair was applied.');flood(b,2);
  // Orthogonal cells use existing measured edges and source wall centerlines, not a stair-stepped pixel outline.
  const xs=rects.flatMap(r=>[r.x,r.x+r.width]),ys=rects.flatMap(r=>[r.y,r.y+r.height]);
  for(const [values,points] of [[xs,[door.ax,door.bx]],[ys,[door.ay,door.by]]])for(const value of points)if(!values.some(v=>Math.abs(v-value)<4))values.push(value);
  // Keep measured/shared edges authoritative when a thick stroke's center differs slightly.
  for(const l of lines){const list=l.axis==='v'?xs:ys,value=l.axis==='v'?l.x+l.width/2:l.y+l.height/2;if(!list.some(v=>Math.abs(v-value)<4))list.push(value);}
  const axis=(values:number[],max:number)=>[...new Set(values.filter(v=>v>=0&&v<=max).map(v=>Math.round(v*1000)/1000))].sort((a,b)=>a-b);
  const xx=axis(xs,sw),yy=axis(ys,sh),cells:PixelRect[]=[];
  for(let j=0;j<yy.length-1;j++)for(let i=0;i<xx.length-1;i++){
    const x=xx[i],y=yy[j],width=xx[i+1]-x,height=yy[j+1]-y,cx=x+width/2,cy=y+height/2;
    if(!hall.some(r=>inside(r,cx,cy))||room.some(r=>inside(r,cx,cy)))continue;
    let roomVotes=0,hallVotes=0;
    for(let py=Math.max(0,Math.ceil(y/sy));py<Math.min(h,Math.floor((y+height)/sy));py++)for(let px=Math.max(0,Math.ceil(x/sx));px<Math.min(w,Math.floor((x+width)/sx));px++){const label=labels[py*w+px];if(label===1)roomVotes++;if(label===2)hallVotes++;}
    if(roomVotes>=2&&hallVotes===0)cells.push({x,y,width,height});
  }
  const transferred=mergePixelRects(cells),pixels=transferred.reduce((a,r)=>a+r.width*r.height,0),hallArea=hall.reduce((a,r)=>a+r.width*r.height,0);
  if(pixels<length*length*.04)throw new Error('No connected entry recess was found. Check the room/hall pair and draw any missing floor between the recess and room first.');
  if(pixels>hallArea*.55)throw new Error('This would move most of the selected hall. Check the room pair and doorway before trying again.');
  if(transferred.length>30)throw new Error('The source boundary is too fragmented for a reliable local repair. Correct the surrounding walls first.');
  return {transferred,pixels,roomSeed:{x:(a%w+.5)*sx,y:(Math.floor(a/w)+.5)*sy},hallSeed:{x:(b%w+.5)*sx,y:(Math.floor(b/w)+.5)*sy}};
}
export function mergePixelRects(rects:PixelRect[]):PixelRect[]{
  let result=rects.map(r=>({...r}));
  for(const horizontal of [true,false]){
    const groups=new Map<string,PixelRect[]>();for(const r of result){const k=horizontal?`${r.y}:${r.height}`:`${r.x}:${r.width}`,g=groups.get(k)??[];g.push(r);groups.set(k,g);}result=[];
    for(const group of groups.values()){group.sort((a,b)=>horizontal?a.x-b.x:a.y-b.y);let last:PixelRect|undefined;for(const r of group){if(last&&Math.abs(horizontal?last.x+last.width-r.x:last.y+last.height-r.y)<.001){if(horizontal)last.width=r.x+r.width-last.x;else last.height=r.y+r.height-last.y;}else{last={...r};result.push(last);}}}
  }return result;
}
