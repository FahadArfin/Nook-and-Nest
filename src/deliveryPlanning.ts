import type {FurniturePlacement,PlanDocumentV1} from './types';

export type DeliveryRouteKind='door'|'corridor'|'lift'|'turn'|'stair';
export type DeliveryMeasurementKey='widthMm'|'depthMm'|'heightMm'|'entryWidthMm'|'entryHeightMm'|'exitWidthMm'|'turnDepthMm'|'landingWidthMm'|'landingDepthMm';
export type DeliveryOrientation='wdh'|'dwh'|'whd'|'hwd'|'dhw'|'hdw';
export interface DeliveryRouteStep {id:string;name:string;kind:DeliveryRouteKind;notes:string;measurements:Partial<Record<DeliveryMeasurementKey,number|null>>}
export interface DeliveryItem {id:string;name:string;notes:string;widthMm:number|null;depthMm:number|null;heightMm:number|null;basis:'assembled'|'packaged'|'unknown';orientation:DeliveryOrientation;dimensionSource:'model'|'entered';source?:{furnitureId:string;catalogId:string;widthMm:number;depthMm:number;heightMm:number}}
export interface DeliveryPlanning {version:1;steps:DeliveryRouteStep[];items:DeliveryItem[]}
export const MAX_DELIVERY_STEPS=24,MAX_DELIVERY_ITEMS=100;
export const deliveryRouteKinds:ReadonlyArray<{value:DeliveryRouteKind;label:string}>=[{value:'door',label:'Door'},{value:'corridor',label:'Corridor'},{value:'lift',label:'Lift'},{value:'turn',label:'Turn'},{value:'stair',label:'Stair'}];
export const deliveryOrientations:ReadonlyArray<{value:DeliveryOrientation;label:string}>=[{value:'wdh',label:'Upright · width across'},{value:'dwh',label:'Upright · depth across'},{value:'whd',label:'On back · width across'},{value:'hwd',label:'On back · height across'},{value:'dhw',label:'On side · depth across'},{value:'hdw',label:'On side · height across'}];
export const deliveryMeasurementFields:Record<DeliveryRouteKind,ReadonlyArray<{key:DeliveryMeasurementKey;label:string}>>={
  door:[{key:'widthMm',label:'Clear width'},{key:'heightMm',label:'Clear height'}],
  corridor:[{key:'widthMm',label:'Clear width'},{key:'heightMm',label:'Clear height'}],
  lift:[{key:'entryWidthMm',label:'Entry width'},{key:'entryHeightMm',label:'Entry height'},{key:'widthMm',label:'Cabin width'},{key:'depthMm',label:'Cabin depth'},{key:'heightMm',label:'Cabin height'}],
  turn:[{key:'widthMm',label:'Approach width'},{key:'exitWidthMm',label:'Exit width'},{key:'turnDepthMm',label:'Opposite wall clearance'},{key:'heightMm',label:'Headroom'}],
  stair:[{key:'widthMm',label:'Stair width'},{key:'heightMm',label:'Headroom'},{key:'landingWidthMm',label:'Landing width'},{key:'landingDepthMm',label:'Landing depth'}],
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function fields(v:Record<string,unknown>,keys:readonly string[]){if(Object.keys(v).some(k=>!keys.includes(k)))throw new Error('Unsupported delivery planning field.');}
function text(v:unknown,max:number,empty=false):string {if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error('Delivery names and notes must be readable and within their length limit.');return v;}
function identity(v:unknown):string {const s=text(v,200);if(s!==s.trim()||/[\r\n\t]/.test(s))throw new Error('Invalid delivery record identity.');return s;}
function dimension(v:unknown,nullable=true):number|null {if(v===null&&nullable)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>100_000)throw new Error('Use positive measurements up to 100,000 mm, or leave unknown measurements blank.');return v;}
export const blankDeliveryPlanning=():DeliveryPlanning=>({version:1,steps:[],items:[]});
export function blankDeliveryStep(kind:DeliveryRouteKind,id:string=crypto.randomUUID()):DeliveryRouteStep {return {id,name:'',kind,notes:'',measurements:Object.fromEntries(deliveryMeasurementFields[kind].map(f=>[f.key,null]))};}
export function blankDeliveryItem(id:string=crypto.randomUUID()):DeliveryItem {return {id,name:'',notes:'',widthMm:null,depthMm:null,heightMm:null,basis:'unknown',orientation:'wdh',dimensionSource:'entered'};}
export function parseDeliveryPlanning(value:unknown):DeliveryPlanning {
  if(!object(value)||value.version!==1||!Array.isArray(value.steps)||value.steps.length>MAX_DELIVERY_STEPS||!Array.isArray(value.items)||value.items.length>MAX_DELIVERY_ITEMS)throw new Error('Keep up to 24 delivery route steps and 100 transport items.');
  fields(value,['version','steps','items']);
  const steps=value.steps.map(v=>{
    if(!object(v)||!deliveryRouteKinds.some(k=>k.value===v.kind)||!object(v.measurements))throw new Error('Choose a valid delivery route type and measurements.');
    fields(v,['id','name','kind','notes','measurements']);const kind=v.kind as DeliveryRouteKind,allowed=deliveryMeasurementFields[kind];fields(v.measurements,allowed.map(f=>f.key));
    const measurements:DeliveryRouteStep['measurements']={};for(const f of allowed)measurements[f.key]=dimension(v.measurements[f.key]);
    return {id:identity(v.id),name:text(v.name,120),kind,notes:text(v.notes,1000,true),measurements};
  });
  const items=value.items.map(v=>{
    if(!object(v)||!['assembled','packaged','unknown'].includes(String(v.basis))||!['model','entered'].includes(String(v.dimensionSource))||!deliveryOrientations.some(o=>o.value===v.orientation))throw new Error('Choose a valid dimension basis and transport orientation.');
    fields(v,['id','name','notes','widthMm','depthMm','heightMm','basis','orientation','dimensionSource','source']);
    let source:DeliveryItem['source'];if(v.source!==undefined){if(!object(v.source))throw new Error('Invalid source furniture snapshot.');fields(v.source,['furnitureId','catalogId','widthMm','depthMm','heightMm']);source={furnitureId:identity(v.source.furnitureId),catalogId:identity(v.source.catalogId),widthMm:dimension(v.source.widthMm,false)!,depthMm:dimension(v.source.depthMm,false)!,heightMm:dimension(v.source.heightMm,false)!};}
    const item:DeliveryItem={id:identity(v.id),name:text(v.name,120),notes:text(v.notes,1000,true),widthMm:dimension(v.widthMm),depthMm:dimension(v.depthMm),heightMm:dimension(v.heightMm),basis:v.basis as DeliveryItem['basis'],orientation:v.orientation as DeliveryOrientation,dimensionSource:v.dimensionSource as DeliveryItem['dimensionSource'],...(source?{source}:{})};
    if(item.dimensionSource==='model'&&(!source||item.basis!=='assembled'||item.widthMm!==source.widthMm||item.depthMm!==source.depthMm||item.heightMm!==source.heightMm))throw new Error('Model dimensions require an unchanged assembled furniture snapshot.');
    return item;
  });
  if(new Set(steps.map(s=>s.id)).size!==steps.length||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Duplicate delivery record identity.');
  return {version:1,steps,items};
}
export function itemFromFurniture(furniture:FurniturePlacement,name:string,id:string=crypto.randomUUID()):DeliveryItem {const {widthMm,depthMm,heightMm}=furniture;return {...blankDeliveryItem(id),name,widthMm,depthMm,heightMm,basis:'assembled',dimensionSource:'model',source:{furnitureId:furniture.id,catalogId:furniture.catalogId,widthMm,depthMm,heightMm}};}
export function deliveryItemSourceStatus(plan:PlanDocumentV1,item:DeliveryItem):{state:'unlinked'|'current'|'changed'|'removed';message:string} {
  const s=item.source;if(!s)return {state:'unlinked',message:'Manually entered transport dimensions.'};
  const current=plan.furniture.find(f=>f.id===s.furnitureId);if(!current)return {state:'removed',message:'Source furniture was removed. This transport record is retained; recheck its dimensions.'};
  if(current.catalogId!==s.catalogId||current.widthMm!==s.widthMm||current.depthMm!==s.depthMm||current.heightMm!==s.heightMm)return {state:'changed',message:'Source furniture size or model changed. Recheck or refresh the transport dimensions.'};
  return {state:'current',message:item.dimensionSource==='model'?'Assembled dimensions copied from the current model; measure the real item.':'Entered dimensions; linked furniture is unchanged.'};
}
export function orientedDeliveryDimensions(item:DeliveryItem):{widthMm:number|null;depthMm:number|null;heightMm:number|null}{const dimensions={w:item.widthMm,d:item.depthMm,h:item.heightMm},axes=item.orientation.split('') as Array<keyof typeof dimensions>;return {widthMm:dimensions[axes[0]],depthMm:dimensions[axes[1]],heightMm:dimensions[axes[2]]};}
export interface DeliveryAssessment {state:'clear'|'tight'|'blocked'|'unknown'|'manual';message:string;missing:string[];clearances:{label:string;mm:number}[]}
export function assessDeliveryStep(item:DeliveryItem,step:DeliveryRouteStep,plan?:PlanDocumentV1):DeliveryAssessment {
  const missing:string[]=[];for(const key of ['widthMm','depthMm','heightMm'] as const)if(item[key]===null)missing.push(`Item: ${key.replace('Mm','')}`);
  for(const field of deliveryMeasurementFields[step.kind])if(step.measurements[field.key]==null)missing.push(`Route: ${field.label.toLowerCase()}`);
  if(item.basis==='unknown')missing.push('Item: packaged or assembled basis');
  if(item.dimensionSource==='model'&&(!plan||deliveryItemSourceStatus(plan,item).state!=='current'))missing.push('Item: current source furniture dimensions');
  if(step.kind==='turn'||step.kind==='stair')return {state:'manual',message:'Manual check needed: turning, lifting, landings and carrying space are not simulated.',missing,clearances:[]};
  if(missing.length)return {state:'unknown',message:'Needs checking: measurements or their source are incomplete.',missing,clearances:[]};
  const d=orientedDeliveryDimensions(item),m=step.measurements;
  const clearances=step.kind==='lift'?[{label:'Entry width',mm:m.entryWidthMm!-d.widthMm!},{label:'Entry height',mm:m.entryHeightMm!-d.heightMm!},{label:'Cabin width',mm:m.widthMm!-d.widthMm!},{label:'Cabin depth',mm:m.depthMm!-d.depthMm!},{label:'Cabin height',mm:m.heightMm!-d.heightMm!}]:[{label:'Width',mm:m.widthMm!-d.widthMm!},{label:'Height',mm:m.heightMm!-d.heightMm!}];
  // Decimal inch conversion can leave machine-scale residuals at exact equality.
  for(const clearance of clearances)if(Math.abs(clearance.mm)<1e-6)clearance.mm=0;
  if(clearances.some(c=>c.mm<0))return {state:'blocked',message:'Too small in this orientation. Recheck dimensions or choose another orientation.',missing,clearances};
  if(clearances.some(c=>c.mm===0))return {state:'tight',message:'No spare clearance. A matching dimension is not enough to plan a delivery.',missing,clearances};
  return {state:'clear',message:'Dimensions clear in this fixed orientation; moving fit still needs checking.',missing,clearances};
}
export function saveDeliveryPlanning(base:PlanDocumentV1,current:PlanDocumentV1,value:unknown,validate:(plan:unknown)=>void):PlanDocumentV1 {
  if(base!==current)throw new Error('The project changed. Reopen the delivery record before saving.');
  const next={...base,deliveryPlanning:parseDeliveryPlanning(value)};validate(next);if(new TextEncoder().encode(JSON.stringify(next)).byteLength>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');return next;
}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const deliveryMeasurementText=(n:number|null|undefined)=>n==null?'Unknown':`${Number(n.toFixed(1))} mm`;
export function deliveryPlanningHtml(plan:PlanDocumentV1):string {
  const data=plan.deliveryPlanning??blankDeliveryPlanning(),e=escapeHtml;
  const steps=data.steps.map((s,n)=>`<li><h3>${n+1}. ${e(s.name)} (${e(s.kind)})</h3><p>${deliveryMeasurementFields[s.kind].map(f=>`${f.label}: ${deliveryMeasurementText(s.measurements[f.key])}`).join(' · ')}</p><p>${e(s.notes)}</p></li>`).join('');
  const items=data.items.map(item=>`<article><h3>${e(item.name)}</h3><p>${e(item.basis)} · width ${deliveryMeasurementText(item.widthMm)} × depth ${deliveryMeasurementText(item.depthMm)} × height ${deliveryMeasurementText(item.heightMm)}</p><p>Orientation: ${e(deliveryOrientations.find(o=>o.value===item.orientation)!.label)}. ${e(deliveryItemSourceStatus(plan,item).message)}</p><p>${e(item.notes)}</p><ul>${data.steps.map(step=>{const result=assessDeliveryStep(item,step,plan);return `<li><strong>${e(step.name)}:</strong> ${e(result.message)}${result.missing.length?` Missing: ${e(result.missing.join(', '))}.`:''}${result.clearances.length?` Spare clearance: ${result.clearances.map(c=>`${c.label} ${deliveryMeasurementText(c.mm)}`).join(', ')}.`:''}</li>`;}).join('')}</ul></article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(plan.name)} — delivery route</title><style>body{font:15px/1.5 system-ui;color:#28352f;max-width:1000px;margin:30px auto;padding:0 20px}h1,h2,h3{line-height:1.2}article{border-top:1px solid #bbb;padding:12px 0;break-inside:avoid}p{white-space:pre-wrap}li{margin:10px 0}@media print{body{margin:0}}</style></head><body><h1>${e(plan.name)} — delivery route</h1><p>Private delivery planning record. Dimensional checks are not a moving-fit guarantee. Confirm packaging, handling space, route changes, weight limits and delivery arrangements with the supplier or movers. Turns and stairs always need manual checking.</p><h2>Measured route</h2>${steps?`<ol>${steps}</ol>`:'<p>No route recorded. Needs checking.</p>'}<h2>Transport items</h2>${items||'<p>No transport items recorded.</p>'}</body></html>`;
}
export function printDeliveryPlanning(plan:PlanDocumentV1):void {const page=window.open('about:blank','_blank');if(!page)throw new Error('Allow this site to open the printable delivery summary.');page.opener=null;page.document.open();page.document.write(deliveryPlanningHtml(plan));page.document.close();page.focus();page.setTimeout(()=>page.print(),100);}
