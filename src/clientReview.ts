import {withRemixAttribution} from './remixAttribution';
import {validatePlan} from './planValidation';
import {validCameraShot, type CameraShotPose} from './walkthrough';
import {isListingImage, type MediaKind} from './listingTypes';
import type {PlanDocumentV1} from './types';
import {imageDimensions} from './imageDimensions';

export const REVIEW_LIMITS = {stops:12, media:12, imageChars:220_000, bodyBytes:11_000_000, revisions:10, reviews:25, feedback:200, hourlyFeedback:30} as const;
export interface ReviewStop {id:string; title:string; caption:string; narration:string; floorId:string; camera:CameraShotPose; marker:{xMm:number;zMm:number;facingDeg:number}; mediaId?:string}
export interface ReviewSnapshot {version:1; title:string; plan:PlanDocumentV1; stops:ReviewStop[]}
export interface ReviewMedia {id:string; kind:MediaKind; dataUrl:string}
export type ReviewAnchor = {kind:'snapshot'|'floor'|'room'|'item'|'stop';id?:string;floorId?:string};
export interface ReviewFeedbackInput {requestId:string;revision:number;kind:'comment'|'approval'|'changes-requested';authorName:string;text:string;anchor:ReviewAnchor}
export interface ReviewFeedback extends ReviewFeedbackInput {id:string;createdAt:number;resolved:boolean}
export interface ReviewPublication {snapshot:ReviewSnapshot;media:ReviewMedia[];includeSelectedMedia:boolean}
export interface ReviewSummary {id:string;projectId:string;revision:number;createdAt:number;expiresAt:number;revoked:boolean}
export interface ReviewView {snapshot:ReviewSnapshot;revision:number;currentRevision:number;expiresAt:number;media:Array<Pick<ReviewMedia,'id'|'kind'>>;feedback:ReviewFeedback[]}
/** ArcRotate camera position projected onto its floor; north in a plan is -Z. */
export function cameraReviewMarker(camera:CameraShotPose):ReviewStop['marker'] {const radius=camera.radius*Math.sin(camera.beta);return {xMm:(camera.target.x+radius*Math.cos(camera.alpha))*1000,zMm:(camera.target.z+radius*Math.sin(camera.alpha))*1000,facingDeg:((camera.alpha*180/Math.PI-90)%360+360)%360};}
export const reviewId = (value:unknown):value is string => typeof value==='string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fail():never {throw new Error('This review contains invalid or unsupported data.');}
const exact=(v:unknown,keys:string[]):Record<string,any>=>{if(!record(v)||Object.keys(v).some(k=>!keys.includes(k)))fail();return v as Record<string,any>;};
const pick=(v:Record<string,any>,keys:string[])=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,structuredClone(v[k])]));
export function reviewText(v:unknown,max:number,required=false):string {if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(v))fail();const s=v.trim();if(required&&!s)fail();return s;}

