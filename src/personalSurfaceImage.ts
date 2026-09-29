import {parsePersonalPhotoAsset,type PersonalPhotoAsset} from './personalMedia';
import {parsePersonalSurface,type PersonalSurface} from './moodboards';

/** Immutable cache recipe. Include project identity in the renderer's cache key too. */
export function personalSurfaceImageKey(input:PersonalSurface){const s=parsePersonalSurface(input);return JSON.stringify([s.assetId??'hidden',s.kind,s.crop,s.rotation,s.fallbackColor]);}
export function personalSurfaceRepeat(input:PersonalSurface,widthMm:number,heightMm:number){
  const s=parsePersonalSurface(input);if(![widthMm,heightMm].every(n=>Number.isFinite(n)&&n>0&&n<=50000))throw new Error('Invalid physical surface dimensions.');
  return s.kind==='swatch'?{uScale:widthMm/s.repeatWidthMm!,vScale:heightMm/s.repeatHeightMm!}:{uScale:1,vScale:1};
}
/** Produces at most one 1,024px canvas. Never mutates originals, source textures or saved settings. */
export async function renderPersonalSurfaceImage(input:PersonalSurface,photo?:PersonalPhotoAsset,maxPixels=1024,previewOnly=false,signal?:AbortSignal):Promise<{canvas:HTMLCanvasElement;missing:boolean}> {
  const surface=parsePersonalSurface(input);if(!Number.isInteger(maxPixels)||maxPixels<64||maxPixels>1024)throw new Error('Use a texture size from 64 to 1,024 pixels.');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=Math.min(512,maxPixels);let context=canvas.getContext('2d');if(!context)throw new Error('Image preview is unavailable.');
  context.fillStyle=surface.fallbackColor;context.fillRect(0,0,canvas.width,canvas.height);
  if(surface.hidden||!photo||photo.id!==surface.assetId)return {canvas,missing:true};
  let asset:PersonalPhotoAsset,image:HTMLImageElement;
  try {asset=parsePersonalPhotoAsset(photo);image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image(),cleanup=()=>{img.onload=null;img.onerror=null;signal?.removeEventListener('abort',abort)},abort=()=>{cleanup();img.src='';reject(new DOMException('Image preview cancelled.','AbortError'))};if(signal?.aborted){abort();return;}img.onload=()=>{cleanup();resolve(img)};img.onerror=()=>{cleanup();reject(new Error('This private image could not be opened.'))};signal?.addEventListener('abort',abort,{once:true});img.src=previewOnly?asset.preview:asset.original;});}
  catch(error){if(signal?.aborted)throw error;return {canvas,missing:true};}
  const {x,y,width,height}=surface.crop,sourceW=Math.max(1,width*image.naturalWidth),sourceH=Math.max(1,height*image.naturalHeight),turned=surface.rotation===90||surface.rotation===270,outputW=turned?sourceH:sourceW,outputH=turned?sourceW:sourceH,scale=Math.min(1,maxPixels/Math.max(outputW,outputH));
  canvas.width=Math.max(1,Math.round(outputW*scale));canvas.height=Math.max(1,Math.round(outputH*scale));context=canvas.getContext('2d');if(!context)throw new Error('Image preview is unavailable.');
  context.fillStyle=surface.fallbackColor;context.fillRect(0,0,canvas.width,canvas.height);context.translate(canvas.width/2,canvas.height/2);context.rotate(surface.rotation*Math.PI/180);
  context.drawImage(image,x*image.naturalWidth,y*image.naturalHeight,sourceW,sourceH,-sourceW*scale/2,-sourceH*scale/2,sourceW*scale,sourceH*scale);
  return {canvas,missing:false};
}
