import type {Recognition,ScanRoom} from './recognitionContract';
import type {WallCandidate} from './recognitionEvidence';

/** Find bounded unassigned pockets. They remain unnamed review regions, never
 * silently become part of a bedroom/hall. Source strokes are barriers only. */
export function addUnassignedRegions(input:Recognition,width:number,height:number,walls:WallCandidate[]):Recognition {
  // A connected-stroke bounding box can span an L junction and contain empty
  // floor. Never treat those broad boxes as solid walls. Verified model spans
  // provide zero-area barriers across those junctions instead.
  walls=walls.filter(w=>w.solid||(w.axis==='h'?w.height:w.width)<=Math.max(12,Math.max(width,height)*.012));
  const spans=input.walls??[];
  const xs=[0,width,...input.rooms.flatMap(r=>[r.x,r.x+r.width]),...walls.flatMap(w=>[w.x,w.x+w.width]),...spans.flatMap(w=>[w.ax,w.bx])];
  const ys=[0,height,...input.rooms.flatMap(r=>[r.y,r.y+r.height]),...walls.flatMap(w=>[w.y,w.y+w.height]),...spans.flatMap(w=>[w.ay,w.by])];
  const unique=(a:number[])=>[...new Set(a.map(n=>Math.max(0,Math.round(n*1000)/1000)))].sort((a,b)=>a-b);
  const x=unique(xs),y=unique(ys),nx=x.length-1,ny=y.length-1;
  if(nx*ny>80000)return {...input,warnings:[...input.warnings,'Review uncovered floor manually: region search exceeded its safe size.'].slice(0,30)};
  const state=new Uint8Array(nx*ny),inside=(px:number,py:number,r:{x:number;y:number;width:number;height:number})=>px>r.x&&px<r.x+r.width&&py>r.y&&py<r.y+r.height;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const px=(x[i]+x[i+1])/2,py=(y[j]+y[j+1])/2;state[j*nx+i]=input.rooms.some(r=>inside(px,py,r))?1:walls.some(w=>inside(px,py,w))?2:0;}
  const neighbors=(k:number)=>{const i=k%nx,j=Math.floor(k/nx);return [i? k-1:-1,i<nx-1?k+1:-1,j?k-nx:-1,j<ny-1?k+nx:-1].filter(n=>n>=0);};
  const blocked=(a:number,b:number)=>{const ai=a%nx,aj=Math.floor(a/nx),bi=b%nx,bj=Math.floor(b/nx);return spans.some(w=>ai!==bi?w.ax===w.bx&&Math.abs(w.ax-x[Math.max(ai,bi)])<.001&&Math.min(w.ay,w.by)<=y[aj]&&Math.max(w.ay,w.by)>=y[aj+1]:w.ay===w.by&&Math.abs(w.ay-y[Math.max(aj,bj)])<.001&&Math.min(w.ax,w.bx)<=x[ai]&&Math.max(w.ax,w.bx)>=x[ai+1]);};
  const flood=(start:number)=>{const queue=[start];state[start]=3;for(let n=0;n<queue.length;n++)for(const k of neighbors(queue[n]))if(!state[k]&&!blocked(queue[n],k)){state[k]=3;queue.push(k);}return queue;};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if((i===0||j===0||i===nx-1||j===ny-1)&&!state[j*nx+i])flood(j*nx+i);
  const additions:ScanRoom[]=[];let regions=0;
  for(let k=0;k<state.length;k++)if(!state[k]){
    const cells=flood(k),rects=cells.map(n=>{const i=n%nx,j=Math.floor(n/nx);return {x:x[i],z:y[j],width:x[i+1]-x[i],depth:y[j+1]-y[j]};});
    const area=rects.reduce((a,r)=>a+r.width*r.depth,0);
    const rows=new Map<number,number[]>();for(const n of cells){const j=Math.floor(n/nx);rows.set(j,[...rows.get(j)??[],n%nx]);}
    const parts:{x:number;z:number;width:number;depth:number}[]=[],active=new Map<string,typeof parts[number]>();
    for(const [j,indices] of [...rows].sort((a,b)=>a[0]-b[0])){
      indices.sort((a,b)=>a-b);for(let a=0;a<indices.length;){let b=a;while(b+1<indices.length&&indices[b+1]===indices[b]+1)b++;
        const left=x[indices[a]],right=x[indices[b]+1],key=`${left}:${right}`,prior=active.get(key);
        if(prior&&Math.abs(prior.z+prior.depth-y[j])<.001)prior.depth=y[j+1]-prior.z;
        else {const p={x:left,z:y[j],width:right-left,depth:y[j+1]-y[j]};parts.push(p);active.set(key,p);}a=b+1;
      }
    }
    // Reject wall-width slivers, isolated ink enclosures and large exterior-like
    // candidates. Keep source image review mandatory for every proposed pocket.
    const broad=parts.some(r=>r.width>=20&&r.depth>=20);
    const touches=new Set<number>();for(const n of cells)for(const v of neighbors(n))if(state[v]===1){const i=v%nx,j=Math.floor(v/nx);input.rooms.forEach((r,index)=>{if(inside((x[i]+x[i+1])/2,(y[j]+y[j+1])/2,r))touches.add(index);});}
    if(!broad||area<225||area>width*height*.08||touches.size<2||parts.length>16||additions.length+input.rooms.length+parts.length>100)continue;
    regions++;for(const p of parts)if(p.width>=1&&p.depth>=1)additions.push({roomId:`unassigned-${regions}`,name:`Unassigned region ${regions}`,kind:'Hall',x:p.x,y:p.z,width:p.width,height:p.depth,enclosed:false,note:'Bounded uncovered pocket found between detected regions and source wall strokes. Check the image, then combine or delete; room ownership is unverified.'});
  }
  return {...input,rooms:[...input.rooms,...additions],warnings:[...(regions?[`${regions} unassigned floor pockets were proposed from wall evidence. Verify them against the image before combining or creating 3D.`]:[]),...input.warnings].slice(0,30)};
}
