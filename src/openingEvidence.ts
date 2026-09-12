import type {PlanReference} from './blueprintImport';
import {OPENING_REVIEW_VERSION,validateOpeningAnswer,type OpeningAnswer,type OpeningChoice,type Span} from './openingReviewContract';
export interface OpeningEvidence {outside:Uint8Array;width:number;height:number;gaps:Span[];walls:Uint8Array;lines:import('./recognitionEvidence').WallCandidate[]}
export async function prepareOpeningEvidence(ref:PlanReference,signal:AbortSignal):Promise<OpeningEvidence> {
  const image=await createImageBitmap(await(await fetch(ref.url,{signal})).blob());
  try{
    signal.throwIfAborted();const scale=Math.min(1,1600/Math.max(ref.width,ref.height)),canvas=document.createElement('canvas');canvas.width=Math.round(ref.width*scale);canvas.height=Math.round(ref.height*scale);
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    return await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./openingEvidence.worker.ts',import.meta.url),{type:'module'});
      const finish=()=>{worker.terminate();signal.removeEventListener('abort',abort);},abort=()=>{finish();reject(new DOMException('Review canceled.','AbortError'));};
      worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data);};worker.onerror=()=>{finish();reject(new Error('Could not check enclosure.'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}worker.postMessage({pixels,width:canvas.width,height:canvas.height,sourceWidth:ref.width,sourceHeight:ref.height},[pixels.buffer]);
    });
  }finally{image.close();}
}
// Session-only cache: exact image/crop/choices; never stores uploaded references on a server.
const reviews=new Map<string,OpeningAnswer>();
export async function inspectOpening(ref:PlanReference,choices:OpeningChoice[],signal:AbortSignal):Promise<OpeningAnswer> {
  const padding=Math.max(35,...choices.map(s=>Math.hypot(s.bx-s.ax,s.by-s.ay)))*.7;
  const x=Math.max(0,Math.floor(Math.min(...choices.flatMap(s=>[s.ax,s.bx]))-padding)),y=Math.max(0,Math.floor(Math.min(...choices.flatMap(s=>[s.ay,s.by]))-padding));
  const width=Math.min(ref.width,Math.ceil(Math.max(...choices.flatMap(s=>[s.ax,s.bx]))+padding))-x,height=Math.min(ref.height,Math.ceil(Math.max(...choices.flatMap(s=>[s.ay,s.by]))+padding))-y;
  const bitmap=await createImageBitmap(await(await fetch(ref.url,{signal})).blob());
  let image:string;
  try{signal.throwIfAborted();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d')!.drawImage(bitmap,x,y,width,height,0,0,width,height);image=canvas.toDataURL('image/jpeg',.92);}finally{bitmap.close();}
  const local=choices.map(c=>({...c,ax:c.ax-x,ay:c.ay-y,bx:c.bx-x,by:c.by-y}));
  const body=JSON.stringify({image,width,height,openingReview:{version:OPENING_REVIEW_VERSION,choices:local}}),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  signal.throwIfAborted();const cached=reviews.get(hash);if(cached)return cached;
  const response=await fetch('/api/floor-plan/recognize',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal,body});const value=await response.json();
  if(!response.ok||value?.error)throw new Error(value?.error??'Could not inspect this opening.');signal.throwIfAborted();const result=validateOpeningAnswer(value,choices);if(reviews.size>=40)reviews.delete(reviews.keys().next().value!);reviews.set(hash,result);return result;
}
