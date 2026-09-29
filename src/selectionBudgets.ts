import {currencyDigits,type SelectionSchedule,type SelectionPlan} from './selectionSchedule';
import type {PlanDocumentV1} from './types';
export interface SelectionBudgetTarget {scope:'project'|'floor'|'room';floorId?:string;roomKey?:string;currency:string;amountMinor:number}
export interface SelectionBudgets {version:1;targets:SelectionBudgetTarget[]}
const key=(target:SelectionBudgetTarget)=>JSON.stringify([target.scope,target.floorId??'',target.roomKey??'',target.currency]);
export function parseSelectionBudgets(value:unknown):SelectionBudgets {
  const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
  function fail():never{throw new Error('Use valid, unique budget targets with a currency and non-negative amount.');}
  if(!record(value)||value.version!==1||Object.keys(value).some(k=>!['version','targets'].includes(k))||!Array.isArray(value.targets)||value.targets.length>100)fail();
  const ids=new Set<string>();
  for(const t of value.targets){if(!record(t)||Object.keys(t).some(k=>!['scope','floorId','roomKey','currency','amountMinor'].includes(k))||!['project','floor','room'].includes(String(t.scope))||typeof t.currency!=='string'||!/^[A-Z]{3}$/.test(t.currency)||!Number.isSafeInteger(t.amountMinor)||(t.amountMinor as number)<0||(t.amountMinor as number)>100_000_000_000)fail();
    for(const field of ['floorId','roomKey'])if(t[field]!==undefined&&(typeof t[field]!=='string'||!t[field].length||t[field].length>160))fail();
    if(t.scope==='project'&&(t.floorId!==undefined||t.roomKey!==undefined)||t.scope==='floor'&&(t.floorId===undefined||t.roomKey!==undefined)||t.scope==='room'&&(t.floorId===undefined||t.roomKey===undefined))fail();
    const id=key(t as unknown as SelectionBudgetTarget);if(ids.has(id))fail();ids.add(id);
  }
  return structuredClone(value) as unknown as SelectionBudgets;
}
export function parseBudgetAmount(input:string,currency:string):number {
  const digits=currencyDigits(currency),pattern=digits?new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`):/^\d+$/;
  if(!pattern.test(input.trim()))throw new Error('Enter a budget amount using this currency’s decimal places.');
  const [whole,part='']=input.trim().split('.'),value=Number(whole)*10**digits+Number(part.padEnd(digits,'0'));
  if(!Number.isSafeInteger(value)||value<0||value>100_000_000_000)throw new Error('The target is outside the supported budget range.');return value;
}
export function updateSelectionBudget(base:SelectionPlan,current:SelectionPlan,target:SelectionBudgetTarget,remove:boolean,validate:(p:unknown)=>void):SelectionPlan {
  if(base!==current)throw new Error('The project changed. Review the budget again.');
  const targets=(base.selectionBudgets?.targets??[]).filter(t=>key(t)!==key(target));if(!remove)targets.push(target);
  const next={...base,selectionBudgets:parseSelectionBudgets({version:1,targets})};validate(next);
  if(new TextEncoder().encode(JSON.stringify(next)).length>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');return next;
}
export function compareSelectionBudgets(plan:Pick<PlanDocumentV1,'floors'>,schedule:SelectionSchedule,budgets?:SelectionBudgets){
  return (budgets?parseSelectionBudgets(budgets).targets:[]).map(target=>{
    const floor=plan.floors.find(f=>f.id===target.floorId),room=floor?.blueprint?.rooms.find(r=>(r.groupId??r.id)===target.roomKey);
    const orphaned=target.scope!=='project'&&(!floor||target.scope==='room'&&!room),label=target.scope==='project'?'Whole project':target.scope==='floor'?floor?.name??'Unavailable floor':`${floor?.name??'Unavailable floor'} · ${room?.name??'Unavailable room'}`;
    const relevant=schedule.rows.filter(row=>row.specification.status!=='owned'&&(target.scope==='project'||row.floorId===target.floorId));
    const allocated=relevant.filter(row=>(target.scope!=='room'||row.room.key===target.roomKey)&&row.specification.currency===target.currency);
    const knownMinor=allocated.reduce((sum,row)=>sum+(row.netMinor??0),0),unknownPrices=relevant.filter(row=>(target.scope!=='room'||row.room.key===target.roomKey)&&(row.specification.currency===target.currency||row.specification.currency===null)&&row.netMinor===null).length;
    const unassignedRows=target.scope==='room'?relevant.filter(row=>['unassigned','ambiguous'].includes(row.room.key)&&(row.specification.currency===target.currency||row.specification.currency===null)).length:0;
    return {target,label,orphaned,knownMinor,remainingMinor:target.amountMinor-knownMinor,overTargetMinor:Math.max(0,knownMinor-target.amountMinor),unknownPrices,unassignedRows};
  });
}
