import {isListingImage,type ListingMedia} from './listingTypes';

export function downloadListingFile(name:string,content:Blob|string,type='application/json'){
  const blob=typeof content==='string'?new Blob([content],{type}):content;
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
export function loadListingImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{if(!isListingImage(src)){reject(new Error('Use a local JPG, PNG or WebP image.'));return;}const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('This image could not be opened.'));image.src=src;});}
export async function importListingPhoto(file:File):Promise<ListingMedia>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG or WebP photo up to 10 MB.');
  const sourceImage=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this photo.'));reader.onabort=()=>reject(new Error('Photo import was cancelled.'));reader.readAsDataURL(file)});
  if(!isListingImage(sourceImage))throw new Error('Unsupported or damaged photo.');
  return {id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,160)||'Property photo',caption:'',kind:'photo',image:await normalizeListingImage(sourceImage),sourceImage,seconds:5};
}
export function pairListingOriginal(media:ListingMedia,photo:ListingMedia):ListingMedia {
  const originalImage=photo.sourceImage??photo.image;
  if(!isListingImage(originalImage)||!isListingImage(photo.image))throw new Error('Choose a valid original property photo.');
  if(originalImage===media.sourceImage||originalImage===media.image||photo.image===media.image)throw new Error('This is the same image as the slide. Choose the unaltered property photo for comparison.');
  return {...media,sourceImage:media.sourceImage??media.image,originalImage};
}
/** A bounded preview for the browser and provider. The uploaded original stays unchanged. */
export async function normalizeListingImage(src:string){
  const image=await loadListingImage(src);
  if(!Number.isFinite(image.naturalWidth)||!Number.isFinite(image.naturalHeight)||image.naturalWidth<1||image.naturalHeight<1)throw new Error('This photo has invalid dimensions.');
  if(image.naturalWidth*image.naturalHeight>60_000_000||image.naturalWidth>16000||image.naturalHeight>16000)throw new Error('This image is too large. Choose a photo below 60 megapixels and 16,000 pixels per side.');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable.');ctx.fillStyle='#eee9de';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.88);
  if(!isListingImage(result,3*1024*1024))throw new Error('This photo could not be reduced to a supported preview.');
  return result;
}
