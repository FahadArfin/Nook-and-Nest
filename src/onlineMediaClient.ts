import {backupNotices,buildProjectBackup,parseProjectBackup,restoreProjectBackup,validateProjectBackup,type ProjectBackup} from './projectBackup';
import {createListing,type ListingDocument} from './listingTypes';
import {personalPhotoIds} from './personalItems';
import {validatePersonalAssetBundle} from './personalStorage';
import {ONLINE_MEDIA_LIMITS as L,manifestDigest,mediaDigest,mediaHash,mediaId,mediaInteger,parseMediaSnapshot,parseOnlineMediaManifest,type OnlineMediaManifest,type OnlineMediaProject,type OnlineMediaSelection,type OnlineMediaStatus,type OnlineMediaUpload} from './onlineMedia';
import {loadPreparedMedia,savePreparedMedia,type PreparedOnlineMedia} from './onlineMediaStorage';
import type {PlanDocumentV1} from './types';
export type MediaProgress={stage:'preparing'|'uploading'|'downloading'|'finalizing';done:number;total:number};
export interface DownloadedOnlineMedia {backup:ProjectBackup;notices:string[]}
const root='/api/online-media';
export class OnlineMediaError extends Error {constructor(message:string,readonly status:number){super(message);this.name='OnlineMediaError';}}
async function readBytes(response:Response,max:number){const reader=response.body?.getReader();if(!reader)throw Error('Backup response was empty.');const parts:Uint8Array[]= [];let n=0;for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw Error('Backup response exceeds its size limit.');}parts.push(value);}const bytes=new Uint8Array(n);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;}
async function request(path:string,key?:string,options:RequestInit={},max=512*1024){const response=await fetch(root+path,{...options,credentials:'same-origin',redirect:'error',cache:'no-store',referrerPolicy:'same-origin',headers:{...(key?{'X-Nook-Media-Account':key}:{}),...options.headers}});const bytes=await readBytes(response,max);let data:unknown;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('The backup service returned an invalid response.');}if(!response.ok)throw new OnlineMediaError(typeof (data as {error?:unknown})?.error==='string'?(data as {error:string}).error.slice(0,600):'The backup operation failed.',response.status);return data as Record<string,any>;}
const post=(path:string,key:string,data:unknown,signal?:AbortSignal,method='POST')=>request(path,key,{method,signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const idPath=(id:string)=>{if(!mediaId(id))throw Error('Invalid snapshot identity.');return '/uploads/'+encodeURIComponent(id);};
export async function checkOnlineMedia(signal?:AbortSignal):Promise<OnlineMediaStatus>{const v=await request('/status',undefined,{signal});if(typeof v.available!=='boolean'||typeof v.manageAvailable!=='boolean'||typeof v.signedIn!=='boolean'||v.signedIn&&!mediaHash(v.accountKey)||JSON.stringify(v.limits)!==JSON.stringify(L))throw Error('Unsupported private backup service.');return {available:v.available,manageAvailable:v.manageAvailable,signedIn:v.signedIn,limits:L,...(v.signedIn?{accountKey:v.accountKey,usedBytes:mediaInteger(v.usedBytes,0,L.account)}:{}),...(typeof v.reason==='string'?{reason:v.reason.slice(0,600)}:{})};}
export async function listOnlineMedia(key:string,signal?:AbortSignal):Promise<OnlineMediaProject[]>{const v=await request('/projects',key,{signal});if(!Array.isArray(v.projects)||v.projects.length>40)throw Error('Invalid backup list.');return v.projects.map((p:any)=>{if(!mediaId(p.projectId)||p.headId!==null&&!mediaId(p.headId)||!Array.isArray(p.snapshots)||p.snapshots.length>L.uploadsPerProject)throw Error('Invalid project backup list.');const snapshots=p.snapshots.map(parseMediaSnapshot);if(snapshots.some((s:any)=>s.projectId!==p.projectId)||p.headId&&!snapshots.some((s:any)=>s.id===p.headId&&s.state==='complete'))throw Error('The backup list changed. Refresh it.');return {projectId:p.projectId,revision:mediaInteger(p.revision),headId:p.headId,snapshots};});}
function parseUpload(v:Record<string,any>):OnlineMediaUpload{const snapshot=parseMediaSnapshot(v.snapshot),manifest=parseOnlineMediaManifest(v.manifest);if(snapshot.projectId!==manifest.projectId||snapshot.bytes!==manifest.totalBytes||v.headId!==null&&!mediaId(v.headId)||!Array.isArray(v.receivedHashes)||v.receivedHashes.length>L.chunks||v.receivedHashes.some((h:unknown)=>!mediaHash(h)||!manifest.chunks.some(c=>c.hash===h))||new Set(v.receivedHashes).size!==v.receivedHashes.length)throw Error('Invalid upload response.');return {snapshot,manifest,projectRevision:mediaInteger(v.projectRevision),headId:v.headId,receivedHashes:v.receivedHashes};}
export async function getOnlineMedia(id:string,key:string,signal?:AbortSignal){return parseUpload(await request(idPath(id),key,{signal}));}
export async function prepareOnlineMedia(plan:PlanDocumentV1,selection:OnlineMediaSelection,accountKey:string,baseRevision:number,listing?:ListingDocument):Promise<PreparedOnlineMedia>{
 const built=await buildProjectBackup(plan,{includeReferences:selection.references,listing:selection.listing?listing:createListing(plan.id,plan.name)});
 if(!selection.listing)delete built.listing;
 if(!selection.personal)built.personalAssets={version:1,assets:[],missing:personalPhotoIds(built.plan)};
 return prepareMediaBytes(built,selection,accountKey,baseRevision);
}
export async function prepareMediaBytes(input:ProjectBackup,selection:OnlineMediaSelection,accountKey:string,baseRevision:number):Promise<PreparedOnlineMedia>{
 const backup=validateProjectBackup(input);if(backup.personalAssets)await validatePersonalAssetBundle(backup.personalAssets);
 if(!selection.listing&&backup.listing||!selection.personal&&backup.personalAssets?.assets.length||!selection.references&&[...backup.references,...(backup.referenceVersions??[])].some(r=>r.status==='included'))throw Error('The backup contains media outside the selected inclusion choices.');
 const bytes=new TextEncoder().encode(JSON.stringify(backup));if(bytes.length>L.project)throw Error('This backup exceeds the 20 MiB online pilot limit. Leave out media or use the complete portable local backup.');
 const chunks:OnlineMediaManifest['chunks']=[];for(let offset=0;offset<bytes.length;offset+=L.chunk){const part=bytes.subarray(offset,offset+L.chunk);chunks.push({hash:await mediaDigest(part),bytes:part.length});}
 const notices=[...(!selection.listing?['Listing details, photographs and saved listing viewpoints were left out.']:[]),...(!selection.personal?['Personal original images were left out; private plan labels and notes are still included.']:[]),...backupNotices(backup)];
 const manifest=parseOnlineMediaManifest({format:'nook-private-media/1',projectId:backup.plan.id,projectName:backup.plan.name,exportedAt:backup.exportedAt,totalBytes:bytes.length,archiveHash:await mediaDigest(bytes),chunks,selections:selection,counts:{floors:backup.plan.floors.length,listingMedia:backup.listing?.media.length??0,personalAssets:backup.personalAssets?.assets.length??0,references:[...backup.references,...(backup.referenceVersions??[])].filter(r=>r.status==='included').length},notices});
 return {id:crypto.randomUUID(),accountKey,baseRevision,manifest,bytes,createdAt:Date.now()};
}
/** User-initiated only. Saving exact recovery bytes must succeed before the first POST. */
export async function startOnlineMedia(prepared:PreparedOnlineMedia,confirmed:boolean,signal?:AbortSignal,progress?:(p:MediaProgress)=>void){if(!confirmed)throw Error('Confirm uploading this exact private backup first.');await savePreparedMedia(prepared);return resumeOnlineMedia(prepared.id,prepared.accountKey,signal,progress);}
export async function resumeOnlineMedia(id:string,key:string,signal?:AbortSignal,progress?:(p:MediaProgress)=>void){
 const prepared=await loadPreparedMedia(id,key),status=await checkOnlineMedia(signal);if(!status.available||status.accountKey!==key)throw Error('The account changed or uploads are paused. Your recovery copy remains on this browser.');
 // Idempotent identity also recovers a lost reservation response. It never creates a second upload.
 let detail:OnlineMediaUpload;try{detail=await getOnlineMedia(id,key,signal);}catch(error){if(!(error instanceof OnlineMediaError)||error.status!==404)throw error;detail=parseUpload(await post('/uploads',key,{id,manifest:prepared.manifest,expectedRevision:prepared.baseRevision,uploadConfirmed:true},signal));}
 return sendMissing(prepared,detail,signal,progress);
}
async function sendMissing(prepared:PreparedOnlineMedia,detail:OnlineMediaUpload,signal?:AbortSignal,progress?:(p:MediaProgress)=>void){
 const {id,accountKey:key,manifest,bytes}=prepared,digest=await manifestDigest(manifest);if(detail.snapshot.manifestHash!==digest)throw Error('The online upload does not match your prepared bytes.');
 if(detail.snapshot.state==='complete')return detail;
 let offset=0,done=0;const received=new Set(detail.receivedHashes);
 for(const chunk of manifest.chunks){if(!received.has(chunk.hash)){await request(idPath(id)+'/chunks/'+chunk.hash,key,{method:'PUT',signal,headers:{'Content-Type':'application/octet-stream'},body:bytes.slice(offset,offset+chunk.bytes) as BodyInit},4096);received.add(chunk.hash);}offset+=chunk.bytes;done+=chunk.bytes;progress?.({stage:'uploading',done,total:bytes.length});}
 progress?.({stage:'finalizing',done:bytes.length,total:bytes.length});detail=parseUpload(await post(idPath(id)+'/finalize',key,{manifestHash:digest,expectedVersion:detail.snapshot.stateVersion},signal));if(detail.snapshot.state!=='complete')throw Error('The backup has not completed.');return detail;
}
/** Separate explicit confirmation for a competing complete snapshot; never auto-rebase. */
export async function replaceOnlineMediaHead(id:string,key:string,expectedRevision:number,expectedVersion:number,confirmed:boolean,signal?:AbortSignal,progress?:(p:MediaProgress)=>void){if(!confirmed)throw Error('Confirm replacing the current online snapshot.');const prepared=await loadPreparedMedia(id,key),detail=parseUpload(await post(idPath(id)+'/rebase',key,{expectedRevision,expectedVersion,replaceConfirmed:true},signal));return sendMissing(prepared,detail,signal,progress);}
export async function deleteOnlineMedia(id:string,key:string,expectedVersion:number,signal?:AbortSignal){const value=await post(idPath(id),key,{expectedVersion},signal,'DELETE');if(value.deleted!==true)throw Error('Deletion was not confirmed.');}
/** Download only; no local plan writes. Every hash and established backup validator runs first. */
export async function downloadOnlineMedia(id:string,key:string,signal?:AbortSignal,progress?:(p:MediaProgress)=>void):Promise<DownloadedOnlineMedia>{
 const detail=await getOnlineMedia(id,key,signal);if(detail.snapshot.state!=='complete'||await manifestDigest(detail.manifest)!==detail.snapshot.manifestHash)throw Error('Choose a complete, intact snapshot.');
 const manifest=detail.manifest,bytes=new Uint8Array(manifest.totalBytes);let offset=0;
 for(const c of manifest.chunks){const response=await fetch(root+idPath(id)+'/chunks/'+c.hash,{signal,credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'X-Nook-Media-Account':key}});if(!response.ok)throw Error('A private backup chunk could not be downloaded. The snapshot may have been removed.');const part=await readBytes(response,c.bytes);if(part.length!==c.bytes||await mediaDigest(part)!==c.hash)throw Error('A downloaded chunk is damaged. No local project was changed.');bytes.set(part,offset);offset+=part.length;progress?.({stage:'downloading',done:offset,total:bytes.length});}
 if(await mediaDigest(bytes)!==manifest.archiveHash)throw Error('The complete backup hash does not match. No local project was changed.');
 const backup=parseProjectBackup(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(backup.plan.id!==manifest.projectId)throw Error('The downloaded backup belongs to a different project.');if(backup.personalAssets)await validatePersonalAssetBundle(backup.personalAssets);
 // Check declared choices/counts against actual decoded bytes, not the server's labels alone.
 const checked=await prepareMediaBytes(backup,manifest.selections,key,0);if(JSON.stringify(checked.manifest.counts)!==JSON.stringify(manifest.counts))throw Error('The downloaded media counts do not match.');return {backup,notices:checked.manifest.notices};
}
export async function restoreOnlineMediaCopy(backup:ProjectBackup,confirmed:boolean){if(!confirmed)throw Error('Confirm creating a new local project copy.');return restoreProjectBackup(backup);}
