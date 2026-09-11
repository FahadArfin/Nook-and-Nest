import type {PlanReference} from './blueprintImport';
import type {BlueprintDraft} from './blueprint';
import {scaleWallFirst} from './wallFirstGeometry';
export async function prepareWallFirst(ref:PlanReference,grid:number,signal:AbortSignal):Promise<BlueprintDraft>{
  const response=await fetch(ref.url,{signal}),bitmap=await createImageBitmap(await response.blob());
  try{
    signal.throwIfAborted();const s=Math.min(1,1600/Math.max(ref.width,ref.height)),canvas=document.createElement('canvas');canvas.width=Math.round(ref.width*s);canvas.height=Math.round(ref.height*s);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable in this browser.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const draft=await new Promise<BlueprintDraft>((resolve,reject)=>{const worker=new Worker(new URL('./wallFirst.worker.ts',import.meta.url),{type:'module'});const finish=()=>{worker.terminate();signal.removeEventListener('abort',abort);};const abort=()=>{finish();reject(new DOMException('Cancelled','AbortError'));};worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data.draft);};worker.onerror=()=>{finish();reject(new Error('Could not extract walls. Use manual tracing.'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}worker.postMessage({pixels,width:canvas.width,height:canvas.height,sourceWidth:ref.width,sourceHeight:ref.height},[pixels.buffer]);});
    draft.walls=draft.walls.map(w=>({...w,ax:w.ax/grid,az:w.az/grid,bx:w.bx/grid,bz:w.bz/grid}));return {...scaleWallFirst(draft,10),referenceScale:10,referenceCalibrated:false};
  }finally{bitmap.close();}
}
