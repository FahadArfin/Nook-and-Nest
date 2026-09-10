import {PIPELINE_VERSION,type ScanEvidence} from './recognitionEvidence';
import type {PlanReference} from './blueprintImport';
import {WALL_SUPPORT_VERSION,type WallSupport} from './wallSupport';
export async function prepareRecognition(ref:PlanReference,signal?:AbortSignal,includeWallView=false):Promise<ScanEvidence> {
  signal?.throwIfAborted();
  const response=await fetch(ref.url,{signal}),bitmap=await createImageBitmap(await response.blob());
  try {
    const scale=Math.min(1,1600/Math.max(ref.width,ref.height)),canvas=document.createElement('canvas');canvas.width=Math.round(ref.width*scale);canvas.height=Math.round(ref.height*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser cannot prepare this image.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const prepared=await new Promise<{walls:ScanEvidence['walls'];support?:WallSupport}>((resolve,reject)=>{
      const worker=new Worker(new URL('./recognitionEvidence.worker.ts',import.meta.url),{type:'module'});
      const finish=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};const abort=()=>{finish();reject(new DOMException('Analysis cancelled.','AbortError'));};
      worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data);};worker.onerror=()=>{finish();reject(new Error('Could not prepare image geometry.'));};
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}worker.postMessage({pixels,width:canvas.width,height:canvas.height,sourceWidth:ref.width,sourceHeight:ref.height,includeWallView},[pixels.buffer]);
    });
    const {walls,support}=prepared;let wallView:ScanEvidence['wallView'];
    if(support){ctx.putImageData(new ImageData(new Uint8ClampedArray(support.mask),support.width,support.height),0,0);wallView={version:WALL_SUPPORT_VERSION,image:canvas.toDataURL('image/png')};}
    const crops:ScanEvidence['crops']=[];
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      signal?.throwIfAborted();const margin=Math.round(Math.min(ref.width,ref.height)*.07),x=Math.max(0,Math.floor(col*ref.width/2)-margin),y=Math.max(0,Math.floor(row*ref.height/2)-margin),width=Math.min(ref.width,Math.ceil((col+1)*ref.width/2)+margin)-x,height=Math.min(ref.height,Math.ceil((row+1)*ref.height/2)+margin)-y;
      const s=Math.min(1,1000/Math.max(width,height));canvas.width=Math.round(width*s);canvas.height=Math.round(height*s);ctx.drawImage(bitmap,x,y,width,height,0,0,canvas.width,canvas.height);crops.push({image:canvas.toDataURL('image/jpeg',.85),x,y,width,height});
    }
    return {version:PIPELINE_VERSION,walls,crops,...(wallView?{wallView}:{})};
  }finally{bitmap.close();}
}
