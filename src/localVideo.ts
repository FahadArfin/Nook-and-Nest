import {openDB} from 'idb';
import {isListingImage} from './listingTypes';

export type LocalVideoProfile={endpoint:string;model:string;adapter:'standard'|'h3'};
export type LocalVideoJob={id:string;status:'queued'|'in_progress'|'completed'|'failed';progress?:number};
export type LocalVideoRecord={requestId:string;profile:LocalVideoProfile;job?:LocalVideoJob};
const profileKey='nook-local-video-profile';
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(value);
const validModel=(value:unknown):value is string=>typeof value==='string'&&value.length<=300&&!/[\u0000-\u001f\u007f]/.test(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Addresses are browser destinations, never passed through the hosted application. */
export function localVideoEndpoint(value:string){
  let url:URL;
  try{url=new URL(value.trim())}catch{throw new Error('Enter your model server’s full HTTPS address.');}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))||url.username||url.password||url.search||url.hash){
    throw new Error('Use HTTPS for a cluster, or HTTP on localhost. Keep credentials out of the address.');
  }
  url.pathname=url.pathname.replace(/\/+$/,'').replace(/\/v1$/,'')+'/v1';
  return url.toString().replace(/\/$/,'');
}
function parseProfile(value:unknown):LocalVideoProfile{
  if(!object(value)||typeof value.endpoint!=='string'||!validModel(value.model)||typeof value.adapter!=='string'||!['standard','h3'].includes(value.adapter)){
    throw new Error('The saved model connection is invalid.');
  }
  return {endpoint:localVideoEndpoint(value.endpoint),model:value.model.trim(),adapter:value.adapter as LocalVideoProfile['adapter']};
}
export function loadLocalVideoProfile():LocalVideoProfile{
  try{return parseProfile(JSON.parse(localStorage.getItem(profileKey)??'null'))}catch{return {endpoint:'',model:'',adapter:'standard'}}
}
export function saveLocalVideoProfile(profile:LocalVideoProfile){
  localStorage.setItem(profileKey,JSON.stringify(parseProfile(profile)));
}

