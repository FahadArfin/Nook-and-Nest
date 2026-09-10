import type {WallCandidate} from './recognitionEvidence';
import type {OpeningChoice,Span} from './openingReviewContract';

/** Gaps between collinear ink runs are hypotheses, never inferred physical walls. */
export function gapCandidates(walls:WallCandidate[],width:number,height:number):Span[] {
  const gaps:Span[]=[],short=Math.max(width,height)*.008,long=Math.max(width,height)*.10;
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j];if(a.axis!==b.axis)continue;
    const h=a.axis==='h',lineA=h?a.y+a.height/2:a.x+a.width/2,lineB=h?b.y+b.height/2:b.x+b.width/2;
    if(Math.abs(lineA-lineB)>Math.max(3,Math.min(h?a.height:a.width,h?b.height:b.width)/2))continue;
    const [first,last]=(h?a.x<b.x:a.y<b.y)?[a,b]:[b,a],start=h?first.x+first.width:first.y+first.height,end=h?last.x:last.y,gap=end-start;
    if(gap<short||gap>long)continue;
    const line=(lineA+lineB)/2,s=h?{ax:start,ay:line,bx:end,by:line}:{ax:line,ay:start,bx:line,by:end};
    if(!gaps.some(g=>Math.hypot(g.ax-s.ax,g.ay-s.ay)+Math.hypot(g.bx-s.bx,g.by-s.by)<12))gaps.push(s);
  }
  return gaps.sort((a,b)=>a.ay-b.ay||a.ax-b.ax).slice(0,60);
}
export function spanChoices(span:Span,width:number,height:number):OpeningChoice[] {
  const {ax,ay,bx,by}=span,dx=bx-ax,dy=by-ay;
  const candidates=[span,{ax,ay,bx:ax-dy,by:ay+dx},{ax,ay,bx:ax+dy,by:ay-dx},{ax:bx-dy,ay:by+dx,bx,by},{ax:bx+dy,ay:by-dx,bx,by}];
  return candidates.filter(s=>Math.min(s.ax,s.bx)>=0&&Math.max(s.ax,s.bx)<=width&&Math.min(s.ay,s.by)>=0&&Math.max(s.ay,s.by)<=height).map((s,i)=>({...s,id:`span-${i}`}));
}
/** Four-connected exterior flood, bounded by the image rather than arbitrary closing. */
export function exteriorMask(mask:Uint8ClampedArray,width:number,height:number):Uint8Array {
  if(width*height>2_560_000||width<1||height<1||mask.length!==width*height*4)throw new Error('Invalid enclosure image.');
  const outside=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
  const add=(p:number)=>{if(!outside[p]&&mask[p*4]>128){outside[p]=1;queue[tail++]=p;}};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);if(x)add(p-1);if(x<width-1)add(p+1);if(y)add(p-width);if(y<height-1)add(p+width);}
  return outside;
}
