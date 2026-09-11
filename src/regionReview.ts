import type {PlanReference} from './blueprintImport';
import type {FloorRegion} from './missingFloorGeometry';
import type {PixelRect} from './doorBoundaryGeometry';
import type {Span} from './openingReviewContract';
import {validateRegionAnswer,validateRegionRequest,type RegionAnswer} from './regionReviewContract';
const reviews=new Map<string,RegionAnswer>();
export async function inspectRegions(ref:PlanReference,regions:FloorRegion[],context:PixelRect[],door:Span,room:string,hall:string,signal:AbortSignal):Promise<RegionAnswer>{
  const bounds=[...context,...regions.flatMap(r=>r.rects)];
  const x=Math.max(0,Math.floor(Math.min(...bounds.map(r=>r.x),door.ax,door.bx)-30)),y=Math.max(0,Math.floor(Math.min(...bounds.map(r=>r.y),door.ay,door.by)-30));
  const width=Math.min(ref.width,Math.ceil(Math.max(...bounds.map(r=>r.x+r.width),door.ax,door.bx)+30))-x,height=Math.min(ref.height,Math.ceil(Math.max(...bounds.map(r=>r.y+r.height),door.ay,door.by)+30))-y;
  const bitmap=await createImageBitmap(await(await fetch(ref.url,{signal})).blob());let image:string,annotated:string;
  try{signal.throwIfAborted();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,x,y,width,height,0,0,width,height);image=canvas.toDataURL('image/jpeg',.94);
    regions.forEach((region,i)=>{ctx.fillStyle=region.added?'#efa922':'#16898b';ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2;for(const r of region.rects){ctx.globalAlpha=.22;ctx.fillRect(r.x-x,r.y-y,r.width,r.height);ctx.globalAlpha=1;ctx.strokeRect(r.x-x,r.y-y,r.width,r.height);}const r=region.rects.reduce((a,b)=>a.width*a.height>b.width*b.height?a:b),cx=r.x+r.width/2-x,cy=r.y+r.height/2-y;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),cx,cy);});
    ctx.strokeStyle='#d000b5';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(door.ax-x,door.ay-y);ctx.lineTo(door.bx-x,door.by-y);ctx.stroke();annotated=canvas.toDataURL('image/jpeg',.94);
  }finally{bitmap.close();}
  const review=validateRegionRequest({version:'region-review-v1',room:room.slice(0,100),hall:hall.slice(0,100),door:{ax:door.ax-x,ay:door.ay-y,bx:door.bx-x,by:door.by-y},regions:regions.map(r=>({...r,rects:r.rects.map(p=>({...p,x:p.x-x,y:p.y-y}))})),annotated},width,height);
  const body=JSON.stringify({image,width,height,regionReview:review}),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  signal.throwIfAborted();const cached=reviews.get(hash);if(cached)return cached;
  const response=await fetch('/api/floor-plan/recognize',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal,body});const value=await response.json();if(!response.ok||value?.error)throw new Error(value?.error??'Could not inspect these regions.');signal.throwIfAborted();const result=validateRegionAnswer(value,regions);if(reviews.size>=40)reviews.delete(reviews.keys().next().value!);reviews.set(hash,result);return result;
}