async function request(profile:LocalVideoProfile,token:string,path:string,init:RequestInit={},timeout=20000){
  const url=localVideoEndpoint(profile.endpoint)+path;
  if(typeof token!=='string'||token.length>8192||/[\u0000-\u001f\u007f]/.test(token))throw new Error('Enter a valid access token.');
  const headers=new Headers(init.headers);
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const signal=AbortSignal.any([AbortSignal.timeout(timeout),...(init.signal?[init.signal]:[])]);
  let response:Response;
  try{response=await fetch(url,{...init,signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',headers})}
  catch{throw new Error('Cannot reach the model server. Check its address, browser access permission, HTTPS and allowed website origin.');}
  // Do not follow a redirect, including in fetch implementations that ignore redirect:error.
  if(response.redirected||(response.url&&response.url!==url))throw new Error('The model server redirected this request. Use its final server address instead.');
  if(!response.ok)throw new Error(`Model server returned ${response.status}. Check its configuration or job status.`);
  return response;
}
async function json(response:Response):Promise<unknown>{
  if(!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(response.headers.get('content-type')??''))throw new Error('The server did not return JSON. Check its API address.');
  const bytes=await boundedBytes(response,1024*1024);
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new Error('The server returned invalid JSON.');}
}
async function boundedBytes(response:Response,limit:number):Promise<Uint8Array<ArrayBuffer>>{
  const tooLarge=()=>new Error('The server response is too large to open here. Save it from your server instead.');
  const length=response.headers.get('content-length');
  if(length&&/^\d+$/.test(length)&&Number(length)>limit){await response.body?.cancel();throw tooLarge();}
  const reader=response.body?.getReader();if(!reader)throw new Error('The server returned an empty response.');
  const chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>limit)throw tooLarge();chunks.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return bytes;
}
export async function discoverLocalVideo(profile:LocalVideoProfile,token:string,signal?:AbortSignal):Promise<string[]>{
  const body=await json(await request(profile,token,'/models',{signal}));
  if(!object(body)||!Array.isArray(body.data))throw new Error('Expected a compatible video server with a /v1/models endpoint.');
  const models=[...new Set(body.data.flatMap(m=>object(m)&&validModel(m.id)&&m.id.trim()?[m.id.trim()]:[]))].slice(0,30);
  if(!models.length)throw new Error('The server has no loaded models.');
  return models;
}
export function parseLocalVideoJob(body:unknown):LocalVideoJob{
  if(!object(body)||!validId(body.id)||typeof body.status!=='string'||!['queued','in_progress','completed','failed'].includes(body.status)||
    body.progress!==undefined&&(typeof body.progress!=='number'||!Number.isFinite(body.progress)||body.progress<0||body.progress>100)){
    throw new Error('The server returned an unsupported video job. Check its job list before sending another request.');
  }
  // Returned URLs and provider metadata are untrusted. Content is fetched only from this server's /content route.
  return {id:body.id,status:body.status as LocalVideoJob['status'],...(body.progress===undefined?{}:{progress:body.progress as number})};
}
export async function submitLocalVideo(profile:LocalVideoProfile,token:string,input:{image:string;prompt:string;seconds:number;consent:boolean},signal?:AbortSignal){
  const p=parseProfile(profile);
  if(input?.consent!==true||!isListingImage(input.image,3*1024*1024)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2000||![5,10,15].includes(input.seconds)||!p.model){
    throw new Error('Choose a reference image, model and prompt, then approve sending them to your server.');
  }
  let body:BodyInit,headers:HeadersInit={};
  if(p.adapter==='h3'){
    headers={'Content-Type':'application/json'};
    body=JSON.stringify({
      model:p.model,prompt:input.prompt,enhance_prompt:false,seconds:input.seconds,task:'fl2va',
      conditions:[{type:'image',uri:input.image,role:'keyframe',frame_index:0}],
      target:{short_edge:768,aspect_ratio:'auto',duration_seconds:input.seconds},
      num_outputs_per_prompt:1,num_inference_steps:50,flow_shift:12,audio_flow_shift:3,
    });
  }else{
    const mime=input.image.slice(5,input.image.indexOf(';')),bytes=Uint8Array.from(atob(input.image.split(',')[1]),c=>c.charCodeAt(0));
    const form=new FormData();form.set('model',p.model);form.set('prompt',input.prompt);form.set('seconds',String(input.seconds));
    form.set('input_reference',new Blob([bytes],{type:mime}),'reference.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]));
    body=form;
  }
  // Exactly one POST: a timeout or invalid response may still mean the server accepted the job.
  return parseLocalVideoJob(await json(await request(p,token,'/videos',{method:'POST',body,headers,signal},45000)));
}
export async function getLocalVideo(profile:LocalVideoProfile,token:string,id:string,signal?:AbortSignal){
  if(!validId(id))throw new Error('Enter a valid server job ID.');
  const job=parseLocalVideoJob(await json(await request(profile,token,'/videos/'+encodeURIComponent(id),{signal})));
  if(job.id!==id)throw new Error('The response belongs to another job.');return job;
}
export async function downloadLocalVideo(profile:LocalVideoProfile,token:string,id:string,signal?:AbortSignal){
  if(!validId(id))throw new Error('Invalid video job ID.');
  const response=await request(profile,token,'/videos/'+encodeURIComponent(id)+'/content',{signal},120000);
  if(!/^(video\/mp4|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type')??''))throw new Error('Expected an MP4 video from the server.');
  const bytes=await boundedBytes(response,128*1024*1024);
  if(bytes.length<12||String.fromCharCode(...bytes.subarray(4,8))!=='ftyp')throw new Error('The server did not return a supported MP4 video.');
  return new Blob([bytes],{type:'video/mp4'});
}

const db=()=>openDB('nook-local-video-jobs',1,{upgrade(d){d.createObjectStore('jobs')}});
function checkPlanId(planId:string){if(typeof planId!=='string'||!planId.trim()||planId.length>160)throw new Error('This home has an invalid identifier.');}
function parseRecord(value:unknown):LocalVideoRecord{
  if(!object(value)||!validId(value.requestId))throw new Error('Unreadable model job record.');
  return {requestId:value.requestId,profile:parseProfile(value.profile),...(value.job===undefined?{}:{job:parseLocalVideoJob(value.job)})};
}
export async function readLocalVideoRecord(planId:string):Promise<LocalVideoRecord|undefined>{
  checkPlanId(planId);const d=await db();
  try{const record=await d.get('jobs',planId);return record===undefined?undefined:parseRecord(record)}finally{d.close()}
}
/** Reserve atomically before POST; concurrent tabs cannot both start a request for one home. */
export async function reserveLocalVideo(planId:string,profile:LocalVideoProfile):Promise<LocalVideoRecord>{
  checkPlanId(planId);const cleanProfile=parseProfile(profile);
  if(!cleanProfile.model)throw new Error('Choose a model before reserving a request.');
  const d=await db(),tx=d.transaction('jobs','readwrite');
  try{
    // Corrupt records must also hold the lock until the user can inspect/recover storage.
    if(await tx.store.get(planId)!==undefined)throw new Error('This home already has a model request. Reopen it to recover the job.');
    const record={requestId:crypto.randomUUID(),profile:cleanProfile};
    await tx.store.put(record,planId);await tx.done;return record;
  }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw error}finally{d.close()}
}
export async function updateLocalVideoRecord(planId:string,record:LocalVideoRecord,remove=false){
  checkPlanId(planId);const next=parseRecord(record),d=await db(),tx=d.transaction('jobs','readwrite');
  try{
    const raw=await tx.store.get(planId),current=raw===undefined?undefined:parseRecord(raw);
    if(!current||current.requestId!==next.requestId||JSON.stringify(current.profile)!==JSON.stringify(next.profile)){
      throw new Error('A different request is now open for this home. Reopen it to recover.');
    }
    if(current.job&&(!next.job||current.job.id!==next.job.id))throw new Error('This request already belongs to another server job. Reopen it to recover.');
    if(remove)await tx.store.delete(planId);
    else{
      if(current.job&&next.job){
        const terminal=['completed','failed'].includes(current.job.status);
        if(terminal&&next.job.status!==current.job.status||current.job.status==='in_progress'&&next.job.status==='queued'){
          throw new Error('A newer job status is already saved. Reopen it to recover.');
        }
        if(current.job.progress!==undefined&&(next.job.progress===undefined||next.job.progress<current.job.progress))next.job.progress=current.job.progress;
      }
      await tx.store.put(next,planId);
    }
    await tx.done;
  }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw error}finally{d.close()}
}

