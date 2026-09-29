/** Shared wire rules. No account identities, browser storage or provider dependencies. */
export const ONLINE_MEDIA_LIMITS={chunk:128*1024,project:20*1024*1024,account:50*1024*1024,pilot:200*1024*1024,manifest:64*1024,chunks:160,uploadsPerProject:8,uploadsPerAccount:80,uploadsGlobal:1000,pendingDays:7} as const;
export interface OnlineMediaSelection {listing:boolean;references:boolean;personal:boolean}
export interface OnlineMediaManifest {
  format:'nook-private-media/1';projectId:string;projectName:string;exportedAt:string;
  totalBytes:number;archiveHash:string;chunks:{hash:string;bytes:number}[];
  selections:OnlineMediaSelection;counts:{floors:number;listingMedia:number;personalAssets:number;references:number};notices:string[];
}
export interface OnlineMediaSnapshot {id:string;projectId:string;name:string;state:'uploading'|'complete';stateVersion:number;baseRevision:number;createdAt:number;expiresAt:number;completedAt:number|null;bytes:number;manifestHash:string}
export interface OnlineMediaProject {projectId:string;revision:number;headId:string|null;snapshots:OnlineMediaSnapshot[]}
export interface OnlineMediaStatus {available:boolean;manageAvailable:boolean;signedIn:boolean;accountKey?:string;limits:typeof ONLINE_MEDIA_LIMITS;usedBytes?:number;reason?:string}
export interface OnlineMediaUpload {snapshot:OnlineMediaSnapshot;manifest:OnlineMediaManifest;projectRevision:number;headId:string|null;receivedHashes:string[]}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid private backup data.');return v as Record<string,unknown>;};
const exact=(v:Record<string,unknown>,keys:string[])=>{if(Object.keys(v).some(k=>!keys.includes(k)))throw Error('Unexpected private backup field.');};
export const mediaId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export const mediaHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function mediaInteger(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(!Number.isSafeInteger(v)||(v as number)<min||(v as number)>max)throw Error('Invalid private backup size or version.');return v as number;}
function text(v:unknown,max:number){if(typeof v!=='string'||!v.length||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw Error('Invalid private backup text.');return v;}
export function parseOnlineMediaManifest(input:unknown):OnlineMediaManifest {
  const v=object(input);exact(v,['format','projectId','projectName','exportedAt','totalBytes','archiveHash','chunks','selections','counts','notices']);
  if(v.format!=='nook-private-media/1'||!mediaId(v.projectId)||!mediaHash(v.archiveHash))throw Error('Unsupported private backup manifest.');
  const projectName=text(v.projectName,180),exportedAt=text(v.exportedAt,40);if(!Number.isFinite(Date.parse(exportedAt)))throw Error('Invalid backup date.');
  const totalBytes=mediaInteger(v.totalBytes,1,ONLINE_MEDIA_LIMITS.project);
  if(!Array.isArray(v.chunks)||!v.chunks.length||v.chunks.length>ONLINE_MEDIA_LIMITS.chunks)throw Error('Invalid backup chunk list.');
  const rawChunks=v.chunks,sizes=new Map<string,number>(),chunks=rawChunks.map((entry,i)=>{const c=object(entry);exact(c,['hash','bytes']);if(!mediaHash(c.hash))throw Error('Invalid chunk hash.');const bytes=mediaInteger(c.bytes,1,ONLINE_MEDIA_LIMITS.chunk);if(i<rawChunks.length-1&&bytes!==ONLINE_MEDIA_LIMITS.chunk)throw Error('Only the final chunk can be smaller.');if(sizes.has(c.hash)&&sizes.get(c.hash)!==bytes)throw Error('Conflicting chunk sizes.');sizes.set(c.hash,bytes);return {hash:c.hash,bytes};});
  if(chunks.reduce((n,c)=>n+c.bytes,0)!==totalBytes)throw Error('Backup chunk sizes do not match.');
  const s=object(v.selections);exact(s,['listing','references','personal']);if([s.listing,s.references,s.personal].some(b=>typeof b!=='boolean'))throw Error('Choose which private media to include.');
  const c=object(v.counts);exact(c,['floors','listingMedia','personalAssets','references']);const counts={floors:mediaInteger(c.floors,1,20),listingMedia:mediaInteger(c.listingMedia,0,24),personalAssets:mediaInteger(c.personalAssets,0,100),references:mediaInteger(c.references,0,380)};
  if(!s.listing&&counts.listingMedia||!s.personal&&counts.personalAssets||!s.references&&counts.references)throw Error('Media counts disagree with inclusion choices.');
  if(!Array.isArray(v.notices)||v.notices.length>400)throw Error('Too many missing-media notices.');const notices=v.notices.map(n=>text(n,600));
  const result:OnlineMediaManifest={format:v.format,projectId:v.projectId,projectName,exportedAt,totalBytes,archiveHash:v.archiveHash,chunks,selections:s as unknown as OnlineMediaSelection,counts,notices};
  if(new TextEncoder().encode(JSON.stringify(result)).byteLength>ONLINE_MEDIA_LIMITS.manifest)throw Error('Private backup manifest is too large.');return result;
}
export async function mediaDigest(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function manifestDigest(manifest:OnlineMediaManifest){return mediaDigest(new TextEncoder().encode(JSON.stringify(parseOnlineMediaManifest(manifest))));}
export function parseMediaSnapshot(input:unknown):OnlineMediaSnapshot {const v=object(input);if(!mediaId(v.id)||!mediaId(v.projectId)||!mediaHash(v.manifestHash)||!['complete','uploading'].includes(v.state as string))throw Error('Invalid snapshot response.');return {id:v.id,projectId:v.projectId,name:text(v.name,180),state:v.state as OnlineMediaSnapshot['state'],stateVersion:mediaInteger(v.stateVersion,1),baseRevision:mediaInteger(v.baseRevision),createdAt:mediaInteger(v.createdAt),expiresAt:mediaInteger(v.expiresAt),completedAt:v.completedAt===null?null:mediaInteger(v.completedAt),bytes:mediaInteger(v.bytes,1,ONLINE_MEDIA_LIMITS.project),manifestHash:v.manifestHash};}
