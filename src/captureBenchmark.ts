import {scaleAssessment,type Recognition} from './recognitionContract';
import {captureItems,completeCaptureReview,validateCaptureReview,type CaptureReviewSnapshot} from './captureReview';

export type CaptureExpected =
  | {itemId:string;kind:'bounds';widthMm:number;heightMm:number;xMm?:number;yMm?:number}
  | {itemId:string;kind:'wall';axMm:number;ayMm:number;bxMm:number;byMm:number}
  | {itemId:string;kind:'dimension';millimetres:number};
export interface CaptureBenchmarkCase {
  version:1;id:string;label:string;consent:'local-only';
  sourceKind:'pdf'|'image'|'manual';readability:'clear'|'faint'|'mixed';complexity:'simple'|'stepped'|'multi-room';
  review:CaptureReviewSnapshot;expected:CaptureExpected[];toleranceMm:number;
  expectedCounts?:{rooms?:number;walls?:number;openings?:number};
  /** Durations use reference-ready -> capture proposal -> verified review. No estimate is substituted. */
  captureDurationMs?:number;manualDurationMs?:number;timingProtocol?:'same-reference-ready-start';
}
export interface CaptureBenchmarkMetric {itemId:string;kind:CaptureExpected['kind'];status:'within-tolerance'|'outside-tolerance'|'missing'|'scale-unverified';maxErrorMm?:number;meanErrorMm?:number;errorsMm?:number[]}
export interface CaptureBenchmarkPhase {status:'within-tolerance'|'outside-tolerance'|'incomplete';metrics:CaptureBenchmarkMetric[];countDifferences:{kind:string;expected:number;actual:number}[];geometryMeanErrorMm?:number;dimensionMeanErrorMm?:number;missing:number;scaleUnverified:number}
export const CAPTURE_BENCHMARK_KEY='nook-capture-benchmark-v1';
const MAX_CASES=30,MAX_BYTES=2_000_000;
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const safeText=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const mean=(ns:number[])=>ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:undefined;
const median=(ns:number[])=>{if(!ns.length)return undefined;const sorted=ns.slice().sort((a,b)=>a-b),m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;};
export function validateCaptureBenchmarkCase(input:unknown):CaptureBenchmarkCase {
  const c=input as CaptureBenchmarkCase;
  if(!c||c.version!==1||!safeText(c.id,100)||!safeText(c.label,100)||c.consent!=='local-only'||!['pdf','image','manual'].includes(c.sourceKind)||!['clear','faint','mixed'].includes(c.readability)||!['simple','stepped','multi-room'].includes(c.complexity)||!finite(c.toleranceMm,1,1000)||!Array.isArray(c.expected)||!c.expected.length||c.expected.length>100)throw new Error('Add a consented local benchmark case with measured reference values and a 1–1,000 mm tolerance.');
  const review=validateCaptureReview(c.review);
  if(review.completedAtMs===undefined)throw new Error('Complete the capture review before recording a benchmark.');
  completeCaptureReview(review,review.source,review.draftKey,review.completedAtMs);
  const ids=new Set<string>(),items=captureItems(review);
  const expected:CaptureExpected[]=c.expected.map(e=>{
    if(!e||!safeText(e.itemId,30)||ids.has(e.itemId))throw new Error('Each measured benchmark target must be unique.');ids.add(e.itemId);
    const item=items.find(i=>i.id===e.itemId);if(!item)throw new Error('The measured target is not part of this capture.');
    if(e.kind==='bounds'){
      if(!['room','fixture'].includes(item.kind)||!finite(e.widthMm,10,480000)||!finite(e.heightMm,10,480000)||e.xMm!==undefined&&!finite(e.xMm,0,480000)||e.yMm!==undefined&&!finite(e.yMm,0,480000))throw new Error('Invalid measured reference bounds.');
      return {itemId:e.itemId,kind:e.kind,widthMm:e.widthMm,heightMm:e.heightMm,...(e.xMm===undefined?{}:{xMm:e.xMm}),...(e.yMm===undefined?{}:{yMm:e.yMm})};
    }
    if(e.kind==='wall'){
      if(item.kind!=='wall'||![e.axMm,e.ayMm,e.bxMm,e.byMm].every(n=>finite(n,0,480000))||Math.hypot(e.bxMm-e.axMm,e.byMm-e.ayMm)<10)throw new Error('Invalid measured wall endpoints.');
      return {itemId:e.itemId,kind:e.kind,axMm:e.axMm,ayMm:e.ayMm,bxMm:e.bxMm,byMm:e.byMm};
    }
    if(e.kind!=='dimension'||item.kind!=='dimension'||!finite(e.millimetres,100,60000))throw new Error('Invalid measured reference dimension.');
    return {itemId:e.itemId,kind:e.kind,millimetres:e.millimetres};
  });
  let expectedCounts:CaptureBenchmarkCase['expectedCounts'];
  if(c.expectedCounts){expectedCounts={};for(const kind of ['rooms','walls','openings'] as const){const n=c.expectedCounts[kind];if(n===undefined)continue;if(!Number.isInteger(n)||!finite(n,0,300))throw new Error('Invalid measured reference counts.');expectedCounts[kind]=n;}}
  for(const n of [c.captureDurationMs,c.manualDurationMs])if(n!==undefined&&!finite(n,0,7*86400000))throw new Error('Use recorded durations, between zero and seven days.');
  if(c.timingProtocol!==undefined&&c.timingProtocol!=='same-reference-ready-start')throw new Error('Invalid benchmark timing protocol.');
  return {version:1,id:c.id,label:c.label,consent:'local-only',sourceKind:c.sourceKind,readability:c.readability,complexity:c.complexity,review,expected,toleranceMm:c.toleranceMm,...(expectedCounts?{expectedCounts}:{}),...(c.captureDurationMs===undefined?{}:{captureDurationMs:c.captureDurationMs}),...(c.manualDurationMs===undefined?{}:{manualDurationMs:c.manualDurationMs}),...(c.timingProtocol?{timingProtocol:c.timingProtocol}:{})};
}
function compare(c:CaptureBenchmarkCase,phase:'original'|'corrected'):CaptureBenchmarkPhase {
  const original=phase==='original',review=c.review,recognition:Recognition=original?review.original:review.current;
  const measured=review.measurement!,scale=original?scaleAssessment(recognition).scale:measured.millimetres/Math.hypot(measured.bx-measured.ax,measured.by-measured.ay);
  const items=captureItems(review).filter(item=>original||item.decision!=='reject');
  const metrics:CaptureBenchmarkMetric[]=c.expected.map(expected=>{
    const item=items.find(i=>i.id===expected.itemId),base={itemId:expected.itemId,kind:expected.kind};if(!item)return {...base,status:'missing'};
    const value=(original?item.original:item.current) as unknown as Record<string,number>;
    if(expected.kind!=='dimension'&&scale===undefined)return {...base,status:'scale-unverified'};
    const errors:number[]=[];
    if(expected.kind==='dimension')errors.push(Math.abs(value.millimetres-expected.millimetres));
    else if(expected.kind==='bounds'){
      errors.push(Math.abs(value.width*scale!-expected.widthMm),Math.abs((item.kind==='room'?value.height:value.depth)*scale!-expected.heightMm));
      if(expected.xMm!==undefined)errors.push(Math.abs(value.x*scale!-expected.xMm));if(expected.yMm!==undefined)errors.push(Math.abs(value.y*scale!-expected.yMm));
    }else{
      // A wall has no directed endpoint identity. Compare both orientations.
      const a=[value.ax*scale!,value.ay*scale!],b=[value.bx*scale!,value.by*scale!];
      const forward=[Math.hypot(a[0]-expected.axMm,a[1]-expected.ayMm),Math.hypot(b[0]-expected.bxMm,b[1]-expected.byMm)];
      const reverse=[Math.hypot(b[0]-expected.axMm,b[1]-expected.ayMm),Math.hypot(a[0]-expected.bxMm,a[1]-expected.byMm)];
      errors.push(...(Math.max(...forward)<=Math.max(...reverse)?forward:reverse));
    }
    const maxErrorMm=Math.max(...errors);return {...base,status:maxErrorMm<=c.toleranceMm?'within-tolerance':'outside-tolerance',maxErrorMm,meanErrorMm:mean(errors),errorsMm:errors};
  });
  const counts={rooms:items.filter(i=>i.kind==='room').length,walls:items.filter(i=>i.kind==='wall').length,openings:items.filter(i=>i.kind==='fixture'&&/^(door-|window-)/.test(((original?i.original:i.current) as unknown as {catalogId:string}).catalogId)).length};
  const countDifferences=Object.entries(c.expectedCounts??{}).map(([kind,expected])=>({kind,expected,actual:counts[kind as keyof typeof counts]}));
  const missing=metrics.filter(m=>m.status==='missing').length,scaleUnverified=metrics.filter(m=>m.status==='scale-unverified').length;
  const failed=missing>0||metrics.some(m=>m.status==='outside-tolerance')||countDifferences.some(c=>c.expected!==c.actual);
  return {status:failed?'outside-tolerance':scaleUnverified?'incomplete':'within-tolerance',metrics,countDifferences,geometryMeanErrorMm:mean(metrics.filter(m=>m.kind!=='dimension').flatMap(m=>m.errorsMm??[])),dimensionMeanErrorMm:mean(metrics.filter(m=>m.kind==='dimension').flatMap(m=>m.errorsMm??[])),missing,scaleUnverified};
}
export function runCaptureBenchmark(input:CaptureBenchmarkCase) {
  const c=validateCaptureBenchmarkCase(input),reviewElapsedMs=c.review.completedAtMs!-c.review.startedAtMs;
  const timeToVerifiedMs=c.captureDurationMs===undefined?undefined:c.captureDurationMs+reviewElapsedMs;
  const paired=c.timingProtocol==='same-reference-ready-start'&&c.manualDurationMs!==undefined&&timeToVerifiedMs!==undefined;
  return {id:c.id,label:c.label,method:c.review.source.method,sourceKind:c.sourceKind,readability:c.readability,complexity:c.complexity,toleranceMm:c.toleranceMm,measuredTargets:c.expected.length,original:compare(c,'original'),corrected:compare(c,'corrected'),reviewElapsedMs,timeToVerifiedMs,manualDurationMs:c.manualDurationMs,pairedTimeSavedMs:paired?c.manualDurationMs!-timeToVerifiedMs!:undefined};
}
export function captureBenchmarkReport(inputs:CaptureBenchmarkCase[]) {
  if(!Array.isArray(inputs)||inputs.length>MAX_CASES)throw new Error('Use at most 30 local benchmark cases.');
  const cases=inputs.map(runCaptureBenchmark);if(new Set(cases.map(c=>c.id)).size!==cases.length)throw new Error('Benchmark case IDs must be unique.');
  const complete=cases.filter(c=>c.corrected.status!=='incomplete'),originalComplete=cases.filter(c=>c.original.status!=='incomplete');
  return {version:1,sampleCount:cases.length,evaluableCases:complete.length,originalEvaluableCases:originalComplete.length,originalFailureRate:originalComplete.length?originalComplete.filter(c=>c.original.status==='outside-tolerance').length/originalComplete.length:undefined,correctedFailureRate:complete.length?complete.filter(c=>c.corrected.status==='outside-tolerance').length/complete.length:undefined,medianReviewElapsedMs:median(cases.map(c=>c.reviewElapsedMs)),medianTimeToVerifiedMs:median(cases.flatMap(c=>c.timeToVerifiedMs===undefined?[]:[c.timeToVerifiedMs])),pairedTimingCases:cases.filter(c=>c.pairedTimeSavedMs!==undefined).length,medianPairedTimeSavedMs:median(cases.flatMap(c=>c.pairedTimeSavedMs===undefined?[]:[c.pairedTimeSavedMs])),cases,limitations:['Local opt-in examples are not a representative accuracy study; coverage is shown for each case.','Measured bounds, endpoints and counts do not prove complete topology, construction accuracy or code compliance.','Missing or unverified values remain missing; no model confidence score is inferred.','Review elapsed time includes idle time. Capture and manual times are reported only when recorded under the stated protocol.']};
}
export interface BenchmarkStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export function loadCaptureBenchmarks(storage:BenchmarkStorage):CaptureBenchmarkCase[] {
  const raw=storage.getItem(CAPTURE_BENCHMARK_KEY);if(raw===null)return [];if(raw.length>MAX_BYTES||new TextEncoder().encode(raw).length>MAX_BYTES)throw new Error('The local benchmark data is too large.');
  const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>MAX_CASES)throw new Error('Invalid local benchmark collection.');const cases=parsed.map(validateCaptureBenchmarkCase);captureBenchmarkReport(cases);return cases;
}
/** Explicit consent is required on every write. This module never uploads or changes a plan. */
export function saveCaptureBenchmark(storage:BenchmarkStorage,input:CaptureBenchmarkCase,optedIn:boolean):CaptureBenchmarkCase[] {
  if(optedIn!==true)throw new Error('Choose local benchmark storage explicitly before saving a case.');
  const c=validateCaptureBenchmarkCase(input),existing=loadCaptureBenchmarks(storage),next=[...existing.filter(v=>v.id!==c.id),c];if(next.length>MAX_CASES)throw new Error('Remove a case before adding more than 30.');
  const json=JSON.stringify(next);if(new TextEncoder().encode(json).length>MAX_BYTES)throw new Error('Local benchmark storage is limited to 2 MB.');storage.setItem(CAPTURE_BENCHMARK_KEY,json);return next;
}
export function deleteCaptureBenchmark(storage:BenchmarkStorage,id:string):CaptureBenchmarkCase[] {const next=loadCaptureBenchmarks(storage).filter(c=>c.id!==id);if(next.length)storage.setItem(CAPTURE_BENCHMARK_KEY,JSON.stringify(next));else storage.removeItem(CAPTURE_BENCHMARK_KEY);return next;}
