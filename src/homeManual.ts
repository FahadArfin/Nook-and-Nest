import {catalog} from './catalog';
import type {PlanDocumentV1} from './types';

export interface HomeServiceEntry {id:string;completedOn:string;task:string;notes:string}
export interface HomeManualRecord {
  id:string;name:string;furnitureId?:string;productUrl?:string;manualUrl?:string;
  purchasedOn?:string;warrantyEndsOn?:string;maintenanceTask?:string;nextMaintenanceOn?:string;
  notes:string;history:HomeServiceEntry[];
}
export interface HomeManual {version:1;records:HomeManualRecord[]}
export type HomeManualFilter='all'|'due'|'overdue'|'upcoming'|'warranty'|'warranty-expired';
export const MAX_HOME_RECORDS=100,MAX_HOME_HISTORY=40,MAX_HOME_MANUAL_BYTES=256*1024;
const names=new Map(catalog.map(item=>[item.id,item.name]));
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function keys(value:Record<string,unknown>,allowed:string[]):void {if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Unsupported home manual field.');}
function text(value:unknown,max:number,label:string,allowEmpty=false):string {
  if(typeof value!=='string'||value.length>max||(!allowEmpty&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error(`${label} is empty, invalid or too long (maximum ${max} characters).`);
  return value;
}
function identity(value:unknown):string {const id=text(value,200,'Record reference');if(id.trim()!==id||/[\r\n\t]/.test(id))throw new Error('Invalid home manual reference.');return id;}
function optionalText(value:unknown,max:number,label:string):string|undefined {return value===undefined||value===''?undefined:text(value,max,label);}
/** Calendar validation avoids UTC conversion and Date's normalization of impossible days. */
export function isHomeCalendarDay(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split('-').map(Number),leap=year%4===0&&(year%100!==0||year%400===0);
  return year>=1&&month>=1&&month<=12&&day>=1&&day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
function date(value:unknown,label:string):string|undefined {if(value===undefined||value==='')return undefined;if(!isHomeCalendarDay(value))throw new Error(`${label} must be a real calendar date (YYYY-MM-DD).`);return value;}
export function localCalendarDay(now=new Date()):string {
  const value=`${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if(!isHomeCalendarDay(value))throw new Error('The local calendar date is unavailable.');return value;
}
function url(value:unknown,label:string):string|undefined {
  if(value===undefined||value==='')return undefined;
  if(typeof value!=='string'||value.length>2048||!/^https?:\/\//i.test(value)||/[\u0000-\u0020\u007f\\]/.test(value))throw new Error(`${label}: use a full http or https link without credentials or spaces.`);
  try{const parsed=new URL(value);if(!/^https?:$/.test(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw new Error();}catch{throw new Error(`${label}: use a full http or https link without embedded credentials.`);}
  return value;
}
export function parseHomeManual(value:unknown):HomeManual {
  if(!object(value)||value.version!==1||!Array.isArray(value.records)||value.records.length>MAX_HOME_RECORDS)throw new Error('A home manual supports version 1 and up to 100 records.');
  keys(value,['version','records']);const ids=new Set<string>();
  const records=value.records.map(raw=>{
    if(!object(raw)||!Array.isArray(raw.history)||raw.history.length>MAX_HOME_HISTORY)throw new Error('Keep up to 40 dated service entries per home record.');
    keys(raw,['id','name','furnitureId','productUrl','manualUrl','purchasedOn','warrantyEndsOn','maintenanceTask','nextMaintenanceOn','notes','history']);
    const id=identity(raw.id);if(ids.has(id))throw new Error('Duplicate home record identity.');ids.add(id);
    const purchasedOn=date(raw.purchasedOn,'Purchase date'),warrantyEndsOn=date(raw.warrantyEndsOn,'Warranty end date'),nextMaintenanceOn=date(raw.nextMaintenanceOn,'Next maintenance date');
    if(purchasedOn&&warrantyEndsOn&&warrantyEndsOn<purchasedOn)throw new Error('The warranty end date cannot be before the purchase date.');
    const historyIds=new Set<string>();const history=raw.history.map(entry=>{
      if(!object(entry))throw new Error('Invalid service history.');keys(entry,['id','completedOn','task','notes']);
      const entryId=identity(entry.id);if(historyIds.has(entryId))throw new Error('Duplicate service entry identity.');historyIds.add(entryId);
      const completedOn=date(entry.completedOn,'Service date');if(!completedOn)throw new Error('Choose a service date.');
      return {id:entryId,completedOn,task:text(entry.task,240,'Service task'),notes:text(entry.notes,1000,'Service notes',true)};
    });
    return {id,name:text(raw.name,160,'Record name'),...(raw.furnitureId!==undefined?{furnitureId:identity(raw.furnitureId)}:{}),
      productUrl:url(raw.productUrl,'Product link'),manualUrl:url(raw.manualUrl,'Manual link'),purchasedOn,warrantyEndsOn,
      maintenanceTask:optionalText(raw.maintenanceTask,240,'Maintenance task'),nextMaintenanceOn,notes:text(raw.notes,2000,'Record notes',true),history};
  });
  const result:HomeManual={version:1,records};
  if(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_HOME_MANUAL_BYTES)throw new Error('Home manual size exceeds 256 KiB. Shorten notes or remove records before saving.');
  return result;
}

export function homeRecordStatus(record:HomeManualRecord,today=localCalendarDay()):{maintenance:'unknown'|'overdue'|'due'|'upcoming';warranty:'unknown'|'expired'|'current'} {
  if(!isHomeCalendarDay(today))throw new Error('Choose a real current date.');
  return {maintenance:!record.nextMaintenanceOn?'unknown':record.nextMaintenanceOn<today?'overdue':record.nextMaintenanceOn===today?'due':'upcoming',warranty:!record.warrantyEndsOn?'unknown':record.warrantyEndsOn<today?'expired':'current'};
}
export function resolveHomeFurniture(plan:PlanDocumentV1,record:HomeManualRecord):{state:'unlinked'|'missing'|'linked';label:string} {
  if(!record.furnitureId)return {state:'unlinked',label:'Standalone home record'};
  const item=plan.furniture.find(item=>item.id===record.furnitureId);
  if(!item)return {state:'missing',label:'Linked furniture is no longer in this layout. Your record is retained.'};
  return {state:'linked',label:`${item.personalItem?.name??names.get(item.catalogId)??'Furniture'} · ${plan.floors.find(f=>f.id===item.floorId)?.name??'Earlier floor'}`};
}
export function filterHomeManualRecords(records:HomeManualRecord[],query:string,filter:HomeManualFilter,today=localCalendarDay()):HomeManualRecord[] {
  const search=query.trim().toLocaleLowerCase();return records.filter(record=>{
    if(![record.name,record.notes,record.maintenanceTask??'',...record.history.map(entry=>`${entry.task} ${entry.notes}`)].join(' ').toLocaleLowerCase().includes(search))return false;
    const status=homeRecordStatus(record,today);
    return filter==='all'||filter==='due'&&(status.maintenance==='due'||status.maintenance==='overdue')||filter==='overdue'&&status.maintenance==='overdue'||filter==='upcoming'&&status.maintenance==='upcoming'||filter==='warranty'&&status.warranty==='current'||filter==='warranty-expired'&&status.warranty==='expired';
  });
}
function currentDraft(base:PlanDocumentV1,current:PlanDocumentV1):void {if(base!==current)throw new Error('The project changed. Close this form and reopen the record before saving.');}
function commitRecords(base:PlanDocumentV1,current:PlanDocumentV1,records:HomeManualRecord[],validate:(plan:unknown)=>void):PlanDocumentV1 {
  currentDraft(base,current);const next={...current,homeManual:parseHomeManual({version:1,records}),updatedAt:new Date().toISOString()};validate(next);return next;
}
export function saveHomeManualRecord(base:PlanDocumentV1,current:PlanDocumentV1,input:Omit<HomeManualRecord,'history'>&{history?:HomeServiceEntry[]},validate:(plan:unknown)=>void):PlanDocumentV1 {
  currentDraft(base,current);const records=current.homeManual?.records??[],old=records.find(record=>record.id===input.id);
  if(input.furnitureId&&input.furnitureId!==old?.furnitureId&&!current.furniture.some(item=>item.id===input.furnitureId))throw new Error('Choose furniture from the current layout.');
  const record={...input,history:old?.history??[]};return commitRecords(base,current,old?records.map(item=>item.id===record.id?record:item):[...records,record],validate);
}
export function removeHomeManualRecord(base:PlanDocumentV1,current:PlanDocumentV1,id:string,validate:(plan:unknown)=>void):PlanDocumentV1 {
  currentDraft(base,current);if(!current.homeManual?.records.some(record=>record.id===id))throw new Error('This home record is missing.');
  return commitRecords(base,current,current.homeManual.records.filter(record=>record.id!==id),validate);
}
export interface HomeMaintenanceCompletion {completedOn:string;task?:string;notes:string;nextMaintenanceOn?:string}
export function completeHomeMaintenance(base:PlanDocumentV1,current:PlanDocumentV1,id:string,input:HomeMaintenanceCompletion,validate:(plan:unknown)=>void,today=localCalendarDay()):PlanDocumentV1 {
  currentDraft(base,current);const record=current.homeManual?.records.find(record=>record.id===id);if(!record)throw new Error('This home record is missing.');
  const completedOn=date(input.completedOn,'Completed date');if(!completedOn||!isHomeCalendarDay(today))throw new Error('Choose a real completed date.');if(completedOn>today)throw new Error('Completed maintenance cannot have a future date.');
  const nextMaintenanceOn=date(input.nextMaintenanceOn,'Next maintenance date');if(nextMaintenanceOn&&nextMaintenanceOn<=completedOn)throw new Error('The next maintenance date must be after the completed date.');
  const entry={id:crypto.randomUUID(),completedOn,task:text(input.task??record.maintenanceTask,240,'Service task'),notes:text(input.notes,1000,'Service notes',true)};
  return commitRecords(base,current,current.homeManual!.records.map(item=>item.id===id?{...item,nextMaintenanceOn,history:[...item.history,entry]}:item),validate);
}

const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function homeManualHtml(plan:PlanDocumentV1,selectedIds:readonly string[],preparedOn=localCalendarDay()):string {
  const ids=new Set(selectedIds);if(!ids.size)throw new Error('Select at least one saved record for the handover.');
  const manual=parseHomeManual(plan.homeManual??{version:1,records:[]}),records=manual.records.filter(record=>ids.has(record.id));if(records.length!==ids.size)throw new Error('The selected home records changed or are missing. Select them again.');
  if(!isHomeCalendarDay(preparedOn))throw new Error('Choose a real prepared date.');
  const link=(label:string,value?:string)=>value?`<p>${label}: <a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a></p>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(plan.name)} — home handover</title><style>body{font:14px system-ui,sans-serif;color:#263b30;margin:28px;line-height:1.5}h1{font-size:26px}h2{font-size:20px}article{border-top:1px solid #bcc7bd;margin-top:24px;padding-top:8px;break-inside:avoid}p,li{white-space:pre-wrap;overflow-wrap:anywhere}a{color:inherit}small{color:#526557}dl{display:grid;grid-template-columns:180px 1fr;gap:6px}dd{margin:0}@page{margin:16mm}@media print{body{margin:0}}</style></head><body><h1>${escapeHtml(plan.name)} — home handover</h1><p>Prepared ${escapeHtml(preparedOn)} · ${records.length} selected record${records.length===1?'':'s'}</p><p>Owner-entered records. Blank dates are unknown. Check the original supplier's terms for warranty coverage.</p>${records.map(record=>`<article><h2>${escapeHtml(record.name)}</h2><small>${escapeHtml(resolveHomeFurniture(plan,record).label)}</small><dl><dt>Purchased</dt><dd>${escapeHtml(record.purchasedOn??'Unknown')}</dd><dt>Warranty end date</dt><dd>${escapeHtml(record.warrantyEndsOn??'Unknown')}</dd><dt>Maintenance task</dt><dd>${escapeHtml(record.maintenanceTask??'Not recorded')}</dd><dt>Next maintenance</dt><dd>${escapeHtml(record.nextMaintenanceOn??'Unknown')}</dd></dl>${link('Product',record.productUrl)}${link('Manual',record.manualUrl)}${record.notes?`<p>${escapeHtml(record.notes)}</p>`:''}<h3>Service history</h3>${record.history.length?`<ul>${record.history.map(entry=>`<li><strong>${escapeHtml(entry.completedOn)} · ${escapeHtml(entry.task)}</strong>${entry.notes?`<p>${escapeHtml(entry.notes)}</p>`:''}</li>`).join('')}</ul>`:'<p>No service history recorded.</p>'}</article>`).join('')}</body></html>`;
}
export function downloadHomeManual(plan:PlanDocumentV1,selectedIds:readonly string[]):void {
  const html=homeManualHtml(plan,selectedIds),blob=new Blob([html],{type:'text/html;charset=utf-8'}),objectUrl=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=objectUrl;anchor.download='home-handover.html';anchor.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
export function printHomeManual(plan:PlanDocumentV1,selectedIds:readonly string[]):void {
  const html=homeManualHtml(plan,selectedIds),page=window.open('about:blank','_blank');if(!page)throw new Error('Allow the printable handover to open, or download the printable copy.');
  page.opener=null;page.document.open();page.document.write(html);page.document.close();page.focus();page.setTimeout(()=>page.print(),100);
}
