import type {PlanDocumentV1} from './types';
const PERSONAL_PHOTO_ID=/^sha256:[a-f0-9]{64}$/;
export type SurveyTarget={kind:'room'|'wall'|'object';floorId:string;id:string};
export type MeasurementValues=Partial<Record<'lengthMm'|'widthMm'|'depthMm'|'heightMm',number>>;
export type MeasurementSource='tape'|'laser'|'document'|'trace'|'ai'|'model';
export interface MeasurementCheck {id:string;source:MeasurementSource;checkedOn:string;reviewer:string;recordedAt:string;units:'mm';measured:MeasurementValues;model:MeasurementValues;modelFingerprint:string;question:string}
export interface SiteNote {id:string;target:SurveyTarget;title:string;text:string;photoAssetIds:string[];checks:MeasurementCheck[]}
export type AreaClassification='included'|'excluded'|'outdoor'|'unclassified';
export interface SiteSurvey {version:1;notes:SiteNote[];areas:{floorId:string;roomKey:string;classification:AreaClassification}[]}
export type SurveyPlan=PlanDocumentV1&{siteSurvey?:SiteSurvey};
export const MAX_SITE_NOTES=100,MAX_SITE_CHECKS=12,MAX_SITE_PHOTOS=40;
export const blankSiteSurvey=():SiteSurvey=>({version:1,notes:[],areas:[]});
export const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function surveyText(v:unknown,max:number,empty=false):string {if(typeof v!=='string'||v.length>max||!empty&&!v.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error('A site note is empty, too long or invalid.');return v;}
export function surveyIdentity(v:unknown):string {const s=surveyText(v,200);if(s.trim()!==s||/[\r\n\t]/.test(s))throw new Error('Invalid site reference.');return s;}
export function allowedKeys(v:Record<string,unknown>,keys:string[]){if(Object.keys(v).some(k=>!keys.includes(k)))throw new Error('Unsupported survey or presentation field.');}
export function realDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export const timestamp=(v:unknown)=>{const s=surveyText(v,40);if(!Number.isFinite(Date.parse(s)))throw new Error('Invalid recorded date.');return s;};
export function values(v:unknown):MeasurementValues {if(!record(v))throw new Error('Invalid measurements.');allowedKeys(v,['lengthMm','widthMm','depthMm','heightMm']);for(const n of Object.values(v))if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>1_000_000)throw new Error('Measurements must be positive millimetres up to 1,000 metres.');return {...v} as MeasurementValues;}
export function parseSurveyTarget(v:unknown):SurveyTarget {if(!record(v)||!['room','wall','object'].includes(String(v.kind)))throw new Error('Choose a room, wall or object.');allowedKeys(v,['kind','floorId','id']);return {kind:v.kind as SurveyTarget['kind'],floorId:surveyIdentity(v.floorId),id:surveyIdentity(v.id)};}
export function parseCheck(v:unknown):MeasurementCheck {
  if(!record(v)||v.units!=='mm'||!['tape','laser','document','trace','ai','model'].includes(String(v.source))||!realDate(v.checkedOn))throw new Error('Choose a measurement source and a real check date.');allowedKeys(v,['id','source','checkedOn','reviewer','recordedAt','units','measured','model','modelFingerprint','question']);
  const measured=values(v.measured);if(!Object.keys(measured).length)throw new Error('Record at least one measured dimension.');return {id:surveyIdentity(v.id),source:v.source as MeasurementSource,checkedOn:v.checkedOn,reviewer:surveyText(v.reviewer,120),recordedAt:timestamp(v.recordedAt),units:'mm',measured,model:values(v.model),modelFingerprint:surveyText(v.modelFingerprint,100),question:surveyText(v.question,1000,true)};
}
export function parseSiteSurvey(v:unknown):SiteSurvey {
  if(!record(v)||v.version!==1||!Array.isArray(v.notes)||v.notes.length>MAX_SITE_NOTES||!Array.isArray(v.areas)||v.areas.length>300)throw new Error('Keep up to 100 site notes and 300 area classifications.');allowedKeys(v,['version','notes','areas']);
  const photos=new Set<string>(),ids=new Set<string>();const notes=v.notes.map(n=>{if(!record(n)||!Array.isArray(n.photoAssetIds)||n.photoAssetIds.length>4||!Array.isArray(n.checks)||n.checks.length>MAX_SITE_CHECKS)throw new Error('A note holds up to four photos and twelve measurement checks.');allowedKeys(n,['id','target','title','text','photoAssetIds','checks']);const id=surveyIdentity(n.id);if(ids.has(id))throw new Error('Duplicate note identity.');ids.add(id);
    const photoAssetIds=n.photoAssetIds.map(p=>{if(typeof p!=='string'||!PERSONAL_PHOTO_ID.test(p))throw new Error('Invalid private survey photo.');photos.add(p);return p;});if(new Set(photoAssetIds).size!==photoAssetIds.length)throw new Error('Duplicate photo in note.');const checks=n.checks.map(parseCheck);if(new Set(checks.map(c=>c.id)).size!==checks.length)throw new Error('Duplicate measurement check.');return {id,target:parseSurveyTarget(n.target),title:surveyText(n.title,120),text:surveyText(n.text,2000,true),photoAssetIds,checks};});
  const areaIds=new Set<string>();const areas=v.areas.map(a=>{if(!record(a)||!['included','excluded','outdoor','unclassified'].includes(String(a.classification)))throw new Error('Invalid area classification.');allowedKeys(a,['floorId','roomKey','classification']);const floorId=surveyIdentity(a.floorId),roomKey=surveyIdentity(a.roomKey),key=JSON.stringify([floorId,roomKey]);if(areaIds.has(key))throw new Error('Duplicate area classification.');areaIds.add(key);return {floorId,roomKey,classification:a.classification as AreaClassification};});
  if(photos.size>MAX_SITE_PHOTOS||new TextEncoder().encode(JSON.stringify(v)).byteLength>400_000)throw new Error('Site notes exceed 40 unique photos or 400 KB of metadata.');return {version:1,notes,areas};
}
