import {expect,it} from 'vitest';
import {beginCaptureAttempt,CAPTURE_ATTEMPT_KEY,captureAttemptDuration,captureAttemptReport,finishCaptureAttempt,loadCaptureAttempts,validateCaptureAttempt} from '../src/captureAttempt';
import {captureBenchmarkReport,saveCaptureBenchmark,loadCaptureBenchmarks,validateCaptureBenchmarkCase,type BenchmarkStorage,type CaptureBenchmarkCase} from '../src/captureBenchmark';
import {completeCaptureReview} from '../src/captureReview';
import {reviewed,source} from './capture-fixtures';
const storage=():BenchmarkStorage=>{const values=new Map<string,string>();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};};

it('requires opt-in and binds measured timing to the exact source and review, never a restored lookup',()=>{
  const db=storage();expect(()=>beginCaptureAttempt(db,source,false,100)).toThrow(/explicitly/);expect(loadCaptureAttempts(db)).toEqual([]);
  const started=beginCaptureAttempt(db,source,true,100),done=finishCaptureAttempt(db,started,'proposal',900,1000),review=reviewed();
  expect(captureAttemptDuration(done,review)).toBe(900);expect(captureAttemptDuration(undefined,review)).toBeUndefined();
  for(const next of [{...review,startedAtMs:1001},{...review,source:{...source,id:'other'}},{...review,source:{...source,page:2}},{...review,source:{...source,rotation:90 as const}},{...review,source:{...source,pipelineVersion:'other'}}])expect(captureAttemptDuration(done,next)).toBeUndefined();
  expect(()=>finishCaptureAttempt(db,started,'failed',1000)).toThrow(/changed/);
  const text=JSON.stringify(loadCaptureAttempts(db));expect(text).not.toMatch(/data:|https:|filename|image|message/);
});
it('separates workflow failures, cancellations and unknown outcomes from geometry accuracy',()=>{
  const db=storage(),begin=()=>beginCaptureAttempt(db,source,true,100);
  finishCaptureAttempt(db,begin(),'failed',10);finishCaptureAttempt(db,begin(),'proposal',20,1000);finishCaptureAttempt(db,begin(),'cancelled',5);begin();
  const report=captureAttemptReport(loadCaptureAttempts(db));expect(report).toMatchObject({total:4,proposals:1,failed:1,cancelled:1,unfinishedOrUnknown:1,failureDenominator:2,failureRate:.5});
  expect(captureAttemptReport([]).failureRate).toBeUndefined();expect(loadCaptureAttempts(db).at(-1)?.outcome).toBe('pending');
});
it('keeps failed storage completion unknown and rejects invalid duration or changed source evidence',()=>{
  const db=storage(),attempt=beginCaptureAttempt(db,source,true,100),before=db.getItem(CAPTURE_ATTEMPT_KEY);
  expect(()=>finishCaptureAttempt({...db,setItem:()=>{throw Error('quota');}},attempt,'failed',20)).toThrow('quota');expect(db.getItem(CAPTURE_ATTEMPT_KEY)).toBe(before);
  expect(()=>finishCaptureAttempt(db,{...attempt,source:{...source,page:2}},'failed',20)).toThrow(/changed/);
  expect(()=>finishCaptureAttempt(db,attempt,'failed',-1)).toThrow(/timing/);expect(()=>finishCaptureAttempt(db,attempt,'failed',Infinity)).toThrow(/timing/);
  expect(()=>validateCaptureAttempt({...attempt,source:{...source,method:'manual-tracing'}})).toThrow(/timing/);
});
it('bounds the local denominator without silently evicting or reclassifying attempts',()=>{
  const db=storage();for(let i=0;i<100;i++)beginCaptureAttempt(db,source,true,i);
  expect(()=>beginCaptureAttempt(db,source,true,101)).toThrow(/100-attempt/);expect(captureAttemptReport(loadCaptureAttempts(db)).unfinishedOrUnknown).toBe(100);
  db.setItem(CAPTURE_ATTEMPT_KEY,' '.repeat(100001));expect(()=>loadCaptureAttempts(db)).toThrow(/too large/);
});
it('rejects copied timing evidence on a different measured benchmark review',()=>{
  const db=storage(),attempt=finishCaptureAttempt(db,beginCaptureAttempt(db,source,true,100),'proposal',900,1000);
  const c:CaptureBenchmarkCase={version:1,id:'case',label:'Synthetic measured rectangle',consent:'local-only',sourceKind:'image',readability:'clear',complexity:'simple',review:completeCaptureReview(reviewed(),source,'draft-1',5000).snapshot,expected:[{itemId:'room:0',kind:'bounds',widthMm:4000,heightMm:3000}],toleranceMm:20,captureDurationMs:900,attempt};
  expect(validateCaptureBenchmarkCase(c).attempt?.id).toBe(attempt.id);
  expect(()=>validateCaptureBenchmarkCase({...c,captureDurationMs:901})).toThrow(/exact source/);
  expect(()=>validateCaptureBenchmarkCase({...c,review:{...c.review,source:{...source,id:'new-reference'}}})).toThrow(/exact source/);
  expect(()=>captureBenchmarkReport([c,{...c,id:'duplicate'}])).toThrow(/one measured benchmark/);
  saveCaptureBenchmark(db,c,true);expect(()=>saveCaptureBenchmark(db,{...c,id:'duplicate'},true)).toThrow(/one measured benchmark/);expect(loadCaptureBenchmarks(db)).toHaveLength(1);
});
