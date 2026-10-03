import type {PlanDocumentV1} from './types';
import {blankSiteSurvey,parseServicePoint,parseSiteSurvey,type ServicePoint,type ServicePointAnchor} from './siteSurveySchema';
import {stableFingerprint} from './siteSurvey';
import {floorQuantityGeometry,pointOnPlate,type FloorQuantityGeometry,type QuantityWallPlate} from './surfaceGeometry';
export type {ServicePoint,ServicePointKind} from './siteSurveySchema';
export type ServicePointInput=Omit<ServicePoint,'anchor'|'verification'>;
export const servicePointKinds=[{id:'outlet',name:'Outlet',symbol:'O'},{id:'switch',name:'Switch',symbol:'S'},{id:'data',name:'Data',symbol:'D'},{id:'vent',name:'Vent',symbol:'V'}] as const;
const floorFingerprints=new WeakMap<FloorQuantityGeometry,string>();
const wallFingerprints=new WeakMap<QuantityWallPlate,string>();
function anchorFor(geometry:FloorQuantityGeometry,wall:QuantityWallPlate):ServicePointAnchor {
  if(wall.heightMm===null)throw new Error('Measure this wall height before recording service points.');
  let floorFingerprint=floorFingerprints.get(geometry);if(!floorFingerprint){floorFingerprint=stableFingerprint([geometry.original,geometry.floor.elevationMm]);floorFingerprints.set(geometry,floorFingerprint);}
  let wallFingerprint=wallFingerprints.get(wall);if(!wallFingerprint){
    const hosts=new Map(wall.parts.flatMap(({wall:w})=>[[w.id,w],[[w.ax,w.az,w.bx,w.bz].join(':'),w]] as const));
    // Older openings are rendered separately from the measured surface pieces.
    // Keep their host geometry and dimensions, while excluding decorative finishes.
    const legacyOpenings=geometry.floor.openings.flatMap(o=>{const w=hosts.get(o.wallKey);return w?[JSON.stringify([o.kind,w.ax,w.az,w.bx,w.bz,o.offset,o.widthMm])]:[];}).sort();
    wallFingerprint=stableFingerprint([wall.key,wall.remaining,legacyOpenings]);wallFingerprints.set(wall,wallFingerprint);
  }
  const a=pointOnPlate(wall,0),b=pointOnPlate(wall,wall.lengthMm);
  return {ax:a.x,az:a.z,bx:b.x,bz:b.z,heightMm:wall.heightMm,floorElevationMm:geometry.floor.elevationMm,floorFingerprint,wallFingerprint};
}
export function servicePointWalls(plan:PlanDocumentV1,floorId:string){return floorQuantityGeometry(plan,floorId).plates;}
export function servicePointPosition(point:ServicePoint){const a=point.anchor,length=Math.hypot(a.bx-a.ax,a.bz-a.az),t=point.offsetMm/length;return {x:a.ax+(a.bx-a.ax)*t,z:a.az+(a.bz-a.az)*t};}
function measuredFingerprint(p:ServicePoint){const a=p.anchor;return stableFingerprint([p.kind,p.floorId,p.wallKey,p.face,p.offsetMm,p.heightMm,a.ax,a.az,a.bx,a.bz,a.heightMm,a.floorElevationMm,a.floorFingerprint,a.wallFingerprint]);}
function sameAnchor(a:ServicePointAnchor,b:ServicePointAnchor){return (Object.keys(a) as Array<keyof ServicePointAnchor>).every(key=>a[key]===b[key]);}
export function prepareServicePoint(plan:PlanDocumentV1,input:ServicePointInput):ServicePoint {
  const geometry=floorQuantityGeometry(plan,input.floorId),wall=geometry.plates.find(w=>w.key===input.wallKey);if(!wall)throw new Error('This wall changed or is missing. Choose a current wall and check the measurements again.');
  const {id,kind,label,floorId,wallKey,face,offsetMm,heightMm}=input;
  return parseServicePoint({id,kind,label,floorId,wallKey,face,offsetMm,heightMm,anchor:anchorFor(geometry,wall)});
}
export function servicePointStatus(plan:PlanDocumentV1,point:ServicePoint):{state:'unchecked'|'verified'|'changed';message:string}{
  try {const geometry=floorQuantityGeometry(plan,point.floorId),wall=geometry.plates.find(w=>w.key===point.wallKey);if(!wall||!sameAnchor(anchorFor(geometry,wall),point.anchor))return {state:'changed',message:'Floor or wall changed. Earlier location retained; remeasure and save its current wall before verifying.'};}
  catch{return {state:'changed',message:'Floor or wall is unavailable. Earlier location retained; choose current geometry before using it.'};}
  if(point.verification?.fingerprint===measuredFingerprint(point))return {state:'verified',message:`Self-reported check by ${point.verification.reviewer} on ${point.verification.checkedOn}.`};
  return {state:'unchecked',message:'Position entered; an on-site check has not been recorded for these measurements.'};
}
function update(base:PlanDocumentV1,current:PlanDocumentV1,points:ServicePoint[],validate:(p:unknown)=>void){
  if(base!==current)throw new Error('The project changed. Reload service points before saving.');
  const next={...base,siteSurvey:parseSiteSurvey({...base.siteSurvey??blankSiteSurvey(),servicePoints:points})};validate(next);if(new TextEncoder().encode(JSON.stringify(next)).byteLength>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');return next;
}
export function saveServicePoint(base:PlanDocumentV1,current:PlanDocumentV1,input:ServicePointInput,validate:(p:unknown)=>void){
  if(base!==current)throw new Error('The project changed. Reload service points before saving.');
  const point=prepareServicePoint(base,input),points=base.siteSurvey?.servicePoints??[],previous=points.find(p=>p.id===point.id);
  if(previous?.verification&&measuredFingerprint(previous)===measuredFingerprint(point))point.verification=previous.verification;
  return update(base,current,previous?points.map(p=>p.id===point.id?point:p):[...points,point],validate);
}
export function verifyServicePoint(base:PlanDocumentV1,current:PlanDocumentV1,id:string,check:{reviewer:string;checkedOn:string},validate:(p:unknown)=>void){
  const points=base.siteSurvey?.servicePoints??[],point=points.find(p=>p.id===id);if(!point)throw new Error('This service point is unavailable.');if(servicePointStatus(base,point).state==='changed')throw new Error('Floor or wall changed. Remeasure and save this marker before recording a new check.');
  const verified=parseServicePoint({...point,verification:{...check,fingerprint:measuredFingerprint(point)}});return update(base,current,points.map(p=>p.id===id?verified:p),validate);
}
export function removeServicePoint(base:PlanDocumentV1,current:PlanDocumentV1,id:string,validate:(p:unknown)=>void){return update(base,current,(base.siteSurvey?.servicePoints??[]).filter(p=>p.id!==id),validate);}
const csvCell=(value:unknown)=>{const s=String(value??'');return '"'+(/^[\s\u0000-\u001f]*[=+\-@]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';};
export function servicePointsCsv(plan:PlanDocumentV1,floorId:string){
  const rows:Array<unknown[]>=[['Floor','Label','Type','Wall start X mm','Wall start Z mm','Wall end X mm','Wall end Z mm','Face','Distance from start mm','Height above floor mm','Status','Checked by','Check date']];
  for(const p of plan.siteSurvey?.servicePoints??[]){if(p.floorId!==floorId)continue;const status=servicePointStatus(plan,p);rows.push([plan.floors.find(f=>f.id===p.floorId)?.name??'Removed floor',p.label,p.kind,p.anchor.ax,p.anchor.az,p.anchor.bx,p.anchor.bz,p.face,p.offsetMm,p.heightMm,status.state,p.verification?.reviewer??'',p.verification?.checkedOn??'']);}
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
