import {imageDimensions} from './imageDimensions';
import {isListingImage,type ListingMedia} from './listingTypes';

export interface PhotoRect {x:number;y:number;width:number;height:number}
export interface PhotoPrivacyRecipe {width:number;height:number;crop:PhotoRect;turns:0|1|2|3;masks:PhotoRect[]}
export interface PhotoPrivacy {version:1;sourceKey:string;recipe:PhotoPrivacyRecipe;image:string;reviewedAt:string;selected:boolean}
export const MAX_PHOTO_MASKS=80;
const fail=()=>{throw new Error('This photo privacy copy is invalid. Reopen the original and review a new copy.');};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
/** Local change detector, not a signature or a claim that a photo was reviewed. */
export function photoSourceKey(image:string){let a=2166136261,b=0x9e3779b9;for(let i=0;i<image.length;i++){const c=image.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519);}return `${image.length}-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;}
function rect(value:unknown,width:number,height:number):PhotoRect{
 if(!object(value)||!exact(value,['x','y','width','height']))return fail();
 const r=value as unknown as PhotoRect;
 if(![r.x,r.y,r.width,r.height].every(Number.isSafeInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>width||r.y+r.height>height)return fail();
 return {x:r.x,y:r.y,width:r.width,height:r.height};
}
export function parsePhotoRecipe(value:unknown):PhotoPrivacyRecipe{
 if(!object(value)||!exact(value,['width','height','crop','turns','masks']))return fail();
 const {width,height,turns,masks}=value;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||Number(width)<1||Number(height)<1||Number(width)>1600||Number(height)>1600||![0,1,2,3].includes(Number(turns))||typeof turns!=='number'||!Array.isArray(masks)||masks.length>MAX_PHOTO_MASKS)return fail();
 return {width:Number(width),height:Number(height),crop:rect(value.crop,Number(width),Number(height)),turns:turns as PhotoPrivacyRecipe['turns'],masks:masks.map(r=>rect(r,Number(width),Number(height)))};
}
export function photoDimensions(image:string){
 if(!isListingImage(image,3*1024*1024))throw new Error('Choose a saved local photo below 3 MB.');
 const bytes=Uint8Array.from(atob(image.slice(image.indexOf(',')+1)),c=>c.charCodeAt(0)),size=imageDimensions(bytes);
 if(!size.width||!size.height||size.width>1600||size.height>1600)throw new Error('Choose a photo preview up to 1,600 pixels per side.');
 return size;
}
export function blankPhotoRecipe(image:string):PhotoPrivacyRecipe{const {width,height}=photoDimensions(image);return {width,height,crop:{x:0,y:0,width,height},turns:0,masks:[]};}
export function parsePhotoPrivacy(value:unknown):PhotoPrivacy{
 if(!object(value)||!exact(value,['version','sourceKey','recipe','image','reviewedAt','selected'])||value.version!==1||typeof value.sourceKey!=='string'||!/^\d{1,8}-[a-f0-9]{1,8}-[a-f0-9]{1,8}$/.test(value.sourceKey)||!isListingImage(value.image,3*1024*1024)||typeof value.reviewedAt!=='string'||value.reviewedAt.length>40||!Number.isFinite(Date.parse(value.reviewedAt))||typeof value.selected!=='boolean')return fail();
 const recipe=parsePhotoRecipe(value.recipe),size=photoDimensions(value.image),output=photoOutputSize(recipe);
 if(size.width!==output.width||size.height!==output.height)return fail();
 return {version:1,sourceKey:value.sourceKey,recipe,image:value.image,reviewedAt:value.reviewedAt,selected:value.selected};
}
export function photoOutputSize(recipe:PhotoPrivacyRecipe){return recipe.turns%2?{width:recipe.crop.height,height:recipe.crop.width}:{width:recipe.crop.width,height:recipe.crop.height};}
/** Map displayed crop/rotation coordinates back into the unchanged source preview. */
export function photoSourcePoint(recipe:PhotoPrivacyRecipe,x:number,y:number){
 const u=Math.max(0,Math.min(1,x)),v=Math.max(0,Math.min(1,y));
 const [a,b]=recipe.turns===1?[v,1-u]:recipe.turns===2?[1-u,1-v]:recipe.turns===3?[1-v,u]:[u,v];
 return {x:recipe.crop.x+a*recipe.crop.width,y:recipe.crop.y+b*recipe.crop.height};
}
export function photoMaskBetween(recipe:PhotoPrivacyRecipe,a:{x:number;y:number},b:{x:number;y:number}):PhotoRect{
 const x=Math.max(0,Math.floor(Math.min(a.x,b.x))),y=Math.max(0,Math.floor(Math.min(a.y,b.y)));
 return rect({x:Math.min(x,recipe.width-1),y:Math.min(y,recipe.height-1),width:Math.max(1,Math.min(recipe.width,Math.ceil(Math.max(a.x,b.x)))-Math.min(x,recipe.width-1)),height:Math.max(1,Math.min(recipe.height,Math.ceil(Math.max(a.y,b.y)))-Math.min(y,recipe.height-1))},recipe.width,recipe.height);
}
/** A fresh opaque raster: source EXIF/GPS metadata and editable mask layers are never copied. */
export function drawPhotoPrivacy(canvas:HTMLCanvasElement,image:CanvasImageSource,recipeValue:PhotoPrivacyRecipe){
 const recipe=parsePhotoRecipe(recipeValue),size=photoOutputSize(recipe),{crop,turns}=recipe;
 canvas.width=size.width;canvas.height=size.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo editing is unavailable in this browser.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size.width,size.height);ctx.save();
 if(turns===1)ctx.translate(size.width,0);else if(turns===2)ctx.translate(size.width,size.height);else if(turns===3)ctx.translate(0,size.height);
 ctx.rotate(turns*Math.PI/2);ctx.translate(-crop.x,-crop.y);ctx.drawImage(image,0,0,recipe.width,recipe.height);
 ctx.fillStyle='#000000';for(const mask of recipe.masks)ctx.fillRect(mask.x,mask.y,mask.width,mask.height);ctx.restore();
}
export async function flattenPhotoPrivacy(source:string,recipeValue:PhotoPrivacyRecipe):Promise<string>{
 const recipe=parsePhotoRecipe(recipeValue),size=photoDimensions(source);
 if(size.width!==recipe.width||size.height!==recipe.height)throw new Error('The source photo changed. Open a new privacy review.');
 const image=new Image(),canvas=document.createElement('canvas');
 try{image.src=source;await image.decode();if(image.naturalWidth!==size.width||image.naturalHeight!==size.height)throw new Error('The photo dimensions changed during decoding.');drawPhotoPrivacy(canvas,image,recipe);const output=canvas.toDataURL('image/jpeg',.94);if(!isListingImage(output,3*1024*1024))throw new Error('This privacy copy is too large. Crop the photo and try again.');return output;}
 finally{image.src='';canvas.width=canvas.height=0;}
}
export function reviewedPhotoPrivacy(source:string,recipe:PhotoPrivacyRecipe,image:string):PhotoPrivacy{return parsePhotoPrivacy({version:1,sourceKey:photoSourceKey(source),recipe,image,reviewedAt:new Date().toISOString(),selected:false});}
export function listingPreviewImage(media:ListingMedia):string{return media.privacy?.image??media.image;}
export function listingOutputImage(media:ListingMedia):string{
 if(!media.privacy)return media.image;
 const privacy=parsePhotoPrivacy(media.privacy);
 if(privacy.sourceKey!==photoSourceKey(media.image))throw new Error(`Review ${media.title || 'this photo'} again: its source image changed.`);
 if(!privacy.selected)throw new Error(`Choose the reviewed privacy copy for ${media.title || 'this photo'} in Photos & slides before exporting or sharing.`);
 return privacy.image;
}
