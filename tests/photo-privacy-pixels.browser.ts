// Browser acceptance helper: import from the local Vite preview, then await
// verifyPhotoPrivacyPixels(). This intentionally uses the browser's real codec.
import {flattenPhotoPrivacy,type PhotoPrivacyRecipe} from '../src/photoPrivacy';

export async function verifyPhotoPrivacyPixels(){
 const assert=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
 const base=document.createElement('canvas');base.width=80;base.height=64;
 const ctx=base.getContext('2d')!;ctx.fillStyle='#f02020';ctx.fillRect(0,0,40,32);ctx.fillStyle='#20f020';ctx.fillRect(40,0,40,32);ctx.fillStyle='#f0f020';ctx.fillRect(0,32,40,32);ctx.fillStyle='#2020f0';ctx.fillRect(40,32,40,32);
 // JPEG COM is real embedded metadata. Keep it in the private source and prove
 // the fresh raster contains neither it nor EXIF while checking real pixels.
 const sentinel='MUST_NOT_APPEAR_IN_REVIEWED_COPY',plain=atob(base.toDataURL('image/jpeg',1).split(',')[1]),comment=String.fromCharCode(255,254,0,sentinel.length+2)+sentinel;
 const source='data:image/jpeg;base64,'+btoa(plain.slice(0,2)+comment+plain.slice(2));
 const outputs:Array<{turns:number;width:number;height:number;masked:number[];unmasked:number[]}>=[];
 try{for(const turns of [0,1,2,3] as const){
  const recipe:PhotoPrivacyRecipe={width:80,height:64,crop:{x:4,y:4,width:64,height:52},turns,masks:[{x:8,y:8,width:24,height:20}]};
  const derivative=await flattenPhotoPrivacy(source,recipe),binary=atob(derivative.split(',')[1]);assert(!binary.includes(sentinel),'Source metadata survived flattening');assert(!binary.includes('Exif\0\0'),'EXIF survived flattening');
  const image=new Image();image.src=derivative;await image.decode();const output=document.createElement('canvas');output.width=image.naturalWidth;output.height=image.naturalHeight;const pixels=output.getContext('2d')!;pixels.drawImage(image,0,0);
  const sample=(sx:number,sy:number)=>{const x=sx-recipe.crop.x,y=sy-recipe.crop.y,w=recipe.crop.width,h=recipe.crop.height;const p=turns===1?[h-y,x]:turns===2?[w-x,h-y]:turns===3?[y,w-x]:[x,y];return Array.from(pixels.getImageData(Math.floor(p[0]),Math.floor(p[1]),1,1).data);};
  const masked=sample(20.5,18.5),unmasked=sample(52.5,18.5);assert(masked.slice(0,3).every(c=>c<8)&&masked[3]===255,`Mask leaked pixels at rotation ${turns}`);assert(unmasked[1]>200&&unmasked[0]<65&&unmasked[2]<65,`Unmasked source pixels moved incorrectly at rotation ${turns}`);
  assert(output.width===(turns%2?52:64)&&output.height===(turns%2?64:52),`Crop dimensions incorrect at rotation ${turns}`);outputs.push({turns,width:output.width,height:output.height,masked,unmasked});image.src='';output.width=output.height=0;
 }
 assert(atob(source.split(',')[1]).includes(sentinel),'Private original metadata changed');return {passed:true,checks:outputs,sourceMetadataPreserved:true,derivativeMetadataRemoved:true};
 }finally{base.width=base.height=0;}
}
