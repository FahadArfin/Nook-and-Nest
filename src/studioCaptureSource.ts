import {captureDraftKey,captureGeometryKey,type CaptureMethod,type CaptureSource} from './captureReview';
import type {BlueprintDraft} from './blueprint';
import type {PlanReference} from './blueprintImport';
import {PIPELINE_VERSION} from './recognitionEvidence';

/** Device-local evidence; the image digest never goes into a capture review or shared plan. */
export interface StudioCaptureSource {source:CaptureSource;referenceDigest:string}
function metadata(reference:PlanReference,page:number,rotation:number,method:CaptureMethod,id:string):CaptureSource {
 if(typeof id!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(id)||!Number.isInteger(reference.pages)||reference.pages<1||reference.pages>200||!Number.isInteger(page)||page<1||page>200||page>reference.pages||![0,90,180,270].includes(rotation)||![reference.width,reference.height].every(n=>Number.isInteger(n)&&n>=1&&n<=2400)||!['online-recognition','local-wall-extraction','manual-tracing'].includes(method))throw Error('Invalid local capture reference.');
 return {id,page,rotation:rotation as CaptureSource['rotation'],widthPx:reference.width,heightPx:reference.height,method,pipelineVersion:PIPELINE_VERSION};
}
async function digest(reference:PlanReference):Promise<string>{
 if(typeof reference.url!=='string'||reference.url.length>32*1024*1024||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(reference.url))throw Error('The capture reference must remain a bounded local image.');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(reference.url))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function createStudioCaptureSource(reference:PlanReference,page:number,rotation:number,method:CaptureMethod):Promise<StudioCaptureSource>{
 return {source:metadata(reference,page,rotation,method,crypto.randomUUID()),referenceDigest:await digest(reference)};
}
/** Bounded backup shape only. Call restoreStudioCaptureSource to verify its actual local pixels. */
export function parseStudioCaptureSource(value:unknown,reference:PlanReference|undefined,page:number,rotation:number):StudioCaptureSource{
 if(!reference||!value||typeof value!=='object')throw Error('Capture evidence needs its matching local preview.');
 const saved=value as StudioCaptureSource;if(!saved.source||!/^[a-f0-9]{64}$/.test(saved.referenceDigest)||typeof saved.source.pipelineVersion!=='string'||!/^[a-zA-Z0-9_.:-]{1,80}$/.test(saved.source.pipelineVersion))throw Error('Invalid capture evidence.');
 const source={...metadata(reference,page,rotation,saved.source.method,saved.source.id),pipelineVersion:saved.source.pipelineVersion};
 if(source.page!==saved.source.page||source.rotation!==saved.source.rotation||source.widthPx!==saved.source.widthPx||source.heightPx!==saved.source.heightPx)throw Error('Capture evidence does not match the local preview.');
 return {source,referenceDigest:saved.referenceDigest};
}
/** Unknown/legacy or changed local evidence cannot acquire an old review's identity. */
export async function restoreStudioCaptureSource(value:unknown,reference:PlanReference|undefined,page:number,rotation:number,requireCurrentPipeline=true):Promise<StudioCaptureSource|undefined>{
 try{
  const saved=parseStudioCaptureSource(value,reference,page,rotation);
  if(requireCurrentPipeline&&saved.source.pipelineVersion!==PIPELINE_VERSION||await digest(reference!)!==saved.referenceDigest)return;
  return saved;
 }catch{return undefined;}
}
export function liveStudioCaptureSource(value:StudioCaptureSource|undefined,reference:PlanReference|undefined,page:number,rotation:number):CaptureSource|undefined{
 if(!value||!reference)return;
 try{const source=metadata(reference,page,rotation,value.source.method,value.source.id);return JSON.stringify(source)===JSON.stringify(value.source)?source:undefined;}catch{return undefined;}
}
/** Include reference scale as well as physical drawing geometry; decisions never affect this key. */
export const studioCaptureDraftKey=(draft:BlueprintDraft,grid:number,imageScale:number)=>captureGeometryKey({draft:captureDraftKey(draft,grid),imageScale});
