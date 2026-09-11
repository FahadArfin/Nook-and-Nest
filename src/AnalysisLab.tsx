import {useEffect,useRef,useState} from 'react';
import {renderReference,type PlanReference} from './blueprintImport';
import {prepareRecognition} from './prepareRecognition';

/** Local-only preview; selection changes the next explicit analysis, never a plan. */
export function AnalysisLab({reference,enabled,onChange}:{reference?:PlanReference;enabled:boolean;onChange:(value:boolean)=>void}) {
  const [preview,setPreview]=useState<{original:string;mask:string;walls:number;ms:number}>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const abort=useRef<AbortController|undefined>(undefined),file=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  async function inspect(source:PlanReference|File){
    abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setPreview(undefined);
    try{const ref=source instanceof File?await renderReference(source):source;controller.signal.throwIfAborted();const start=performance.now();const evidence=await prepareRecognition(ref,controller.signal,true);controller.signal.throwIfAborted();if(evidence.wallView)setPreview({original:ref.url,mask:evidence.wallView.image,walls:evidence.walls.length,ms:Math.round(performance.now()-start)});}
    catch(e){if(!controller.signal.aborted)setError((e as Error).message);}
    finally{if(abort.current===controller)setBusy(false);}
  }
  return <details className="bp-analysis-lab"><summary>Analysis lab · Luna</summary><p>Compare the standard analysis with an extra filtered wall view. The original image and full detail crops are always included.</p>
    <label>Analysis method<select value={enabled?'wall':'standard'} onChange={e=>onChange(e.target.value==='wall')}><option value="standard">Standard · recommended baseline</option><option value="wall">Wall evidence · experimental</option></select></label>
    <small>The wall experiment has not shown a consistent accuracy improvement in repeated tests.</small>
    <small>Changes apply to your next Import or Reanalyze. Each method has its own saved analysis cache. Fresh analysis uses the site’s API account.</small>
    <div className="bp-button-row"><button type="button" disabled={busy||!reference} onClick={()=>reference&&void inspect(reference)}>Preview current reference</button><button type="button" disabled={busy} onClick={()=>file.current?.click()}>Preview another image</button></div>
    <input ref={file} hidden type="file" accept="image/png,image/jpeg,application/pdf" aria-label="Wall preview image" onChange={e=>{const selected=e.target.files?.[0];e.target.value='';if(selected)void inspect(selected);}}/>
    <small>Preview stays on this device. It makes no API call and does not change your drawing.</small>
    {busy&&<p role="status">Filtering dark strokes… <button type="button" onClick={()=>{abort.current?.abort();setBusy(false);}}>Cancel preview</button></p>}
    {error&&<p role="alert">{error}</p>}
    {preview&&<><div className="bp-wall-comparison"><figure><img src={preview.original} alt="Original floor plan for wall comparison"/><figcaption>Original</figcaption></figure><figure><img src={preview.mask} alt="Filtered dark wall strokes; openings remain unclosed"/><figcaption>Wall evidence</figcaption></figure></div><p role="status">Prepared in {preview.ms} ms · {preview.walls} candidate strokes. Thin walls may be absent and cabinet edges may remain. This view does not establish rooms or measurements.</p></>}
  </details>;
}
