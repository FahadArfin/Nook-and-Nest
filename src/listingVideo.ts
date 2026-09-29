export type ListingVideoStatus='submitting'|'submission_unknown'|'queued'|'running'|'succeeded'|'failed'|'cancelled'|'expired'|'deleted';
export interface ListingVideoJob {
  id:string;requestId:string;status:ListingVideoStatus;createdAt:string;updatedAt:string;
  videoUrl?:string;error?:string;retryAfterSeconds:number;
}
export interface ListingVideoRequest {
  requestId:string;images:{dataUrl:string;label:string}[];prompt:string;
  duration:5|10|15;ratio:'16:9'|'9:16'|'1:1';resolution:'720p'|'1080p';consent:true;
}
export interface ListingVideoAvailability {
  available:boolean;signedIn:boolean;provider:string;model:string;reason?:string;
  limits:{maxImages:number;maxImageBytes:number;maxRequestBytes:number;durations:number[];ratios:string[];resolutions:string[]};
}
const states=new Set<string>(['submitting','submission_unknown','queued','running','succeeded','failed','cancelled','expired','deleted']);
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
export function validateVideoJob(value:unknown):ListingVideoJob {
  if(!value||typeof value!=='object')throw new Error('The video service returned an invalid job.');
  const job=value as ListingVideoJob;
  if(!validId(job.id)||!validId(job.requestId)||!states.has(job.status)||typeof job.createdAt!=='string'||typeof job.updatedAt!=='string'||!Number.isFinite(Date.parse(job.createdAt))||!Number.isFinite(Date.parse(job.updatedAt))||!Number.isFinite(job.retryAfterSeconds)||job.retryAfterSeconds<5||job.retryAfterSeconds>300||job.error!==undefined&&(typeof job.error!=='string'||job.error.length>1000))throw new Error('The video service returned an invalid job.');
  if(job.videoUrl!==undefined){let url:URL;try{url=new URL(job.videoUrl);}catch{throw new Error('The video service returned an invalid video link.');}if(url.protocol!=='https:'||url.username||url.password)throw new Error('The video service returned an invalid video link.');}
  if(job.status==='succeeded'&&!job.videoUrl)throw new Error('The finished video is missing its download link. Check its status again.');
  return {id:job.id,requestId:job.requestId,status:job.status,createdAt:job.createdAt,updatedAt:job.updatedAt,retryAfterSeconds:job.retryAfterSeconds,...(job.videoUrl?{videoUrl:job.videoUrl}:{}),...(job.error?{error:job.error}:{})};
}
async function api(path:string,init:RequestInit={}):Promise<unknown> {
  let response:Response;
  try{response=await fetch('/api/listing-video'+path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json',...init.headers}});}
  catch(error){if(init.signal?.aborted)throw error;throw new Error(init.method==='POST'&&path!=='?validate=1'?'The submission connection was interrupted. Keep this request and retry its status; do not start a new generation.':'The video service could not be reached. Try again shortly.');}
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(body&&typeof body.error==='string'?body.error:'The video service is unavailable. Your home has not changed.');
  return body;
}
export async function listingVideoAvailability(signal?:AbortSignal):Promise<ListingVideoAvailability> {
  const value=await api('',{signal}) as ListingVideoAvailability;
  if(!value||typeof value.available!=='boolean'||typeof value.signedIn!=='boolean'||typeof value.provider!=='string'||typeof value.model!=='string'||value.reason!==undefined&&typeof value.reason!=='string'||!value.limits||!Number.isFinite(value.limits.maxImages)||!Number.isFinite(value.limits.maxImageBytes)||!Number.isFinite(value.limits.maxRequestBytes)||!Array.isArray(value.limits.durations)||!value.limits.durations.every(n=>Number.isFinite(n)&&n>0&&n<=15)||!Array.isArray(value.limits.ratios)||!value.limits.ratios.every(n=>typeof n==='string')||!Array.isArray(value.limits.resolutions)||!value.limits.resolutions.every(n=>typeof n==='string'))throw new Error('Video availability could not be confirmed.');
  return value;
}
export async function submitListingVideo(input:ListingVideoRequest,signal?:AbortSignal):Promise<ListingVideoJob> {
  if(input.consent!==true)throw new Error('Confirm sending these images for paid video generation.');
  if(!validId(input.requestId))throw new Error('A unique video request ID is required.');
  return validateVideoJob(await api('',{method:'POST',body:JSON.stringify(input),signal}));
}
/** Preflight a new request before persisting its paid-submission marker. Never creates a job. */
export async function validateListingVideo(input:ListingVideoRequest,signal?:AbortSignal):Promise<void> {
  const result=await api('?validate=1',{method:'POST',body:JSON.stringify(input),signal}) as {valid?:unknown};
  if(result?.valid!==true)throw new Error('The video request could not be validated.');
}
export async function getListingVideo(id:string,signal?:AbortSignal):Promise<ListingVideoJob> {
  if(!validId(id))throw new Error('Invalid video job ID.');
  return validateVideoJob(await api('/'+encodeURIComponent(id),{signal}));
}
export async function deleteListingVideo(id:string,signal?:AbortSignal):Promise<ListingVideoJob> {
  if(!validId(id))throw new Error('Invalid video job ID.');
  return validateVideoJob(await api('/'+encodeURIComponent(id),{method:'DELETE',body:'{}',signal}));
}
