import {catalog} from './catalog';
import {geometryKey} from './blueprint';
import type {FloorPlan,FurniturePlacement,PlanDocumentV1} from './types';

export type SelectionStatus='owned'|'wishlist'|'selected'|'ordered';
export interface PlacementSpecification {
  version:1;productName?:string;productUrl?:string;vendor?:string;
  match:'unspecified'|'exact'|'visual-substitute';status:SelectionStatus;
  unitPriceMinor:number|null;currency:string|null;checkedOn:string|null;
  purchase:{unit:'item'|'pack';quantity:number;unitsPerPack?:number};
  discount:{kind:'none'|'percent'|'fixed';value:number};
}
export type SpecifiedPlacement=FurniturePlacement&{specification?:PlacementSpecification};
export type SelectionPlan=Omit<PlanDocumentV1,'furniture'>&{furniture:SpecifiedPlacement[];selectionBudgets?:import('./selectionBudgets').SelectionBudgets};
export const MAX_PRICE_MINOR=100_000_000;
const catalogNames=new Map(catalog.map(c=>[c.id,c.name]));
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(k=>allowed.includes(k));
const integer=(value:unknown,min:number,max:number):value is number=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
const shortText=(value:unknown,max:number):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export function defaultSpecification():PlacementSpecification {return {version:1,match:'unspecified',status:'wishlist',unitPriceMinor:null,currency:null,checkedOn:null,purchase:{unit:'item',quantity:1},discount:{kind:'none',value:0}};}
export function validProductUrl(value:string):boolean {try{const u=new URL(value);return value.length<=2048&&/^https?:$/.test(u.protocol)&&!u.username&&!u.password&&!/[\u0000-\u0020\u007f]/.test(value);}catch{return false;}}
export function parsePlacementSpecification(value:unknown):PlacementSpecification {
  function fail():never{throw new Error('The item specification is invalid. Check its price, currency, date and purchase quantity.');}
  if(!record(value)||!exactKeys(value,['version','productName','productUrl','vendor','match','status','unitPriceMinor','currency','checkedOn','purchase','discount'])||value.version!==1)fail();
  for(const field of ['productName','vendor'])if(value[field]!==undefined&&!shortText(value[field],160))fail();
  if(value.productUrl!==undefined&&(typeof value.productUrl!=='string'||!validProductUrl(value.productUrl)))throw new Error('Use a full http or https product link without embedded credentials.');
  if(!['unspecified','exact','visual-substitute'].includes(String(value.match))||!['owned','wishlist','selected','ordered'].includes(String(value.status)))fail();
  if(value.currency!==null&&(typeof value.currency!=='string'||!/^[A-Z]{3}$/.test(value.currency)))fail();
  if(value.checkedOn!==null&&(typeof value.checkedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.checkedOn)||!Number.isFinite(Date.parse(value.checkedOn))||new Date(value.checkedOn).toISOString().slice(0,10)!==value.checkedOn))fail();
  if(value.unitPriceMinor!==null&&(!integer(value.unitPriceMinor,0,MAX_PRICE_MINOR)||value.currency===null||value.checkedOn===null))fail();
  const purchase=value.purchase,discount=value.discount;
  if(!record(purchase)||!exactKeys(purchase,['unit','quantity','unitsPerPack'])||!['item','pack'].includes(String(purchase.unit))||!integer(purchase.quantity,1,1000))fail();
  if(purchase.unit==='item'&&(purchase.quantity!==1||purchase.unitsPerPack!==undefined))fail();
  if(purchase.unit==='pack'&&!integer(purchase.unitsPerPack,1,1000))fail();
  if(!record(discount)||!exactKeys(discount,['kind','value'])||!['none','percent','fixed'].includes(String(discount.kind))||!integer(discount.value,0,discount.kind==='percent'?10_000:MAX_PRICE_MINOR*1000))fail();
  if(discount.kind==='none'&&discount.value!==0)fail();
  if(discount.kind==='fixed'&&(value.currency===null||value.unitPriceMinor!==null&&discount.value>(value.unitPriceMinor as number)*purchase.quantity))throw new Error('A fixed discount needs a currency and cannot exceed the known line price.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>5000)fail();
  return structuredClone(value) as unknown as PlacementSpecification;
}
export function currencyDigits(currency:string):number {if(!/^[A-Z]{3}$/.test(currency))throw new Error('Use a three-letter currency code.');return new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;}
export function parseMoneyInput(text:string,currency:string):number|null {
  if(!text.trim())return null;
  const digits=currencyDigits(currency),pattern=digits?new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`):/^\d+$/;if(!pattern.test(text.trim()))throw new Error(`Enter an amount with up to ${digits} decimal places, without commas.`);
  const [whole,fraction='']=text.trim().split('.'),minor=Number(whole)*10**digits+Number(fraction.padEnd(digits,'0'));
  if(!integer(minor,0,MAX_PRICE_MINOR))throw new Error('The price is outside the supported range.');return minor;
}
export function moneyInput(minor:number|null,currency:string|null):string {return minor===null?'':(minor/10**currencyDigits(currency??'USD')).toFixed(currencyDigits(currency??'USD'));}
export function formatMoney(minor:number,currency:string):string {return new Intl.NumberFormat(undefined,{style:'currency',currency,currencyDisplay:'code'}).format(minor/10**currencyDigits(currency));}
export function updatePlacementSpecification(base:SelectionPlan,current:SelectionPlan,itemId:string,value:unknown,validate:(plan:unknown)=>void):SelectionPlan {
  if(base!==current)throw new Error('The project changed. Reopen this item before saving its selection.');
  if(!base.furniture.some(p=>p.id===itemId))throw new Error('This item is no longer in the project.');
  const specification=value===undefined?undefined:parsePlacementSpecification(value);
  const next={...base,furniture:base.furniture.map(item=>{if(item.id!==itemId)return item;const {specification:_old,...rest}=item;return specification?{...rest,specification}:rest;})};
  validate(next);if(new TextEncoder().encode(JSON.stringify(next)).length>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');return next;
}

export interface RoomAssignment {key:string;name:string;warning?:string}
type Point={x:number;z:number};
function containsPoint(point:Point,ring:Point[]):{inside:boolean;boundary:boolean}{
  let inside=false,boundary=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/length)):0;
    if(Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz)<=0.001)boundary=true;
    if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return {inside:inside||boundary,boundary};
}
/** Exact placement center against each polygon/rectangle; never a grouped-room bounding box. */
export function classifySelectionRoom(floor:FloorPlan,item:Pick<FurniturePlacement,'x'|'z'>):RoomAssignment {
  return assignRoom(floor,item,!!floor.blueprint&&floor.blueprint.geometryKey===geometryKey(floor));
}
function assignRoom(floor:FloorPlan,item:Pick<FurniturePlacement,'x'|'z'>,currentGeometry:boolean):RoomAssignment {
  if(!floor.blueprint?.rooms.length)return {key:'unassigned',name:'Unassigned',warning:'No current named room geometry is available.'};
  if(!currentGeometry)return {key:'unassigned',name:'Unassigned',warning:'Room labels are out of date after floor edits.'};
  const matches=new Map<string,{name:string;boundary:boolean}>();
  for(const room of floor.blueprint.rooms){
    if(item.x<room.x-.001||item.x>room.x+room.width+.001||item.z<room.z-.001||item.z>room.z+room.depth+.001)continue;
    const ring=room.polygon??[{x:room.x,z:room.z},{x:room.x+room.width,z:room.z},{x:room.x+room.width,z:room.z+room.depth},{x:room.x,z:room.z+room.depth}];
    const hit=containsPoint(item,ring);if(!hit.inside)continue;
    const id=room.groupId??room.id,old=matches.get(id);matches.set(id,{name:old?.name??room.name,boundary:(old?.boundary??true)&&hit.boundary});
  }
  if(!matches.size)return {key:'unassigned',name:'Unassigned',warning:'The item center is outside named rooms.'};
  if(matches.size>1)return {key:'ambiguous',name:'Check room',warning:'The item center belongs to multiple rooms: '+[...matches.values()].map(r=>r.name).join(', ')+'.'};
  const [key,room]=[...matches][0];return {key,name:room.name,...(room.boundary?{warning:'The item center is on a room edge; check its assignment.'}:{})};
}
export interface SelectionRow {id:string;name:string;catalogName:string;floorId:string;floorName:string;room:RoomAssignment;dimensions:{widthMm:number;depthMm:number;heightMm:number};specification:PlacementSpecification;specified:boolean;grossMinor:number|null;discountMinor:number|null;netMinor:number|null}
export interface CurrencyTotal {currency:string|null;knownMinor:number;unknown:number;ownedKnownMinor:number;ownedUnknown:number;placements:number;purchaseUnits:number}
export interface ScheduleGroup {floorId:string;floorName:string;roomKey?:string;roomName?:string;rows:SelectionRow[];totals:CurrencyTotal[]}
export interface SelectionSchedule {projectName:string;revision:string;generatedAt:string;rows:SelectionRow[];totals:CurrencyTotal[];floors:ScheduleGroup[];rooms:ScheduleGroup[]}
export function selectionLinePrice(spec:PlacementSpecification):{grossMinor:number|null;discountMinor:number|null;netMinor:number|null}{
  if(spec.unitPriceMinor===null)return {grossMinor:null,discountMinor:null,netMinor:null};
  const grossMinor=spec.unitPriceMinor*spec.purchase.quantity;
  const discountMinor=spec.discount.kind==='fixed'?spec.discount.value:spec.discount.kind==='percent'?Math.round(grossMinor*spec.discount.value/10000):0;
  return {grossMinor,discountMinor,netMinor:grossMinor-discountMinor};
}
export function selectionTotals(rows:SelectionRow[]):CurrencyTotal[]{
  const byCurrency=new Map<string|null,CurrencyTotal>();
  for(const row of rows){const s=row.specification,key=s.currency,total=byCurrency.get(key)??{currency:key,knownMinor:0,unknown:0,ownedKnownMinor:0,ownedUnknown:0,placements:0,purchaseUnits:0};
    total.placements++;total.purchaseUnits+=s.purchase.quantity;
    if(s.status==='owned'){if(row.netMinor===null)total.ownedUnknown++;else total.ownedKnownMinor+=row.netMinor;}
    else if(row.netMinor===null)total.unknown++;else total.knownMinor+=row.netMinor;
    byCurrency.set(key,total);
  }
  return [...byCurrency.values()].sort((a,b)=>(a.currency??'').localeCompare(b.currency??''));
}
export function specificationFor(item:SpecifiedPlacement):PlacementSpecification {
  if(item.specification)return parsePlacementSpecification(item.specification);
  const fallback=defaultSpecification();
  if(item.personalItem){fallback.match='visual-substitute';fallback.status=item.personalItem.status==='keep'?'owned':'wishlist';}
  return fallback;
}
export function buildSelectionSchedule(plan:SelectionPlan,generatedAt=new Date().toISOString()):SelectionSchedule {
  const floorsById=new Map(plan.floors.map(f=>[f.id,f]));
  const currentRooms=new Map(plan.floors.map(f=>[f.id,!!f.blueprint&&f.blueprint.geometryKey===geometryKey(f)]));
  const rows=plan.furniture.map(item=>{
    const floor=floorsById.get(item.floorId);if(!floor)throw new Error('A scheduled item belongs to a missing floor.');
    const specification=specificationFor(item);
    const personalName=(item as FurniturePlacement&{personalItem?:{name?:string}}).personalItem?.name;
    return {id:item.id,name:specification.productName??personalName??catalogNames.get(item.catalogId)??'Unavailable furniture',catalogName:(item.personalItem?'Approximate visual · ':'')+(catalogNames.get(item.catalogId)??'Unavailable furniture'),floorId:floor.id,floorName:floor.name,room:assignRoom(floor,item,currentRooms.get(floor.id)??false),dimensions:{widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm},specification,specified:!!item.specification,...selectionLinePrice(specification)};
  });
  const floorGroups=new Map<string,ScheduleGroup>(),roomGroups=new Map<string,ScheduleGroup>();
  for(const row of rows){const floor=floorGroups.get(row.floorId)??{floorId:row.floorId,floorName:row.floorName,rows:[],totals:[]};floor.rows.push(row);floorGroups.set(row.floorId,floor);const roomId=JSON.stringify([row.floorId,row.room.key]),room=roomGroups.get(roomId)??{floorId:row.floorId,floorName:row.floorName,roomKey:row.room.key,roomName:row.room.name,rows:[],totals:[]};room.rows.push(row);roomGroups.set(roomId,room);}
  for(const group of [...floorGroups.values(),...roomGroups.values()])group.totals=selectionTotals(group.rows);
  const input=JSON.stringify({id:plan.id,updatedAt:plan.updatedAt,floors:plan.floors,furniture:plan.furniture});let hash=2166136261;for(let i=0;i<input.length;i++)hash=Math.imul(hash^input.charCodeAt(i),16777619);
  return {projectName:plan.name,revision:`${plan.updatedAt} / ${input.length}-${(hash>>>0).toString(16)}`,generatedAt,rows,totals:selectionTotals(rows),floors:[...floorGroups.values()],rooms:[...roomGroups.values()]};
}

/** Strip all specification fields, including private URLs, from every known plan snapshot surface. */
export function stripSelectionSpecifications<T extends PlanDocumentV1>(plan:T):T {
  const strip=(items:FurniturePlacement[])=>items.map(item=>{const {specification:_private,...rest}=item as SpecifiedPlacement;return rest;});
  const {selectionBudgets:_budgets,...publicPlan}=plan as T&{selectionBudgets?:unknown};
  return {...publicPlan,furniture:strip(plan.furniture),...(plan.layoutAlternatives?{layoutAlternatives:{...plan.layoutAlternatives,options:plan.layoutAlternatives.options.map(option=>{const {selectionBudgets:_target,...snapshot}=option.snapshot as typeof option.snapshot&{selectionBudgets?:unknown};return {...option,snapshot:{...snapshot,furniture:strip(snapshot.furniture)}};})}}:{}),...(plan.studioDrafts?{studioDrafts:Object.fromEntries(Object.entries(plan.studioDrafts).map(([id,draft])=>[id,{...draft,draft:{...draft.draft,fixtures:strip(draft.draft.fixtures)}}]))}:{})} as T;
}
const csvCell=(value:unknown)=>{let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
const matchLabel=(match:PlacementSpecification['match'])=>match==='exact'?'Exact product':match==='visual-substitute'?'Visual substitute':'Not specified';
export function selectionScheduleCsv(schedule:SelectionSchedule):string {
  const heading=['Project','Snapshot revision','Generated at','Item','Catalog representation','Floor','Room','Room note','Status','Product match','Vendor','Product URL','Purchase unit','Purchase quantity','Units per pack','Width mm','Depth mm','Height mm','Currency','Manual unit price','Discount','Known line total','Price checked on'];
  const rows=schedule.rows.map(row=>{const s=row.specification,c=s.currency;return [schedule.projectName,schedule.revision,schedule.generatedAt,row.name,row.catalogName,row.floorName,row.room.name,row.room.warning??'',row.specified?s.status:'Not specified',matchLabel(s.match),s.vendor??'',s.productUrl??'',s.purchase.unit,s.purchase.quantity,s.purchase.unitsPerPack??'',row.dimensions.widthMm,row.dimensions.depthMm,row.dimensions.heightMm,c??'Unknown',s.unitPriceMinor===null?'Unknown':moneyInput(s.unitPriceMinor,c),s.discount.kind==='none'?'None':s.discount.kind==='percent'?`${s.discount.value/100}%`:moneyInput(s.discount.value,c),row.netMinor===null?'Unknown':moneyInput(row.netMinor,c),s.checkedOn??'Unknown'];});
  return '\ufeff'+[heading,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const totalHtml=(totals:CurrencyTotal[])=>totals.map(total=>`<li>${escapeHtml(total.currency??'Currency not set')}: <strong>${total.currency?escapeHtml(formatMoney(total.knownMinor,total.currency)):'Unknown'}</strong> known non-owned amount; ${total.unknown} missing prices. Owned separately: ${total.currency?escapeHtml(formatMoney(total.ownedKnownMinor,total.currency)):'Unknown'} known, ${total.ownedUnknown} missing prices.</li>`).join('');
export function selectionScheduleHtml(schedule:SelectionSchedule):string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(schedule.projectName)} — selections</title><style>body{font:13px system-ui,sans-serif;color:#192c24;margin:24px}h1{font-size:24px}h2{font-size:18px;margin-top:24px}small{display:block;color:#46564f}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #b7c3b8;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2e9}a{color:inherit}tr{break-inside:avoid}thead{display:table-header-group}@page{size:landscape;margin:12mm}@media print{body{margin:0}h2{break-after:avoid}}</style></head><body><h1>${escapeHtml(schedule.projectName)} — selections</h1><p>Snapshot revision: ${escapeHtml(schedule.revision)}<br>Prepared: ${escapeHtml(schedule.generatedAt)}</p><p>Manual prices only. Unknown prices are incomplete totals. Currencies are separate. Owned items are excluded from the amount to buy. Tax, delivery, stock and installation are not estimated. Pack quantities describe purchases, not extra placed models. Room assignment uses the item center; check flagged boundaries.</p><h2>Project totals</h2><ul>${totalHtml(schedule.totals)}</ul>${schedule.floors.map(f=>`<h2>${escapeHtml(f.floorName)}</h2><ul>${totalHtml(f.totals)}</ul>${schedule.rooms.filter(r=>r.floorId===f.floorId).map(room=>`<h3>${escapeHtml(room.roomName)}</h3><ul>${totalHtml(room.totals)}</ul><table><thead><tr><th>Item / representation</th><th>Selection / source</th><th>Dimensions (mm)</th><th>Purchase</th><th>Manual price / checked</th><th>Line total</th></tr></thead><tbody>${room.rows.map(row=>{const s=row.specification;return `<tr><td>${escapeHtml(row.name)}<small>${escapeHtml(row.catalogName)}</small>${row.room.warning?`<small>${escapeHtml(row.room.warning)}</small>`:''}</td><td>${escapeHtml(row.specified?s.status:'Not specified')} · ${escapeHtml(matchLabel(s.match))}<small>${escapeHtml(s.vendor??'No vendor')}</small>${s.productUrl?`<a href="${escapeHtml(s.productUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.productUrl)}</a>`:''}</td><td>${row.dimensions.widthMm} × ${row.dimensions.depthMm} × ${row.dimensions.heightMm}</td><td>${s.purchase.quantity} ${s.purchase.unit}${s.purchase.unit==='pack'?` (${s.purchase.unitsPerPack} units each)`:''}</td><td>${s.unitPriceMinor===null?'Unknown':escapeHtml(formatMoney(s.unitPriceMinor,s.currency!))}<small>Checked ${escapeHtml(s.checkedOn??'unknown')}</small><small>Discount: ${s.discount.kind==='none'?'none':s.discount.kind==='percent'?`${s.discount.value/100}%`:escapeHtml(formatMoney(s.discount.value,s.currency!))}</small></td><td>${row.netMinor===null?'Unknown':escapeHtml(formatMoney(row.netMinor,s.currency!))}${s.status==='owned'?'<small>Owned — excluded from amount to buy</small>':''}</td></tr>`;}).join('')}</tbody></table>`).join('')}`).join('')}</body></html>`;
}
export function downloadSelectionSchedule(schedule:SelectionSchedule,format:'csv'|'html'):void {const blob=new Blob([format==='csv'?selectionScheduleCsv(schedule):selectionScheduleHtml(schedule)],{type:format==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`selections.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function printSelectionSchedule(schedule:SelectionSchedule):void {const page=window.open('about:blank','_blank');if(!page)throw new Error('Allow this site to open the printable schedule, or download the HTML copy.');page.opener=null;page.document.open();page.document.write(selectionScheduleHtml(schedule));page.document.close();page.focus();page.setTimeout(()=>page.print(),100);}
