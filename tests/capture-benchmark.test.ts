import {describe,it,expect} from 'vitest';
import {captureBenchmarkReport,deleteCaptureBenchmark,loadCaptureBenchmarks,runCaptureBenchmark,saveCaptureBenchmark,validateCaptureBenchmarkCase,type BenchmarkStorage,type CaptureBenchmarkCase} from '../src/captureBenchmark';
import {captureItems,completeCaptureReview,confirmCaptureMeasurement,createCaptureReview,decideCaptureItem,editCaptureItem} from '../src/captureReview';
import {reviewed,source,detection} from './capture-fixtures';

function caseValue():CaptureBenchmarkCase {return {version:1,id:'example-1',label:'Synthetic kitchen rectangle',consent:'local-only',sourceKind:'image',readability:'clear',complexity:'simple',review:completeCaptureReview(reviewed(),source,'draft-1',5000).snapshot,expected:[{itemId:'room:0',kind:'bounds',widthMm:4000,heightMm:3000,xMm:100,yMm:200},{itemId:'wall:0',kind:'wall',axMm:4100,ayMm:200,bxMm:100,byMm:200},{itemId:'dimension:0',kind:'dimension',millimetres:4000}],expectedCounts:{rooms:1,walls:1,openings:1},toleranceMm:20};}
function memoryStorage():BenchmarkStorage {const map=new Map<string,string>();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};}
describe('local measured capture benchmarks',()=>{
  it('compares physical bounds, undirected wall endpoints and dimensions deterministically',()=>{
    const c=caseValue(),a=runCaptureBenchmark(c);expect(a).toEqual(runCaptureBenchmark(c));expect(a.original.status).toBe('within-tolerance');expect(a.corrected.geometryMeanErrorMm).toBe(0);expect(a.corrected.dimensionMeanErrorMm).toBe(0);expect(a.reviewElapsedMs).toBe(4000);expect(a.timeToVerifiedMs).toBeUndefined();
  });
  it('exposes a measured correction instead of equating a valid API response with accuracy',()=>{
    const c=caseValue();c.expected[0]={itemId:'room:0',kind:'bounds',widthMm:4200,heightMm:3000};const edited=editCaptureItem(c.review,'room:0',{...c.review.current.rooms[0],width:420});c.review=completeCaptureReview(edited,source,'draft-1',6000).snapshot;const report=runCaptureBenchmark(c);expect(report.original.status).toBe('outside-tolerance');expect(report.corrected.status).toBe('within-tolerance');expect(report.original.metrics[0].maxErrorMm).toBe(200);
  });
  it('reports missing expected entities and count mismatches without turning them into zero error',()=>{
    const c=caseValue();c.review=completeCaptureReview(decideCaptureItem(c.review,'wall:0','reject'),source,'draft-1',6000).snapshot;const report=runCaptureBenchmark(c);expect(report.corrected.metrics[1]).toEqual({itemId:'wall:0',kind:'wall',status:'missing'});expect(report.corrected.status).toBe('outside-tolerance');expect(report.corrected.countDifferences.find(c=>c.kind==='walls')?.actual).toBe(0);
  });
  it('leaves original geometry unscored when printed dimensions conflict',()=>{
    const original={...detection,dimensions:[...detection.dimensions,{text:'8 m',millimetres:8000,ax:10,ay:20,bx:410,by:20}]};let r=createCaptureReview(original,source,'draft-1',1000);for(const i of captureItems(r))r=decideCaptureItem(r,i.id,'keep');r=confirmCaptureMeasurement(r,{ax:10,ay:20,bx:410,by:20,millimetres:4000});r.checklist={boundaries:true,openings:true,labels:true};const c=caseValue();c.review=completeCaptureReview(r,source,'draft-1',5000).snapshot;const result=runCaptureBenchmark(c);expect(result.original.status).toBe('incomplete');expect(result.original.geometryMeanErrorMm).toBeUndefined();expect(result.corrected.geometryMeanErrorMm).toBe(0);
  });
  it('only compares recorded timings with an explicit common timing protocol',()=>{
    const c=caseValue();c.captureDurationMs=2000;c.manualDurationMs=12000;expect(runCaptureBenchmark(c).pairedTimeSavedMs).toBeUndefined();c.timingProtocol='same-reference-ready-start';const report=captureBenchmarkReport([c]);expect(report.medianTimeToVerifiedMs).toBe(6000);expect(report.medianPairedTimeSavedMs).toBe(6000);expect(report.pairedTimingCases).toBe(1);
  });
  it('requires explicit local consent, supports deletion and stores no image or URL',()=>{
    const storage=memoryStorage(),c=caseValue();expect(()=>saveCaptureBenchmark(storage,c,false)).toThrow(/explicitly/);expect(loadCaptureBenchmarks(storage)).toEqual([]);saveCaptureBenchmark(storage,c,true);expect(loadCaptureBenchmarks(storage)).toHaveLength(1);expect(JSON.stringify(loadCaptureBenchmarks(storage))).not.toMatch(/data:|https:|"url"/);deleteCaptureBenchmark(storage,c.id);expect(loadCaptureBenchmarks(storage)).toEqual([]);
  });
  it('rejects invalid reference truth, duplicate targets, oversized collections and non-finite inputs',()=>{
    const c=caseValue();expect(()=>validateCaptureBenchmarkCase({...c,expected:[...c.expected,c.expected[0]]})).toThrow(/unique/);expect(()=>validateCaptureBenchmarkCase({...c,expected:[{itemId:'missing:0',kind:'bounds',widthMm:10,heightMm:10}]})).toThrow(/not part/);expect(()=>validateCaptureBenchmarkCase({...c,toleranceMm:NaN})).toThrow(/tolerance/);expect(()=>captureBenchmarkReport(Array.from({length:31},()=>c))).toThrow(/30/);expect(()=>validateCaptureBenchmarkCase({...c,consent:'upload'})).toThrow(/consented local/);
  });
  it('reports sample limits and preserves missing aggregate data',()=>{
    const report=captureBenchmarkReport([]);expect(report.correctedFailureRate).toBeUndefined();expect(report.medianTimeToVerifiedMs).toBeUndefined();expect(report.limitations.join(' ')).toContain('not a representative');
  });
});
