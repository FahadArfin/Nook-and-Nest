import type {PlanDocumentV1} from './types';
export type QuantitySurface='floor'|'wall'|'ceiling';
export interface CoverageRate {wastePercent:number;coats:number;coverageM2PerUnit:number|null;unitLabel:string}
export interface SurfaceTakeoffSettings {version:1;wallFaces:'room-side'|'exterior'|'both';deductOpenings:boolean;ceiling:'not-included'|'floor-projection';rates:Record<QuantitySurface,CoverageRate>;finishRates:Array<CoverageRate&{surface:QuantitySurface;finishId:string}>;legacyOpenings:Array<{floorId:string;openingId:string;heightMm:number|null;sillMm:number}>}
export type TakeoffPlan=PlanDocumentV1&{surfaceTakeoffSettings?:SurfaceTakeoffSettings};
export interface SurfaceQuantityRow {floorId:string;floorName:string;roomKey:string;roomName:string;surface:QuantitySurface;finishId:string;finishName:string;grossM2:number|null;deductionM2:number|null;netM2:number|null;requiredM2:number|null;purchaseUnits:number|null;rate:CoverageRate;warnings:string[]}
export interface SurfaceQuantityReport {projectName:string;revision:string;settings:SurfaceTakeoffSettings;rows:SurfaceQuantityRow[];warnings:string[]}
export function defaultTakeoffSettings():SurfaceTakeoffSettings {const rate=()=>({wastePercent:10,coats:1,coverageM2PerUnit:null,unitLabel:'coverage unit'});return {version:1,wallFaces:'room-side',deductOpenings:true,ceiling:'not-included',rates:{floor:rate(),wall:rate(),ceiling:rate()},finishRates:[],legacyOpenings:[]};}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v:unknown,max=160):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const only=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
export function parseSurfaceTakeoffSettings(input:unknown):SurfaceTakeoffSettings {
  function fail():never{throw new Error('Check the surface assumptions, coverage, waste and opening measurements.');}
  if(!record(input)||!only(input,['version','wallFaces','deductOpenings','ceiling','rates','finishRates','legacyOpenings'])||input.version!==1||!['room-side','exterior','both'].includes(String(input.wallFaces))||typeof input.deductOpenings!=='boolean'||!['not-included','floor-projection'].includes(String(input.ceiling))||!record(input.rates)||!only(input.rates,['floor','wall','ceiling'])||!Array.isArray(input.finishRates)||input.finishRates.length>100||!Array.isArray(input.legacyOpenings)||input.legacyOpenings.length>2000)fail();
  const rate=(v:unknown,finish=false)=>{if(!record(v)||!only(v,['wastePercent','coats','coverageM2PerUnit','unitLabel',...(finish?['surface','finishId']:[])])||!finite(v.wastePercent,0,100)||!Number.isInteger(v.coats)||!finite(v.coats,1,10)||v.coverageM2PerUnit!==null&&!finite(v.coverageM2PerUnit,.001,100000)||!text(v.unitLabel,60))fail();};
  for(const kind of ['floor','wall','ceiling'])rate(input.rates[kind]);
  const finishes=new Set<string>();for(const r of input.finishRates){rate(r,true);if(!record(r)||!['floor','wall','ceiling'].includes(String(r.surface))||!text(r.finishId))fail();const key=JSON.stringify([r.surface,r.finishId]);if(finishes.has(key))fail();finishes.add(key);}
  const openings=new Set<string>();for(const o of input.legacyOpenings){if(!record(o)||!only(o,['floorId','openingId','heightMm','sillMm'])||!text(o.floorId)||!text(o.openingId)||o.heightMm!==null&&!finite(o.heightMm,1,20000)||!finite(o.sillMm,0,20000))fail();const key=JSON.stringify([o.floorId,o.openingId]);if(openings.has(key))fail();openings.add(key);}
  if(new TextEncoder().encode(JSON.stringify(input)).length>300_000)fail();return structuredClone(input) as unknown as SurfaceTakeoffSettings;
}
export function stripSurfaceTakeoffSettings<T extends PlanDocumentV1>(plan:T):T {const {surfaceTakeoffSettings:_settings,...rest}=plan as T&{surfaceTakeoffSettings?:unknown};return {...rest,...(plan.layoutAlternatives?{layoutAlternatives:{...plan.layoutAlternatives,options:plan.layoutAlternatives.options.map(option=>{const {surfaceTakeoffSettings:_private,...snapshot}=option.snapshot as typeof option.snapshot&{surfaceTakeoffSettings?:unknown};return {...option,snapshot};})}}:{})} as T;}
