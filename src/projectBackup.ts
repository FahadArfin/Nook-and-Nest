import {personalPhotoIds} from './personalItems';
import {parsePersonalPhotoAsset,personalAssetBytes,MAX_PERSONAL_MEDIA_BYTES,MAX_PERSONAL_PHOTOS} from './personalMedia';
import {exportPersonalAssets,importPersonalAssets,validatePersonalAssetBundle,type PersonalAssetBundle} from './personalStorage';
import {openDB} from 'idb';
import {parsePlan} from './domain';
import {imageDimensions} from './imageDimensions';
import {isListingImage,parseListing,type ListingDocument} from './listingTypes';
import {loadFloorReference,loadReferenceVersion} from './studioReference';
import type {PlanReference} from './blueprintImport';
import type {PlanDocumentV1} from './types';

export const MAX_PROJECT_BACKUP_BYTES=160*1024*1024;
const MAX_REFERENCE_TOTAL=48*1024*1024;
const MAX_FILE_BYTES=25*1024*1024;
type ReferenceFile={name:string;type:string;lastModified:number;data:string};
export type BackupReference=({floorId:string;status:'included';page:number;rotation:number;preview?:PlanReference;file?:ReferenceFile}|{floorId:string;status:'missing'|'omitted';reason:string})&{referenceId?:string};
export interface ProjectBackup {
  format:'nook-and-nest-project-backup';version:1;exportedAt:string;
  plan:PlanDocumentV1;listing?:ListingDocument;personalAssets?:PersonalAssetBundle;references:BackupReference[];referenceVersions?:BackupReference[];
}
const size=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid project backup data.');return value as Record<string,unknown>;};
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.length||value.length>max)throw new Error('Invalid backup text.');return value;};
const integer=(value:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(value)||(value as number)<min||(value as number)>max)throw new Error('Invalid reference dimensions or page.');return value as number;};
function bytesFromData(data:string,maxBytes:number):Uint8Array {
  const encoded=data.slice(data.indexOf(',')+1);
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4||encoded.length>Math.ceil(maxBytes/3)*4)throw new Error('A reference file is invalid or too large.');
  const binary=atob(encoded);if(binary.length>maxBytes)throw new Error('A reference file exceeds 25 MB.');
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function checkImage(data:unknown,maxLength=16*1024*1024){
  if(!isListingImage(data,maxLength))throw new Error('Backup images must contain local PNG, JPEG or WebP data.');
  const dimensions=imageDimensions(bytesFromData(data,25*1024*1024));
  if(!dimensions.width||!dimensions.height||dimensions.width*dimensions.height>40_000_000)throw new Error('A backup image exceeds 40 megapixels.');
  return dimensions;
}
function parseReference(input:unknown,floors:Set<string>):BackupReference {
  const v=object(input),floorId=text(v.floorId,160);if(!floors.has(floorId))throw new Error('A reference belongs to a missing floor.');
  const referenceId=v.referenceId===undefined?undefined:text(v.referenceId,64);if(referenceId&&!/^[a-f0-9]{64}$/.test(referenceId))throw new Error('Invalid reference version.');
  if(v.status==='missing'||v.status==='omitted')return {floorId,...(referenceId?{referenceId}:{}),status:v.status,reason:text(v.reason,200)};
  if(v.status!=='included')throw new Error('Unknown floor reference status.');
  const page=integer(v.page,1,200),rotation=integer(v.rotation,0,270);if(rotation%90)throw new Error('Invalid reference rotation.');
  const result:BackupReference={floorId,...(referenceId?{referenceId}:{}),status:'included',page,rotation};
  if(v.preview!==undefined){const p=object(v.preview),url=text(p.url,16*1024*1024),dimensions=checkImage(url);
    const width=integer(p.width,1,2400),height=integer(p.height,1,2400),pages=integer(p.pages,1,200);
    if(width!==dimensions.width||height!==dimensions.height||page>pages)throw new Error('Reference image measurements or page do not match.');
    result.preview={url,width,height,pages,name:text(p.name,240)};
  }
  if(v.file!==undefined){const f=object(v.file),name=text(f.name,240),type=text(f.type,80),data=text(f.data,Math.ceil(MAX_FILE_BYTES/3)*4+80);
    const extension=name.split('.').at(-1)?.toLowerCase(),expected=extension==='pdf'?'application/pdf':extension==='png'?'image/png':extension==='webp'?'image/webp':['jpg','jpeg'].includes(extension??'')?'image/jpeg':undefined;
    if(!expected||type!==expected||!data.startsWith(`data:${type};base64,`))throw new Error('Unsupported reference file type.');
    const bytes=bytesFromData(data,MAX_FILE_BYTES);
    if(type==='application/pdf'){if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw new Error('The PDF reference header is invalid.');}
    else {checkImage(data,Math.ceil(MAX_FILE_BYTES/3)*4+80);if(page!==1)throw new Error('An image reference has only one page.');}
    result.file={name,type,data,lastModified:integer(f.lastModified,0,8_640_000_000_000_000)};
  }
  if(!result.preview&&!result.file)throw new Error('An included reference has no file or preview.');
  return result;
}
function parsePersonalBackup(value:unknown,plan:PlanDocumentV1):PersonalAssetBundle|undefined {
  const expected=new Set(personalPhotoIds(plan));
  if(value===undefined)return expected.size?{version:1,assets:[],missing:[...expected]}:undefined;
  const v=object(value);
  if(v.version!==1||!Array.isArray(v.assets)||v.assets.length>MAX_PERSONAL_PHOTOS||!Array.isArray(v.missing)||v.missing.length>1000)throw new Error('Invalid personal photo manifest.');
  const assets=v.assets.map(parsePersonalPhotoAsset),missing=v.missing.map(id=>text(id,80)),seen=new Set<string>();
  for(const id of [...assets.map(a=>a.id),...missing]){if(!expected.has(id)||seen.has(id))throw new Error('This photo manifest contains an unrelated or duplicate record.');seen.add(id);}
  if(seen.size!==expected.size)throw new Error('The photo manifest must include or mark missing every referenced original.');
  if(assets.reduce((sum,a)=>sum+personalAssetBytes(a),0)>MAX_PERSONAL_MEDIA_BYTES)throw new Error('Personal backup photos exceed 64 MB.');
  return {version:1,assets,missing};
}
/** No network, storage writes or model execution. Reuse the established plan/listing validators. */
export function validateProjectBackup(input:unknown):ProjectBackup {
  const v=object(input);
  if(v.format!=='nook-and-nest-project-backup'||v.version!==1)throw new Error('Choose a complete project backup. Older plan-only and listing backups use their existing Import controls.');
  const exportedAt=text(v.exportedAt,40);if(!Number.isFinite(Date.parse(exportedAt)))throw new Error('Invalid backup date.');
  const plan=parsePlan(JSON.stringify(v.plan)),floors=new Set(plan.floors.map(f=>f.id));
  let listing:ListingDocument|undefined;
  if(v.listing!==undefined){listing=parseListing(v.listing);if(listing.planId!==plan.id)throw new Error('The listing belongs to another project.');
    for(const media of listing.media){for(const image of [media.image,media.sourceImage,media.originalImage])if(image)checkImage(image);
      if(media.floorId&&!floors.has(media.floorId))throw new Error('A listing viewpoint refers to a floor missing from this project.');
    }
  }
  if(!Array.isArray(v.references)||v.references.length>20)throw new Error('Invalid reference list.');
  const references=v.references.map(r=>parseReference(r,floors)),ids=new Set(references.map(r=>r.floorId));
  if(ids.size!==references.length)throw new Error('A floor reference is duplicated.');
  const sharedVersions=new Map<string,string>();
  for(const r of references)if(r.referenceId&&r.status==='included'){const value=JSON.stringify({...r,floorId:undefined});if(sharedVersions.has(r.referenceId)&&sharedVersions.get(r.referenceId)!==value)throw new Error('The same reference version has conflicting content.');sharedVersions.set(r.referenceId,value);}
  const allFloors=[...plan.floors,...(plan.layoutAlternatives?.options.flatMap(o=>o.snapshot.floors)??[])];
  if(v.referenceVersions!==undefined&&(!Array.isArray(v.referenceVersions)||v.referenceVersions.length>120))throw new Error('Invalid saved reference versions.');
  const referenceVersions=(v.referenceVersions as unknown[]??[]).map(r=>parseReference(r,new Set(allFloors.map(f=>f.id))));
  const versionIds=new Set(references.flatMap(r=>r.referenceId?[r.referenceId]:[]));
  for(const r of referenceVersions){if(!r.referenceId||versionIds.has(r.referenceId))throw new Error('A reference version is missing or duplicated.');versionIds.add(r.referenceId);}
  for(const floor of allFloors)if(floor.referenceId&&!versionIds.has(floor.referenceId)){referenceVersions.push({floorId:floor.id,referenceId:floor.referenceId,status:'missing',reason:'This saved layout reference is not included in the backup.'});versionIds.add(floor.referenceId);}
  if(size([references,referenceVersions])>MAX_REFERENCE_TOTAL)throw new Error('Floor-plan references exceed the 48 MB combined limit. Export without references or use smaller source files.');
  // Every floor receives an explicit absence record, including hand-edited manifests.
  for(const floor of plan.floors)if(!ids.has(floor.id))references.push({floorId:floor.id,status:'missing',reason:'No saved reference was included for this floor.'});
  const personalAssets=parsePersonalBackup(v.personalAssets,plan);
  const result:ProjectBackup={format:'nook-and-nest-project-backup',version:1,exportedAt,plan,...(listing?{listing}:{}),...(personalAssets?{personalAssets}:{}),references,...(referenceVersions.length?{referenceVersions}:{})};
  if(size(result)>MAX_PROJECT_BACKUP_BYTES)throw new Error('This complete backup exceeds 160 MB.');
  return result;
}
export function parseProjectBackup(json:string):ProjectBackup {
  if(json.length>MAX_PROJECT_BACKUP_BYTES||new TextEncoder().encode(json).byteLength>MAX_PROJECT_BACKUP_BYTES)throw new Error('This complete backup exceeds 160 MB.');
  return validateProjectBackup(JSON.parse(json));
}
const projectsDb=()=>openDB('nook-and-nest',1,{upgrade(db){if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects');}});
const listingDb=()=>openDB('nook-listing-studio',1,{upgrade(db){if(!db.objectStoreNames.contains('listings'))db.createObjectStore('listings');if(!db.objectStoreNames.contains('preferences'))db.createObjectStore('preferences');}});
const referencesDb=()=>openDB('nook-studio-references',1,{upgrade(db){if(!db.objectStoreNames.contains('references'))db.createObjectStore('references');}});
async function savedListing(planId:string):Promise<ListingDocument|undefined>{const db=await listingDb();try{const stored=await db.get('listings',planId);if(stored===undefined)return;const result=parseListing(stored.document??stored);if(result.planId!==planId)throw new Error('The saved listing belongs to another project.');return result;}finally{db.close();}}
async function fileData(file:File):Promise<ReferenceFile>{
  if(!file.size||file.size>MAX_FILE_BYTES)throw new Error('Reference file is empty or too large.');
  const extension=file.name.split('.').at(-1)?.toLowerCase(),type=extension==='pdf'?'application/pdf':extension==='png'?'image/png':extension==='webp'?'image/webp':['jpg','jpeg'].includes(extension??'')?'image/jpeg':'';
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {name:file.name,type,lastModified:file.lastModified,data:`data:${type};base64,${btoa(binary)}`};
}
export async function buildProjectBackup(plan:PlanDocumentV1,options:{listing?:ListingDocument;includeReferences?:boolean}={}):Promise<ProjectBackup>{
  const snapshot=parsePlan(JSON.stringify(plan)),listing=options.listing?parseListing(options.listing):await savedListing(snapshot.id),references:BackupReference[]=[];
  for(const floor of snapshot.floors){
    if(options.includeReferences===false){references.push({floorId:floor.id,status:'omitted',reason:'Reference files were left out when this backup was made.'});continue;}
    try {const value=await loadFloorReference(snapshot.id,floor);
      if(!value?.reference&&!value?.file){references.push({floorId:floor.id,status:'missing',reason:'No saved reference is available on this device.'});continue;}
      const entry={floorId:floor.id,...(floor.referenceId?{referenceId:floor.referenceId}:{}),status:'included',page:value.page,rotation:value.rotation,...(value.reference?{preview:value.reference}:{}),...(value.file?{file:await fileData(value.file)}:{})};
      references.push(parseReference(entry,new Set([floor.id])));
    }catch{references.push({floorId:floor.id,status:'omitted',reason:'This saved reference could not be read or validated. Reimport the source file after restoring.'});}
  }
  const referenceVersions:BackupReference[]=[],seen=new Set(references.flatMap(r=>r.referenceId?[r.referenceId]:[]));
  for(const floor of [...snapshot.floors,...(snapshot.layoutAlternatives?.options.flatMap(o=>o.snapshot.floors)??[])]){
    if(!floor.referenceId||seen.has(floor.referenceId))continue;seen.add(floor.referenceId);
    const absent=(reason:string):BackupReference=>({floorId:floor.id,referenceId:floor.referenceId,status:'omitted',reason});
    if(options.includeReferences===false){referenceVersions.push(absent('Reference versions were left out when this backup was made.'));continue;}
    try{const value=await loadReferenceVersion(snapshot.id,floor.referenceId);if(!value){referenceVersions.push(absent('This saved layout reference is not available on this device.'));continue;}
      referenceVersions.push(parseReference({floorId:floor.id,referenceId:floor.referenceId,status:'included',page:value.page,rotation:value.rotation,...(value.reference?{preview:value.reference}:{}),...(value.file?{file:await fileData(value.file)}:{})},new Set([floor.id])));
    }catch{referenceVersions.push(absent('The saved layout reference could not be read or validated.'));}
  }
  const personalAssets=await exportPersonalAssets(snapshot);
  return validateProjectBackup({personalAssets,format:'nook-and-nest-project-backup',version:1,exportedAt:new Date().toISOString(),plan:snapshot,...(listing?{listing}:{}),references,referenceVersions});
}
export function backupNotices(backup:ProjectBackup):string[]{
  const notices=[...backup.references,...(backup.referenceVersions??[])].flatMap(r=>{const floor=backup.plan.floors.find(f=>f.id===r.floorId)?.name??'Saved layout floor';if(r.status!=='included')return [`${floor}: ${r.reason}`];if(!r.file)return [`${floor}: Only the saved preview is available; the original reference document is not included.`];if(!r.preview)return [`${floor}: The source document is preserved, but no preview is available. Reimport it in Floor plan studio if needed.`];return [];});
  if(backup.personalAssets?.missing.length)notices.push(`${backup.personalAssets.missing.length} private furniture photo(s) are missing. Measurements and notes are preserved.`);
  return notices;
}

/** Publish the new plan last. Independent databases cannot share an atomic transaction. */
export async function restoreProjectBackup(input:ProjectBackup):Promise<PlanDocumentV1>{
  const backup=validateProjectBackup(input),now=new Date().toISOString(),id=crypto.randomUUID();
  if(backup.personalAssets)await validatePersonalAssetBundle(backup.personalAssets);
  const plan={...backup.plan,id,name:`${backup.plan.name.slice(0,145)} · restored`,createdAt:now,updatedAt:now};
  // Floor/object IDs remain project-scoped, preserving stairs, blueprint keys and alternatives.
  const listing=backup.listing?parseListing({...backup.listing,planId:id,updatedAt:now,media:backup.listing.media.map(m=>({...m,id:crypto.randomUUID()}))}):undefined;
  const restoredReferences=[...new Map([...backup.references,...(backup.referenceVersions??[])].flatMap(r=>r.status==='included'?[{key:JSON.stringify(r.referenceId?[id,'version',r.referenceId]:[id,r.floorId]),value:{page:r.page,rotation:r.rotation,...(r.preview?{reference:r.preview}:{}),...(r.file?{file:new File([bytesFromData(r.file.data,MAX_FILE_BYTES) as BlobPart],r.file.name,{type:r.file.type,lastModified:r.file.lastModified})}:{})}}]:[]).map(r=>[r.key,r])).values()];
  const p=await projectsDb();let listingWritten=false,referencesWritten=false,photosImported=false;
  try {
    if(await p.get('projects','project:'+id))throw new Error('Could not allocate a new project identity. Please try again.');
    if(backup.personalAssets?.assets.length){await importPersonalAssets(backup.personalAssets);photosImported=true;}
    if(listing){const db=await listingDb();try{await db.add('listings',{revision:1,document:listing},id);listingWritten=true;}finally{db.close();}}
    if(restoredReferences.length){const db=await referencesDb();try{const tx=db.transaction('references','readwrite');try{for(const r of restoredReferences)await tx.store.add(r.value,r.key);await tx.done;referencesWritten=true;}catch(e){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw e;}}finally{db.close();}}
    await p.add('projects',plan,'project:'+id);
    // Leave the current active pointer untouched; the caller opens the durable new copy.
    return plan;
  } catch(error){
    const failures:unknown[]=[];
    if(referencesWritten)try{const db=await referencesDb();try{const tx=db.transaction('references','readwrite');for(const r of restoredReferences)await tx.store.delete(r.key);await tx.done;}finally{db.close();}}catch(e){failures.push(e);}
    if(listingWritten)try{const db=await listingDb();try{await db.delete('listings',id);}finally{db.close();}}catch(e){failures.push(e);}
    if(failures.length)throw new Error('The new project was not created. Some temporary media could not be removed; existing projects are unchanged. Free browser storage and retry.');
    if(photosImported)throw new Error(`The new project was not created. Imported photos remain in your private cache and can be managed under My furniture. ${error instanceof Error?error.message:''}`);
    throw error;
  } finally {p.close();}
}
