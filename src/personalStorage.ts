import {openDB} from 'idb';
import {MAX_PERSONAL_ITEMS,PERSONAL_PHOTO_ID,parsePersonalCollectionItem,personalPhotoIds,type PersonalCollectionItem} from './personalItems';
import {MAX_PERSONAL_MEDIA_BYTES,MAX_PERSONAL_PHOTOS,parsePersonalPhotoAsset,personalAssetBytes,verifyPersonalPhotoAsset,type PersonalPhotoAsset} from './personalMedia';
import type {PlanDocumentV1} from './types';

function notifyPersonalMedia(){if(typeof window==='undefined')return;window.dispatchEvent(new Event('nook-private-media-change'));if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('nook-private-media');channel.postMessage({changed:true});channel.close();}}
export const PERSONAL_DATABASE='nook-personal-furniture';
const database=()=>openDB(PERSONAL_DATABASE,1,{upgrade(db){db.createObjectStore('items',{keyPath:'id'});db.createObjectStore('photos',{keyPath:'id'});db.createObjectStore('meta');}});
export interface StoredPersonalPhoto {id:string;preview:string;bytes:number}
/** Read originals one at a time; the optional storage manager only retains small previews. */
export async function listStoredPersonalPhotos():Promise<StoredPersonalPhoto[]>{const db=await database();try{const result:StoredPersonalPhoto[]=[];for(const id of await db.getAllKeys('photos')){const stored=await db.get('photos',id);if(!stored)continue;const asset=parsePersonalPhotoAsset(stored);result.push({id:asset.id,preview:asset.preview,bytes:personalAssetBytes(asset)});}return result;}finally{db.close();}}
export async function listPersonalItems():Promise<PersonalCollectionItem[]>{const db=await database();try{return (await db.getAll('items')).map(parsePersonalCollectionItem).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}finally{db.close();}}
export async function loadPersonalPhoto(id:string):Promise<PersonalPhotoAsset|undefined>{if(!PERSONAL_PHOTO_ID.test(id))throw new Error('Invalid photo identity.');const db=await database();try{const asset=await db.get('photos',id);return asset?parsePersonalPhotoAsset(asset):undefined;}finally{db.close();}}
/** One readwrite transaction prevents quota races and lost updates across browser tabs. */
export async function savePersonalItem(input:PersonalCollectionItem,photo?:PersonalPhotoAsset):Promise<PersonalCollectionItem>{
  const item=parsePersonalCollectionItem(input),asset=photo?await verifyPersonalPhotoAsset(photo):undefined;
  if(asset&&item.photoAssetId!==asset.id)throw new Error('The selected photo belongs to a different item draft.');
  const db=await database(),tx=db.transaction(['items','photos','meta'],'readwrite');
  try {
    const items=tx.objectStore('items'),photos=tx.objectStore('photos'),meta=tx.objectStore('meta'),previous=await items.get(item.id);
    if(previous?previous.revision!==item.revision:item.revision!==0)throw new Error('This item changed in another tab. Refresh your collection before saving.');
    if(!previous&&await items.count()>=MAX_PERSONAL_ITEMS)throw new Error('Your collection holds up to 100 items. Remove an unused collection item first.');
    const existingPhoto=item.photoAssetId?await photos.get(item.photoAssetId):undefined;
    if(item.photoAssetId&&!existingPhoto&&!asset)throw new Error('This photo is missing on this device. Choose it again or remove the photo reference.');
    if(asset&&!existingPhoto){const total=(await meta.get('photoBytes')??0)+personalAssetBytes(asset);if(total>MAX_PERSONAL_MEDIA_BYTES||await photos.count()>=MAX_PERSONAL_PHOTOS)throw new Error('Private photos have reached the 64 MB or 100-photo limit. Back up your work, then remove stored photos to make room.');await photos.add(asset);await meta.put(total,'photoBytes');}
    const saved={...item,revision:item.revision+1,createdAt:previous?.createdAt??item.createdAt,updatedAt:new Date().toISOString()};
    await items.put(saved);await tx.done;if(asset)notifyPersonalMedia();return saved;
  }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw error;}finally{db.close();}
}
/** Placed copies keep their immutable metadata and photo refs; removal is collection-only. */
export async function deletePersonalItem(id:string,expectedRevision:number):Promise<void>{
  const db=await database(),tx=db.transaction('items','readwrite');try{const current=await tx.store.get(id);if(!current||current.revision!==expectedRevision)throw new Error('This item changed. Refresh before removing it.');await tx.store.delete(id);await tx.done;}catch(e){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw e;}finally{db.close();}
}
export interface PersonalAssetBundle {version:1;assets:PersonalPhotoAsset[];missing:string[]}
export async function exportPersonalAssets(plan:PlanDocumentV1):Promise<PersonalAssetBundle>{const ids=personalPhotoIds(plan),assets:PersonalPhotoAsset[]=[],missing:string[]=[];for(const id of ids){const asset=await loadPersonalPhoto(id);if(asset)assets.push(asset);else missing.push(id);}return {version:1,assets,missing};}
export async function validatePersonalAssetBundle(value:unknown):Promise<PersonalAssetBundle>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid personal photo package.');const v=value as Record<string,unknown>;
  if(v.version!==1||!Array.isArray(v.assets)||v.assets.length>MAX_PERSONAL_PHOTOS||!Array.isArray(v.missing)||v.missing.length>1000||v.missing.some(id=>typeof id!=='string'||!PERSONAL_PHOTO_ID.test(id)))throw new Error('Invalid or oversized personal photo package.');
  let bytes=0;const assets:PersonalPhotoAsset[]=[];for(const input of v.assets){const asset=await verifyPersonalPhotoAsset(input);bytes+=personalAssetBytes(asset);if(bytes>MAX_PERSONAL_MEDIA_BYTES)throw new Error('Personal backup photos exceed 64 MB.');assets.push(asset);}
  const ids=new Set(assets.map(a=>a.id));if(ids.size!==assets.length||v.missing.some(id=>ids.has(id as string)))throw new Error('Duplicate or conflicting photo records in the backup.');
  return {version:1,assets,missing:[...new Set(v.missing as string[])]};
}
/** Prevalidate alongside the rest of NN-29 before staging any project writes. Content-addressed IDs survive restore. */
export async function importPersonalAssets(input:PersonalAssetBundle):Promise<void>{
  const bundle=await validatePersonalAssetBundle(input),db=await database(),tx=db.transaction(['photos','meta'],'readwrite');
  try {const photos=tx.objectStore('photos'),meta=tx.objectStore('meta');let total=await meta.get('photoBytes')??0,count=await photos.count();for(const asset of bundle.assets){if(await photos.get(asset.id))continue;total+=personalAssetBytes(asset);count++;if(total>MAX_PERSONAL_MEDIA_BYTES||count>MAX_PERSONAL_PHOTOS)throw new Error('Restoring these private photos would exceed device storage limits.');await photos.add(asset);}await meta.put(total,'photoBytes');await tx.done;notifyPersonalMedia();}
  catch(e){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw e;}finally{db.close();}
}
/** Explicit destructive photo removal: placed copies then show a missing-photo placeholder. */
export async function removeStoredPersonalPhoto(id:string):Promise<void>{
  if(!PERSONAL_PHOTO_ID.test(id))throw new Error('Invalid photo identity.');const db=await database(),tx=db.transaction(['photos','meta'],'readwrite');
  try{const photos=tx.objectStore('photos'),meta=tx.objectStore('meta'),asset=await photos.get(id);if(asset){await photos.delete(id);await meta.put(Math.max(0,(await meta.get('photoBytes')??0)-personalAssetBytes(parsePersonalPhotoAsset(asset))),'photoBytes');}await tx.done;notifyPersonalMedia();}catch(e){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw e;}finally{db.close();}
}
