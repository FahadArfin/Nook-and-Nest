import {scaleAssessment,validateRecognition,type Recognition,type ScanDimension,type ScanFixture,type ScanRoom,type ScanWall} from './recognitionContract';

export type CaptureMethod='online-recognition'|'local-wall-extraction'|'manual-tracing';
export interface CaptureSource {id:string;page:number;rotation:0|90|180|270;widthPx:number;heightPx:number;method:CaptureMethod;pipelineVersion:string}
export type CaptureItemKind='room'|'wall'|'fixture'|'dimension';
export type CaptureDecision='pending'|'keep'|'edit'|'reject';
export type CaptureValue=ScanRoom|ScanWall|ScanFixture|ScanDimension;
export interface CaptureReviewSnapshot {
  version:1;source:CaptureSource;draftKey:string;original:Recognition;current:Recognition;
  decisions:Record<string,CaptureDecision>;
  measurement?:{ax:number;ay:number;bx:number;by:number;millimetres:number};
  checklist:{boundaries:boolean;openings:boolean;labels:boolean};
  startedAtMs:number;completedAtMs?:number;
}
export interface CaptureItem {id:string;kind:CaptureItemKind;index:number;label:string;decision:CaptureDecision;original:CaptureValue;current:CaptureValue;evidence:'printed-label'|'inferred';reason:string}
export const CAPTURE_CHECKS=['boundaries','openings','labels'] as const;
const lists={room:'rooms',wall:'walls',fixture:'fixtures',dimension:'dimensions'} as const;
const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const token=(n:unknown,max=100)=>typeof n==='string'&&n.length>0&&n.length<=max&&/^[a-zA-Z0-9_.:-]+$/.test(n);
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
function sourceValue(v:CaptureSource):CaptureSource {
  if(!v||!token(v.id)||!Number.isInteger(v.page)||!finite(v.page,1,200)||![0,90,180,270].includes(v.rotation)||!finite(v.widthPx,1,2400)||!finite(v.heightPx,1,2400)||!['online-recognition','local-wall-extraction','manual-tracing'].includes(v.method)||!token(v.pipelineVersion,80))throw new Error('The capture source is invalid. Reopen its local reference.');
  return {id:v.id,page:v.page,rotation:v.rotation,widthPx:v.widthPx,heightPx:v.heightPx,method:v.method,pipelineVersion:v.pipelineVersion};
}
function cleanRecognition(input:Recognition,source:CaptureSource):Recognition {
  const value=validateRecognition(input,source.widthPx,source.heightPx);
  return {rooms:value.rooms.map(r=>({...(r.roomId?{roomId:r.roomId}:{}),name:r.name,kind:r.kind,x:r.x,y:r.y,width:r.width,height:r.height,enclosed:r.enclosed,note:r.note})),walls:value.walls?.map(w=>({ax:w.ax,ay:w.ay,bx:w.bx,by:w.by})),fixtures:value.fixtures.map(f=>({catalogId:f.catalogId,x:f.x,y:f.y,width:f.width,depth:f.depth,rotation:f.rotation})),dimensions:value.dimensions.map(d=>({text:d.text,millimetres:d.millimetres,ax:d.ax,ay:d.ay,bx:d.bx,by:d.by})),warnings:value.warnings.slice(),...(value.regionReview!==undefined?{regionReview:value.regionReview}:{})};
}
/** A change detector, never a security token. Source IDs must change on a new image/page import. */
export function captureGeometryKey(value:unknown):string {
  const json=JSON.stringify(value);if(!json||json.length>2_000_000)throw new Error('The capture geometry is too large.');
  let a=2166136261,b=2246822519;for(let i=0;i<json.length;i++){a=Math.imul(a^json.charCodeAt(i),16777619);b=Math.imul(b^json.charCodeAt(i),3266489917);}
  return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
/** Pass only geometry, never the draft's captureReview field, to avoid recursive fingerprints. */
export function captureDraftKey(draft:{rooms:unknown[];walls:unknown[];fixtures:unknown[];omittedWalls:string[];wallCuts?:unknown[];regionDividers?:unknown[];wallFirst?:boolean},gridSizeMm:number):string {
  return captureGeometryKey({gridSizeMm,rooms:draft.rooms,walls:draft.walls,fixtures:draft.fixtures,omittedWalls:draft.omittedWalls,wallCuts:draft.wallCuts,regionDividers:draft.regionDividers,wallFirst:draft.wallFirst});
}
export function captureItems(review:CaptureReviewSnapshot):CaptureItem[] {
  const assessment=scaleAssessment(review.original);
  return (Object.keys(lists) as CaptureItemKind[]).flatMap(kind=>(review.original[lists[kind]]??[]).map((original,index)=>{
    const current=(review.current[lists[kind]]??[])[index],id=`${kind}:${index}`;
    const label=kind==='room'?(current as ScanRoom).name:kind==='dimension'?(current as ScanDimension).text:kind==='fixture'?(current as ScanFixture).catalogId.replace(/-/g,' '):`Wall ${index+1}`;
    const reason=kind==='dimension'?(assessment.warnings.join(' ')||'A printed label was read. Confirm its endpoints and physical length.'):kind==='room'?(original as ScanRoom).note||'Inferred room boundary and label. Compare every edge with the reference.':kind==='wall'?'Inferred wall segment. Check ends, joins and missing openings.':'Inferred object or opening. Check type, position, width and facing.';
    return {id,kind,index,label,decision:review.decisions[id],original,current,evidence:kind==='dimension'?'printed-label':'inferred',reason};
  }));
}
export function validateCaptureReview(input:unknown):CaptureReviewSnapshot {
  const r=input as CaptureReviewSnapshot;
  if(!r||r.version!==1||!token(r.draftKey,64)||!finite(r.startedAtMs,0,8.64e15)||r.completedAtMs!==undefined&&(!finite(r.completedAtMs,r.startedAtMs,8.64e15)||r.completedAtMs-r.startedAtMs>7*86400000))throw new Error('Invalid capture review.');
  const source=sourceValue(r.source),original=cleanRecognition(r.original,source),current=cleanRecognition(r.current,source);
  for(const key of Object.values(lists))if((original[key]?.length??0)!==(current[key]?.length??0))throw new Error('Capture review must retain original item identities.');
  if(!r.decisions||typeof r.decisions!=='object'||Array.isArray(r.decisions)||Object.keys(r.decisions).length>480)throw new Error('Invalid capture decisions.');
  const decisions:Record<string,CaptureDecision>={};
  for(const kind of Object.keys(lists) as CaptureItemKind[])for(let index=0;index<(original[lists[kind]]?.length??0);index++){
    const id=`${kind}:${index}`,decision=r.decisions[id];
    if(!['pending','keep','edit','reject'].includes(decision))throw new Error('Invalid capture decision.');
    if(decision==='keep'&&JSON.stringify(original[lists[kind]]![index])!==JSON.stringify(current[lists[kind]]![index]))throw new Error('Kept geometry must match its original exactly.');
    decisions[id]=decision;
  }
  if(Object.keys(decisions).length!==Object.keys(r.decisions).length)throw new Error('Unknown capture decision.');
  if(!r.checklist||CAPTURE_CHECKS.some(key=>typeof r.checklist[key]!=='boolean'))throw new Error('Invalid capture checklist.');
  let measurement:CaptureReviewSnapshot['measurement'];
  if(r.measurement){const m=r.measurement,len=Math.hypot(m.bx-m.ax,m.by-m.ay);if(!finite(m.ax,0,source.widthPx)||!finite(m.bx,0,source.widthPx)||!finite(m.ay,0,source.heightPx)||!finite(m.by,0,source.heightPx)||!finite(m.millimetres,100,60000)||len<5||!finite(m.millimetres/len,.1,200))throw new Error('Choose a measured span inside the reference, at least 5 pixels long and 100–60,000 mm.');measurement={ax:m.ax,ay:m.ay,bx:m.bx,by:m.by,millimetres:m.millimetres};}
  return {version:1,source,draftKey:r.draftKey,original,current,decisions,checklist:{boundaries:r.checklist.boundaries,openings:r.checklist.openings,labels:r.checklist.labels},startedAtMs:r.startedAtMs,...(measurement?{measurement}:{}),...(r.completedAtMs===undefined?{}:{completedAtMs:r.completedAtMs})};
}
export function createCaptureReview(detection:Recognition,source:CaptureSource,draftKey:string,startedAtMs:number):CaptureReviewSnapshot {
  const r:CaptureReviewSnapshot={version:1,source:sourceValue(source),draftKey,original:cleanRecognition(detection,source),current:cleanRecognition(detection,source),decisions:{},checklist:{boundaries:false,openings:false,labels:false},startedAtMs};
  for(const kind of Object.keys(lists) as CaptureItemKind[])for(let i=0;i<(r.original[lists[kind]]?.length??0);i++)r.decisions[`${kind}:${i}`]='pending';
  return validateCaptureReview(r);
}
export function decideCaptureItem(review:CaptureReviewSnapshot,id:string,decision:'keep'|'reject'|'pending'):CaptureReviewSnapshot {
  const next=validateCaptureReview(review),item=captureItems(next).find(i=>i.id===id);if(!item)throw new Error('That capture item no longer exists.');
  next.decisions[id]=decision;delete next.completedAtMs;
  if(decision==='keep'||decision==='pending')(next.current[lists[item.kind]] as CaptureValue[])[item.index]=clone(item.original);
  return validateCaptureReview(next);
}
export function editCaptureItem(review:CaptureReviewSnapshot,id:string,value:CaptureValue):CaptureReviewSnapshot {
  const next=validateCaptureReview(review),item=captureItems(next).find(i=>i.id===id);if(!item)throw new Error('That capture item no longer exists.');
  (next.current[lists[item.kind]] as CaptureValue[])[item.index]=clone(value);next.decisions[id]='edit';delete next.completedAtMs;
  return validateCaptureReview(next);
}
export function confirmCaptureMeasurement(review:CaptureReviewSnapshot,measurement:NonNullable<CaptureReviewSnapshot['measurement']>):CaptureReviewSnapshot {
  const next=validateCaptureReview({...review,measurement,completedAtMs:undefined});return next;
}
export function captureReviewStatus(review:CaptureReviewSnapshot,source:CaptureSource,draftKey:string) {
  const valid=validateCaptureReview(review),stale=JSON.stringify(valid.source)!==JSON.stringify(sourceValue(source))||valid.draftKey!==draftKey;
  const pending=Object.values(valid.decisions).filter(d=>d==='pending').length,missingChecks=CAPTURE_CHECKS.filter(k=>!valid.checklist[k]);
  return {stale,pending,missingChecks,measured:!!valid.measurement,ready:!stale&&!pending&&!missingChecks.length&&!!valid.measurement};
}
/** Returns a proposal only. The caller retains Studio's preview, explicit confirmation and one undo step. */
export function completeCaptureReview(review:CaptureReviewSnapshot,source:CaptureSource,draftKey:string,completedAtMs:number) {
  const valid=validateCaptureReview(review),status=captureReviewStatus(valid,source,draftKey);
  if(status.stale)throw new Error('The reference or draft changed. Start a fresh review before applying.');
  if(!status.ready)throw new Error('Verify one known length, decide every item and finish the correction checklist.');
  const result:Recognition={rooms:[],walls:[],fixtures:[],dimensions:[],warnings:valid.current.warnings.slice(),...(valid.current.regionReview!==undefined?{regionReview:valid.current.regionReview}:{})};
  for(const item of captureItems(valid))if(item.decision!=='reject')(result[lists[item.kind]] as CaptureValue[]).push(clone(item.current));
  validateRecognition(result,source.widthPx,source.heightPx);
  const snapshot=validateCaptureReview({...valid,completedAtMs});
  const m=snapshot.measurement!,scale=m.millimetres/Math.hypot(m.bx-m.ax,m.by-m.ay);
  return {snapshot,recognition:result,scale};
}
