import {validateCaptureSource,type CaptureSource,type CaptureReviewSnapshot} from './captureReview';
import type {BenchmarkStorage} from './captureBenchmark';

export const CAPTURE_ATTEMPT_KEY='nook-capture-attempts-v1';
const MAX_ATTEMPTS=100,MAX_BYTES=100_000,MAX_DURATION=7*86400000;
export interface CaptureAttempt {
  version:1;id:string;source:CaptureSource;startedAtMs:number;
  outcome:'pending'|'proposal'|'failed'|'cancelled';
  elapsedMs?:number;reviewStartedAtMs?:number;
}
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
export function validateCaptureAttempt(input:unknown):CaptureAttempt {
  const a=input as CaptureAttempt;
  if(!a||a.version!==1||typeof a.id!=='string'||!/^attempt-[a-zA-Z0-9-]{1,80}$/.test(a.id)||!finite(a.startedAtMs,8.64e15)||!['pending','proposal','failed','cancelled'].includes(a.outcome))throw Error('Invalid local capture attempt.');
  const source=validateCaptureSource(a.source);
  if(source.method!=='online-recognition'||(a.outcome==='pending'?(a.elapsedMs!==undefined||a.reviewStartedAtMs!==undefined):!finite(a.elapsedMs,MAX_DURATION))||(a.outcome==='proposal'?!finite(a.reviewStartedAtMs,8.64e15):a.reviewStartedAtMs!==undefined))throw Error('Invalid capture attempt timing.');
  return {version:1,id:a.id,source,startedAtMs:a.startedAtMs,outcome:a.outcome,...(a.elapsedMs===undefined?{}:{elapsedMs:a.elapsedMs}),...(a.reviewStartedAtMs===undefined?{}:{reviewStartedAtMs:a.reviewStartedAtMs})};
}
export function loadCaptureAttempts(storage:BenchmarkStorage):CaptureAttempt[] {
  const raw=storage.getItem(CAPTURE_ATTEMPT_KEY);if(raw===null)return [];
  if(raw.length>MAX_BYTES)throw Error('The local attempt log is too large.');
  const values:unknown=JSON.parse(raw);if(!Array.isArray(values)||values.length>MAX_ATTEMPTS)throw Error('Invalid local attempt log.');
  const attempts=values.map(validateCaptureAttempt);if(new Set(attempts.map(a=>a.id)).size!==attempts.length)throw Error('Duplicate local attempt identity.');return attempts;
}
function write(storage:BenchmarkStorage,attempts:CaptureAttempt[]) {
  const raw=JSON.stringify(attempts);if(raw.length>MAX_BYTES)throw Error('The local attempt log is full. Export and clear it before another timed run.');storage.setItem(CAPTURE_ATTEMPT_KEY,raw);
}
/** Record before invoking recognition; no uploads, private names or error payloads. */
export function beginCaptureAttempt(storage:BenchmarkStorage,source:CaptureSource,optedIn:boolean,startedAtMs:number):CaptureAttempt {
  if(optedIn!==true)throw Error('Choose local benchmark timing explicitly first.');
  const attempts=loadCaptureAttempts(storage);if(attempts.length>=MAX_ATTEMPTS)throw Error('The 100-attempt log is full. Export and clear it before another timed run.');
  const attempt=validateCaptureAttempt({version:1,id:`attempt-${crypto.randomUUID()}`,source,startedAtMs,outcome:'pending'});write(storage,[...attempts,attempt]);return attempt;
}
/** Only the same pending attempt can finish; terminal outcomes cannot be overwritten. */
export function finishCaptureAttempt(storage:BenchmarkStorage,attempt:CaptureAttempt,outcome:Exclude<CaptureAttempt['outcome'],'pending'>,elapsedMs:number,reviewStartedAtMs?:number):CaptureAttempt {
  const attempts=loadCaptureAttempts(storage),index=attempts.findIndex(a=>a.id===attempt.id);
  if(index<0||attempts[index].outcome!=='pending'||JSON.stringify(attempts[index])!==JSON.stringify(validateCaptureAttempt(attempt)))throw Error('The recorded attempt changed. Its timing cannot be reused.');
  const finished=validateCaptureAttempt({...attempt,outcome,elapsedMs,reviewStartedAtMs});attempts[index]=finished;write(storage,attempts);return finished;
}
export function captureAttemptDuration(attempt:CaptureAttempt|undefined,review:CaptureReviewSnapshot):number|undefined {
  if(!attempt)return;
  try{const a=validateCaptureAttempt(attempt);if(a.outcome==='proposal'&&a.reviewStartedAtMs===review.startedAtMs&&JSON.stringify(a.source)===JSON.stringify(validateCaptureSource(review.source)))return a.elapsedMs;}catch{/* Unknown evidence is never substituted. */}
}
export function captureAttemptReport(inputs:CaptureAttempt[]) {
  if(!Array.isArray(inputs)||inputs.length>MAX_ATTEMPTS)throw Error('Invalid local attempt count.');
  const attempts=inputs.map(validateCaptureAttempt);if(new Set(attempts.map(a=>a.id)).size!==attempts.length)throw Error('Duplicate local attempt identity.');
  const count=(outcome:CaptureAttempt['outcome'])=>attempts.filter(a=>a.outcome===outcome).length;
  const proposals=count('proposal'),failed=count('failed'),terminal=proposals+failed;
  return {version:1,total:attempts.length,proposals,failed,cancelled:count('cancelled'),unfinishedOrUnknown:count('pending'),failureDenominator:terminal,failureRate:terminal?failed/terminal:undefined,attempts,limitations:['Opt-in reference-ready recognition workflows only; cached responses may be used. File-opening failures are excluded.','Failure means no editable proposal was produced. A proposal does not establish geometry accuracy or a verified plan.','Cancelled and unfinished/unknown attempts are counted separately and excluded from the failure denominator.','Small voluntary samples do not establish representative failure rates or time savings.']};
}
