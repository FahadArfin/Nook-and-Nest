import {parseSceneAtmosphere,type SceneAtmosphereV1} from './sceneAtmosphere';
import {validCameraShot, type CameraShotPose} from './walkthrough';

export type ListingFormat = 'landscape' | 'portrait' | 'square';
export type MediaKind = 'photo' | 'render' | 'staged' | 'concept';
export interface ListingDetails {
  title:string; address:string; price:string; beds:string; baths:string; area:string;
  highlights:string; description:string; agentName:string; agentEmail:string; agentPhone:string; agency:string;
}
export interface ListingMedia {
  id:string; title:string; caption:string; kind:MediaKind; image:string;
  /** Raw uploaded source; it may already contain staging and is not an unstaged comparison. */
  sourceImage?:string;
  /** A separately paired, unaltered property photo. */
  originalImage?:string;
  atmosphere?:SceneAtmosphereV1; camera?:CameraShotPose; floorId?:string; seconds:number;
}
export interface ListingDocument {
  version:1; planId:string; details:ListingDetails; media:ListingMedia[];
  format:ListingFormat; branded:boolean; updatedAt:string;
}
export const MAX_LISTING_MEDIA = 24;
export const MAX_LISTING_BYTES = 100 * 1024 * 1024;
export const mediaLabels:Record<MediaKind,string> = {photo:'Property photo',render:'3D design render',staged:'Virtually staged',concept:'AI design concept'};
export const blankListingDetails:ListingDetails = {title:'',address:'',price:'',beds:'',baths:'',area:'',highlights:'',description:'',agentName:'',agentEmail:'',agentPhone:'',agency:''};
export function createListing(planId:string,title:string):ListingDocument {
  return {version:1,planId,details:{...blankListingDetails,title},media:[],format:'landscape',branded:false,updatedAt:new Date().toISOString()};
}
export function isListingImage(value:unknown,maxBytes=16*1024*1024):value is string {
  if(typeof value!=='string'||value.length>maxBytes)return false;
  const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length%4!==0)return false;
  try{
    const header=atob(match[2].slice(0,64));
    return match[1]==='png'?[137,80,78,71,13,10,26,10].every((byte,i)=>header.charCodeAt(i)===byte)
      :match[1]==='jpeg'?header.charCodeAt(0)===255&&header.charCodeAt(1)===216&&header.charCodeAt(2)===255
      :header.startsWith('RIFF')&&header.slice(8,12)==='WEBP';
  }catch{return false;}
}
export function hasPairedOriginal(media:ListingMedia):boolean {return !!media.originalImage&&media.originalImage!==media.image&&media.originalImage!==media.sourceImage;}
/** Whitelist imported fields; a backup never changes a home or executes remote media. */
export function parseListing(value:unknown,planId?:string):ListingDocument {
  if(!value||typeof value!=='object')throw new Error('This is not a listing backup.');
  const d=value as ListingDocument;
  if(d.version!==1||typeof d.planId!=='string'||!d.planId||d.planId.length>160||planId!==undefined&&(typeof planId!=='string'||!planId||planId.length>160)||!d.details||typeof d.details!=='object'||Array.isArray(d.details)||!Array.isArray(d.media)||d.media.length>MAX_LISTING_MEDIA||!['landscape','portrait','square'].includes(d.format)||typeof d.branded!=='boolean'||typeof d.updatedAt!=='string'||d.updatedAt.length>40||!Number.isFinite(Date.parse(d.updatedAt)))throw new Error('Unsupported or invalid listing backup.');
  const details={...blankListingDetails};
  for(const key of Object.keys(details) as (keyof ListingDetails)[]){if(typeof d.details[key]!=='string'||d.details[key].length>4000)throw new Error('Listing text is invalid or too long.');details[key]=d.details[key];}
  const ids=new Set<string>();let imageBytes=0;
  const media=d.media.map(m=>{
    if(!m||typeof m.id!=='string'||!m.id||m.id.length>100||ids.has(m.id)||typeof m.title!=='string'||m.title.length>160||typeof m.caption!=='string'||m.caption.length>1000||!Object.hasOwn(mediaLabels,m.kind)||!isListingImage(m.image,3*1024*1024)||!Number.isFinite(m.seconds)||m.seconds<2||m.seconds>20)throw new Error('A slide is invalid.');
    ids.add(m.id);imageBytes+=m.image.length;
    if(m.originalImage!==undefined){if(!isListingImage(m.originalImage))throw new Error('A source photo is invalid.');imageBytes+=m.originalImage.length;}
    if(m.sourceImage!==undefined){if(!isListingImage(m.sourceImage))throw new Error('An uploaded source photo is invalid.');imageBytes+=m.sourceImage.length;}
    const atmosphere=m.atmosphere===undefined?undefined:parseSceneAtmosphere(m.atmosphere);if(m.atmosphere!==undefined&&!atmosphere)throw new Error('A saved lighting mood is invalid.');
    if(m.camera!==undefined&&!validCameraShot(m.camera))throw new Error('A saved viewpoint is invalid.');
    if(m.camera&&m.kind==='photo')throw new Error('A captured 3D view must remain labeled as a render or design concept.');
    if(m.floorId!==undefined&&(typeof m.floorId!=='string'||!m.floorId||m.floorId.length>100)||m.camera&&(m.camera.floorId.length>100||m.floorId!==undefined&&m.floorId!==m.camera.floorId))throw new Error('A saved floor is invalid or conflicts with its viewpoint.');
    const camera=m.camera?{version:1 as const,kind:m.camera.kind,floorId:m.camera.floorId,target:{x:m.camera.target.x,y:m.camera.target.y,z:m.camera.target.z},alpha:m.camera.alpha,beta:m.camera.beta,radius:m.camera.radius,mode:m.camera.mode,fov:m.camera.fov}:undefined;
    const floorId=camera?.floorId??m.floorId;
    // Earlier local drafts put the raw upload in originalImage. Keep its bytes without claiming it is unstaged.
    const legacySource=!camera&&m.sourceImage===undefined&&m.originalImage!==undefined;
    const sourceImage=legacySource?m.originalImage:m.sourceImage,originalImage=legacySource?undefined:m.originalImage;
    return {id:m.id,title:m.title,caption:m.caption,kind:m.kind,image:m.image,seconds:m.seconds,...(originalImage?{originalImage}:{}),...(sourceImage?{sourceImage}:{}),...(camera?{camera}:{}),...(atmosphere?{atmosphere}:{}),...(floorId?{floorId}:{})};
  });
  const parsed:ListingDocument={version:1,planId:planId??d.planId,details,media,format:d.format,branded:d.branded,updatedAt:d.updatedAt};
  // Data URLs are ASCII; count the remaining JSON in UTF-8 without copying all photos again.
  const metadata={...parsed,media:media.map(({image,sourceImage,originalImage,...m})=>({...m,image:'',...(sourceImage?{sourceImage:''}:{}),...(originalImage?{originalImage:''}:{})}))};
  if(imageBytes+new TextEncoder().encode(JSON.stringify(metadata)).byteLength>MAX_LISTING_BYTES)throw new Error('Listing media exceeds the 100 MB backup limit.');
  return parsed;
}
export function listingReadiness(d:ListingDocument){
  return [
    {label:'Add a listing title',done:!!d.details.title.trim()},
    {label:'Add at least three photos or views',done:d.media.length>=3},
    {label:'Describe the property',done:!!(d.details.highlights.trim()||d.details.description.trim())},
    {label:'Confirm bedrooms, bathrooms and area',done:!!(d.details.beds.trim()&&d.details.baths.trim()&&d.details.area.trim())},
    {label:'Pair staged images with their originals',done:d.media.every(m=>!['staged','concept'].includes(m.kind)||hasPairedOriginal(m))},
  ];
}
