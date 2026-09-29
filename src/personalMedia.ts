import {imageDimensions} from './imageDimensions';
import {isListingImage} from './listingTypes';
import {PERSONAL_PHOTO_ID} from './personalItems';

export const MAX_PERSONAL_PHOTO_BYTES=5*1024*1024;
export const MAX_PERSONAL_PREVIEW_BYTES=300*1024;
export const MAX_PERSONAL_MEDIA_BYTES=64*1024*1024;
export const MAX_PERSONAL_PHOTOS=100;
export interface PersonalPhotoAsset {version:1;id:string;original:string;preview:string;width:number;height:number;createdAt:string}
const maxEncoded=Math.ceil(MAX_PERSONAL_PHOTO_BYTES/3)*4+64;
export const personalAssetBytes=(asset:PersonalPhotoAsset)=>new TextEncoder().encode(JSON.stringify(asset)).byteLength;
function imageBytes(value:unknown,maxLength:number){
  if(!isListingImage(value,maxLength))throw new Error('Use a local PNG, JPEG or WebP photo.');
  const raw=atob(value.slice(value.indexOf(',')+1)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),dimensions=imageDimensions(bytes);
  if(dimensions.width*dimensions.height>24_000_000||dimensions.width>10000||dimensions.height>10000||!dimensions.width||!dimensions.height)throw new Error('Choose a photo below 24 megapixels and 10,000 pixels per side.');
  return {bytes,...dimensions};
}
export function parsePersonalPhotoAsset(value:unknown):PersonalPhotoAsset {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid personal photo.');
  const a=value as Record<string,unknown>;
  if(a.version!==1||typeof a.id!=='string'||!PERSONAL_PHOTO_ID.test(a.id)||typeof a.createdAt!=='string'||a.createdAt.length>40||!Number.isFinite(Date.parse(a.createdAt)))throw new Error('Invalid personal photo record.');
  const original=imageBytes(a.original,maxEncoded),preview=imageBytes(a.preview,MAX_PERSONAL_PREVIEW_BYTES);
  if(original.bytes.length>MAX_PERSONAL_PHOTO_BYTES||original.width!==a.width||original.height!==a.height||Math.max(preview.width,preview.height)>512)throw new Error('The personal photo or its preview is too large or has incorrect dimensions.');
  return {version:1,id:a.id,original:a.original as string,preview:a.preview as string,width:original.width,height:original.height,createdAt:a.createdAt};
}
async function digest(bytes:Uint8Array){return 'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyPersonalPhotoAsset(value:unknown):Promise<PersonalPhotoAsset>{const asset=parsePersonalPhotoAsset(value);if(await digest(imageBytes(asset.original,maxEncoded).bytes)!==asset.id)throw new Error('This personal photo does not match its saved fingerprint.');return asset;}
/** Retains the bounded original locally; the small canvas preview contains no original EXIF metadata. */
export async function preparePersonalPhoto(file:File):Promise<PersonalPhotoAsset>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>MAX_PERSONAL_PHOTO_BYTES)throw new Error('Choose a PNG, JPEG or WebP photo up to 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const original=`data:${file.type};base64,${btoa(binary)}`,dimensions=imageBytes(original,maxEncoded),id=await digest(bytes);
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error('This photo could not be opened.'));element.src=original;});
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Photo previews are unavailable in this browser.');
  context.fillStyle='#eee9de';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const preview=canvas.toDataURL('image/jpeg',.82);
  return parsePersonalPhotoAsset({version:1,id,original,preview,width:dimensions.width,height:dimensions.height,createdAt:new Date().toISOString()});
}
