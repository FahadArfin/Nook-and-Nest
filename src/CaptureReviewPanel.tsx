import {useEffect,useState} from 'react';
import {captureItems,captureReviewStatus,completeCaptureReview,confirmCaptureMeasurement,decideCaptureItem,editCaptureItem,validateCaptureReview,type CaptureItem,type CaptureReviewSnapshot,type CaptureSource,type CaptureValue} from './captureReview';
import {CaptureBenchmarkPanel} from './CaptureBenchmarkPanel';
import {CaptureReferencePreview} from './CaptureReferencePreview';
import './capture-review.css';

const fieldLabels:Record<string,string>={x:'Left / center X (px)',y:'Top / center Y (px)',width:'Width (px)',height:'Depth (px)',depth:'Depth (px)',ax:'Start X (px)',ay:'Start Y (px)',bx:'End X (px)',by:'End Y (px)',millimetres:'Printed length (mm)',rotation:'Facing (degrees)'};
const fields=(item:CaptureItem)=>item.kind==='room'?['x','y','width','height']:item.kind==='fixture'?['x','y','width','depth','rotation']:item.kind==='wall'?['ax','ay','bx','by']:['ax','ay','bx','by','millimetres'];
const methodLabels={ 'online-recognition':'Online recognition', 'local-wall-extraction':'Local wall extraction', 'manual-tracing':'Manual tracing'};
export function CaptureReviewPanel({review,source,draftKey,reference,captureDurationMs,onChange,onHighlight,onAccept,onRestart}:{review:CaptureReviewSnapshot;source:CaptureSource;draftKey:string;reference?:{url:string;width:number;height:number};captureDurationMs?:number;onChange:(next:CaptureReviewSnapshot)=>void;onHighlight?:(item?:CaptureItem)=>void;onAccept:(proposal:ReturnType<typeof completeCaptureReview>)=>void;onRestart?:()=>void}) {
  const items=captureItems(review),[selected,setSelected]=useState(items[0]?.id??''),[error,setError]=useState(''),[values,setValues]=useState<Record<string,string>>({});
  const [span,setSpan]=useState({ax:'',ay:'',bx:'',by:'',millimetres:''});
  const item=items.find(i=>i.id===selected),status=captureReviewStatus(review,source,draftKey);
  useEffect(()=>{if(!item)return;const raw=item.current as unknown as Record<string,unknown>;setValues(Object.fromEntries(fields(item).map(k=>[k,String(raw[k])])));},[selected,review]);
  useEffect(()=>()=>onHighlight?.(undefined),[onHighlight]);
  const act=(fn:()=>void)=>{try{fn();setError('');}catch(e){setError((e as Error).message);}};
  return <section className="capture-review" aria-label="Measured capture review">
    <h2>Check this capture</h2>
    <p>{methodLabels[review.source.method]} · page {review.source.page} · {review.source.rotation}° · {review.source.widthPx} × {review.source.heightPx} px</p>
    <p>These are editable proposals. Printed dimensions are read labels; room and wall geometry is inferred. The analysis does not provide a calibrated confidence score.</p>
    {status.stale&&<div role="alert"><p>The reference or drawing changed. Start a fresh review to check the current geometry.</p>{onRestart&&<button onClick={onRestart}>Start fresh review</button>}</div>}
    <p role="status">{status.pending} items need a decision. {status.measured?'A known length is confirmed.':'Confirm a known length before applying.'}</p>
    {reference&&!status.stale&&<CaptureReferencePreview reference={reference} item={item} measurement={review.measurement}/>}
    <fieldset disabled={status.stale}><legend>1. Verify one known length</legend>
      <p>Compare the highlighted endpoints with the reference and enter a length you have checked. Values stay in millimetres.</p>
      <label>Use a detected span<select defaultValue="" onChange={e=>{const dimension=items.find(i=>i.id===e.target.value);if(!dimension)return;const d=dimension.current as unknown as Record<string,number>;setSpan({ax:String(d.ax),ay:String(d.ay),bx:String(d.bx),by:String(d.by),millimetres:''});onHighlight?.(dimension);}}><option value="">Choose a dimension or enter endpoints</option>{items.filter(i=>i.kind==='dimension').map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
      <div className="capture-fields">{Object.keys(span).map(key=><label key={key}>{key==='millimetres'?'Verified length (mm)':fieldLabels[key]}<input type="number" step="any" value={span[key as keyof typeof span]} onChange={e=>setSpan({...span,[key]:e.target.value})}/></label>)}</div>
      <button onClick={()=>act(()=>{if(Object.values(span).some(v=>!v.trim()))throw new Error('Enter the endpoints and the known measured length.');onChange(confirmCaptureMeasurement(review,Object.fromEntries(Object.entries(span).map(([key,value])=>[key,Number(value)])) as NonNullable<CaptureReviewSnapshot['measurement']>));})}>Confirm measured span</button>
      {review.measurement&&<p>Confirmed: {review.measurement.millimetres} mm between ({review.measurement.ax}, {review.measurement.ay}) and ({review.measurement.bx}, {review.measurement.by}).</p>}
    </fieldset>
    <fieldset disabled={status.stale}><legend>2. Review exact geometry</legend>
      <label>Detected item<select value={selected} onChange={e=>{setSelected(e.target.value);onHighlight?.(items.find(i=>i.id===e.target.value));}}>{items.map(i=><option key={i.id} value={i.id}>{i.decision==='pending'?'Needs review':i.decision} · {i.label}</option>)}</select></label>
      {item&&<><p><strong>{item.evidence==='printed-label'?'Read from a printed label':'Inferred geometry'}</strong> · {item.reason}</p><div className="capture-actions"><button onClick={()=>onHighlight?.(item)}>Show original and edited geometry</button><button aria-pressed={item.decision==='keep'} onClick={()=>act(()=>onChange(decideCaptureItem(review,item.id,'keep')))}>Keep original</button><button aria-pressed={item.decision==='reject'} onClick={()=>act(()=>onChange(decideCaptureItem(review,item.id,'reject')))}>Reject item</button></div>
        <details><summary>Edit this item</summary><p>Coordinates refer to the rendered page. Room positions use the top left; fixture positions use their center. The drawing remains a proposal.</p><div className="capture-fields">{fields(item).map(key=><label key={key}>{fieldLabels[key]}<input type="number" step="any" value={values[key]??''} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}</div><button onClick={()=>act(()=>{if(Object.values(values).some(v=>!v.trim()))throw new Error('Complete all geometry fields.');const value={...item.current,...Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number(v)]))};onChange(editCaptureItem(review,item.id,value as CaptureValue));})}>Use edited geometry</button></details></>}
    </fieldset>
    <fieldset disabled={status.stale}><legend>3. Correction checklist</legend>{([['boundaries','I checked the outer boundary, wall joins and room sizes.'],['openings','I checked doors/windows against the reference, including missing openings.'],['labels','I checked room labels and read the analysis notes.']] as const).map(([key,label])=><label className="capture-check" key={key}><input type="checkbox" checked={review.checklist[key]} onChange={e=>act(()=>onChange(validateCaptureReview({...review,checklist:{...review.checklist,[key]:e.target.checked},completedAtMs:undefined})))}/>{label}</label>)}</fieldset>
    {!!review.original.warnings.length&&<details><summary>Analysis notes ({review.original.warnings.length})</summary><ul>{review.original.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {error&&<p role="alert">{error}</p>}
    <button className="primary" disabled={!status.ready} onClick={()=>act(()=>onAccept(completeCaptureReview(review,source,draftKey,Date.now())))}>Preview reviewed layout</button>
    <p>Reviewing this capture does not replace your floor. Confirm the Studio layout preview to apply it.</p>
    {review.completedAtMs!==undefined&&<CaptureBenchmarkPanel review={review} captureDurationMs={captureDurationMs}/>}
  </section>;
}