/** Independent public allowlist: new editor metadata is private until deliberately added here. */
export function reviewPlan(source:unknown,title:string):PlanDocumentV1 {
  validatePlan(source);const p=source as PlanDocumentV1;
  const shape=(r:Record<string,any>)=>({...pick(r,['x','z','width','depth']),...(r.polygon?{polygon:r.polygon.map((q:Record<string,any>)=>pick(q,['x','z']))}:{})});
  const wall=(w:Record<string,any>)=>pick(w,['id','ax','az','bx','bz','heightMm']);
  const floors=p.floors.map(f=>({
    ...pick(f,['id','name','elevationMm','heightMm','floorFinishId','wallFinishId']),
    cells:f.cells.map(c=>pick(c,['x','z'])),walls:f.walls.map(wall),
    openings:f.openings.map(o=>pick(o,['id','kind','wallKey','offset','widthMm','finishId'])),
    stairs:f.stairs.map(s=>pick(s,['id','kind','x','z','rotation','widthMm','lengthMm','toFloorId'])),
    ...(f.wallCuts?{wallCuts:f.wallCuts.map(wall)}:{}),
    ...(f.cellRects?{cellRects:Object.fromEntries(Object.entries(f.cellRects).map(([key,rects])=>[key,rects.map(shape)]))}:{}),
    ...(f.cellFinishes?{cellFinishes:structuredClone(f.cellFinishes)}:{}),...(f.wallFinishes?{wallFinishes:structuredClone(f.wallFinishes)}:{}),
    ...(f.blueprint?{blueprint:{...pick(f.blueprint,['geometryKey','generatedWallIds','omittedWalls']),rooms:f.blueprint.rooms.map(r=>({...shape(r),...pick(r,['id','name','kind','enclosed','groupId'])})),...(f.blueprint.wallCuts?{wallCuts:f.blueprint.wallCuts.map(wall)}:{})}}:{}),
  }));
  const furniture=p.furniture.map(f=>pick(f,['id','catalogId','floorId','x','z','rotation','widthMm','depthMm','heightMm','variant','hostDoorId','terrainAnchored','showerMirrored','moduleRun','toFloorId','stairRiseMm','surfaceVariant','materialColors','openFraction','doorless','elevationMm']));
  // Authored landscape/light settings are visual data; external map sources are never activated.
  const environment=p.environment?{...pick(p.environment,['flatRoof','background','grass','backdropRotation','cityHeight']),citySource:'standard',
    ...(p.environment.sun?{sun:pick(p.environment.sun,['enabled','night','azimuth','elevation'])}:{}),
    ...(p.environment.terrain?{terrain:p.environment.terrain.map(t=>({...pick(t,['kind','radius','strength','carve']),points:t.points.map(q=>pick(q,['x','z']))}))}:{}),
    ...(p.environment.grassCoverage?{grassCoverage:structuredClone(p.environment.grassCoverage)}:{}),
    ...(p.environment.vegetationField?{vegetationField:pick(p.environment.vegetationField,['cells','removed'])}:{}),
  }:{background:'plain',grass:'off'};
  const clean={schemaVersion:1,id:'review-snapshot',name:reviewText(title,120,true),createdAt:'2000-01-01T00:00:00.000Z',updatedAt:'2000-01-01T00:00:00.000Z',units:p.units,gridSizeMm:p.gridSizeMm,floors,furniture,camera:pick(p.camera,['mode','ghostBelow','showGrid','showClearance','wallVisibility','transparentWalls','darkMode']),environment};
  const credited=withRemixAttribution(clean,p);validatePlan(credited);return credited;
}
export function parseReviewSnapshot(value:unknown):ReviewSnapshot {
  const s=exact(value,['version','title','plan','stops']);if(s.version!==1||!Array.isArray(s.stops)||s.stops.length<1||s.stops.length>REVIEW_LIMITS.stops)fail();
  const title=reviewText(s.title,120,true),plan=reviewPlan(s.plan,title),ids=new Set<string>();
  const stops=s.stops.map((v:unknown):ReviewStop=>{const t=exact(v,['id','title','caption','narration','floorId','camera','marker','mediaId']);
    if(!reviewId(t.id)||ids.has(t.id)||!plan.floors.some(f=>f.id===t.floorId)||!validCameraShot(t.camera)||t.camera.floorId!==t.floorId||t.mediaId!==undefined&&!reviewId(t.mediaId))fail();ids.add(t.id);
    exact(t.camera,['version','kind','floorId','target','alpha','beta','radius','mode','fov']);exact(t.camera.target,['x','y','z']);
    const m=exact(t.marker,['xMm','zMm','facingDeg']);if(![m.xMm,m.zMm,m.facingDeg].every(Number.isFinite)||Math.abs(m.xMm)>10_000_000||Math.abs(m.zMm)>10_000_000||m.facingDeg<0||m.facingDeg>=360)fail();
    return {id:t.id,title:reviewText(t.title,100,true),caption:reviewText(t.caption,1000),narration:reviewText(t.narration,2000),floorId:t.floorId,camera:structuredClone(t.camera),marker:{xMm:m.xMm,zMm:m.zMm,facingDeg:m.facingDeg},...(t.mediaId?{mediaId:t.mediaId}:{})};
  });return {version:1,title,plan,stops};
}
export function parseReviewPublication(value:unknown):ReviewPublication {
  const p=exact(value,['snapshot','media','includeSelectedMedia']);if(typeof p.includeSelectedMedia!=='boolean'||!Array.isArray(p.media)||p.media.length>REVIEW_LIMITS.media||!p.includeSelectedMedia&&p.media.length)fail();
  const snapshot=parseReviewSnapshot(p.snapshot),ids=new Set<string>();
  const media:ReviewMedia[]=p.media.map((v:unknown):ReviewMedia=>{const m=exact(v,['id','kind','dataUrl']);if(!reviewId(m.id)||ids.has(m.id)||!['photo','render','staged','concept'].includes(m.kind)||!isListingImage(m.dataUrl,REVIEW_LIMITS.imageChars))fail();const dimensions=imageDimensions(Uint8Array.from(atob(m.dataUrl.slice(m.dataUrl.indexOf(',')+1)),c=>c.charCodeAt(0)));if(dimensions.width<1||dimensions.height<1||dimensions.width>1280||dimensions.height>1280)fail();ids.add(m.id);return {id:m.id,kind:m.kind,dataUrl:m.dataUrl};});
  if(snapshot.stops.some(s=>s.mediaId&&!ids.has(s.mediaId))||media.some(m=>!snapshot.stops.some(s=>s.mediaId===m.id)))fail();
  if(new TextEncoder().encode(JSON.stringify({snapshot,media})).length>REVIEW_LIMITS.bodyBytes)fail();
  return {snapshot,media,includeSelectedMedia:p.includeSelectedMedia};
}
export function parseReviewFeedback(value:unknown,snapshot:ReviewSnapshot):ReviewFeedbackInput {
  const f=exact(value,['requestId','revision','kind','authorName','text','anchor']);if(!reviewId(f.requestId)||!Number.isSafeInteger(f.revision)||f.revision<1||!['comment','approval','changes-requested'].includes(f.kind))fail();
  const a=exact(f.anchor,['kind','id','floorId']);if(!['snapshot','floor','room','item','stop'].includes(a.kind)||a.kind!=='room'&&a.floorId!==undefined)fail();
  if(a.kind==='snapshot'){if(a.id!==undefined)fail();}else{if(!reviewId(a.id))fail();const valid=a.kind==='floor'?snapshot.plan.floors.some(x=>x.id===a.id):a.kind==='room'?reviewId(a.floorId)&&snapshot.plan.floors.some(x=>x.id===a.floorId&&x.blueprint?.rooms.some(r=>r.id===a.id)):a.kind==='item'?snapshot.plan.furniture.some(x=>x.id===a.id):snapshot.stops.some(x=>x.id===a.id);if(!valid)fail();}
  if(f.kind!=='comment'&&a.kind!=='snapshot')fail();
  return {requestId:f.requestId,revision:f.revision,kind:f.kind,authorName:reviewText(f.authorName,80,true),text:reviewText(f.text,2000,f.kind!=='approval'),anchor:{kind:a.kind,...(a.id?{id:a.id}:{}),...(a.floorId?{floorId:a.floorId}:{})}};
}

/** Local derivative only; source images and original pairs are never altered or transmitted. */
export async function reviewImagePreview(dataUrl:string):Promise<string> {
  if(!isListingImage(dataUrl,3*1024*1024))throw new Error('Choose a saved listing photo or render.');
  const header=imageDimensions(Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',')+1)),c=>c.charCodeAt(0)));if(!header.width||!header.height||header.width>10000||header.height>10000||header.width*header.height>24_000_000)throw new Error('This image is too large.');
  const img=new Image();img.decoding='async';img.src=dataUrl;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>24_000_000)throw new Error('This image is too large.');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw new Error('Image previews are unavailable.');
  let size=960;for(let attempt=0;attempt<5;attempt++,size=Math.floor(size*.75)){const scale=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));context.fillStyle='#f7f4eb';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/jpeg',.8);if(result.length<=REVIEW_LIMITS.imageChars)return result;}
  throw new Error('This photo cannot fit in a review preview.');
}
