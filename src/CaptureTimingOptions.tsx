import {useEffect,useState} from 'react';
import {CAPTURE_ATTEMPT_KEY,captureAttemptReport,loadCaptureAttempts} from './captureAttempt';

export function CaptureTimingOptions({enabled,onChange,revision,onClear}:{enabled:boolean;onChange:(value:boolean)=>void;revision:number;onClear:()=>void}) {
  const [report,setReport]=useState<ReturnType<typeof captureAttemptReport>>(),[error,setError]=useState('');
  const read=()=>{try{setReport(captureAttemptReport(loadCaptureAttempts(localStorage)));setError('');}catch(e){setError((e as Error).message);}};
  useEffect(()=>{if(enabled)read();},[enabled,revision]);
  return <details><summary>Local benchmark timing (optional)</summary>
    <p>Start with the reference ready; include analysis, scale correction and review. File opening is excluded. Only timed attempts are counted; cached results may be used.</p>
    <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input style={{flex:'none',width:'auto',marginTop:3}} type="checkbox" checked={enabled} onChange={e=>onChange(e.target.checked)}/>I have permission to use this reference and choose to record upcoming attempts locally for this Studio session.</label>
    <p>Timings and outcomes stay on this device, outside projects and sharing. No images, filenames or error messages. Closing Studio ends this opt-in.</p>
    <button onClick={read}>View local attempt totals</button>
    {report&&<><p>{report.total} recorded attempts: {report.proposals} proposals, {report.failed} failed, {report.cancelled} cancelled, {report.unfinishedOrUnknown} unfinished or unknown. Failure denominator: {report.failureDenominator} finished attempts. This is separate from measured geometry errors.</p>
      <button disabled={!report.total} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='capture-attempt-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}}>Export local attempt report</button>
      <button disabled={!report.total} onClick={()=>{if(!window.confirm('Delete the local attempt log? Export it first if you need its complete denominator. Saved accuracy cases are separate.'))return;try{localStorage.removeItem(CAPTURE_ATTEMPT_KEY);onClear();read();}catch(e){setError((e as Error).message);}}}>Delete local attempt log</button></>}
    {error&&<p role="alert">{error}</p>}
  </details>;
}
