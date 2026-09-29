import type {CaptureItem,CaptureReviewSnapshot,CaptureValue} from './captureReview';
import type {ScanDimension,ScanFixture,ScanRoom,ScanWall} from './recognitionContract';

function Shape({item,value}:{item:CaptureItem;value:CaptureValue}) {
  if(item.kind==='room'){const r=value as ScanRoom;return <rect x={r.x} y={r.y} width={r.width} height={r.height} vectorEffect="non-scaling-stroke"/>;}
  if(item.kind==='fixture'){const f=value as ScanFixture;return <rect x={-f.width/2} y={-f.depth/2} width={f.width} height={f.depth} transform={`translate(${f.x} ${f.y}) rotate(${-f.rotation})`} vectorEffect="non-scaling-stroke"/>;}
  const s=value as ScanWall|ScanDimension;return <line x1={s.ax} y1={s.ay} x2={s.bx} y2={s.by} vectorEffect="non-scaling-stroke"/>;
}
/** Can be rendered inside Studio's existing pixel-coordinate reference group. No image is persisted here. */
export function CaptureGeometryOverlay({item,measurement}:{item?:CaptureItem;measurement?:CaptureReviewSnapshot['measurement']}) {
  return <g pointerEvents="none">
    {item&&<><g stroke="#a45c00" strokeWidth={5} strokeDasharray="8 5" fill="none"><Shape item={item} value={item.original}/></g><g stroke={item.decision==='reject'?'#ba3434':'#006e67'} strokeWidth={2} fill="none"><Shape item={item} value={item.current}/></g></>}
    {measurement&&<g stroke="#7b3bb2" strokeWidth={3}><line x1={measurement.ax} y1={measurement.ay} x2={measurement.bx} y2={measurement.by} vectorEffect="non-scaling-stroke"/><circle cx={measurement.ax} cy={measurement.ay} r={4} fill="#fff"/><circle cx={measurement.bx} cy={measurement.by} r={4} fill="#fff"/></g>}
  </g>;
}
export function CaptureReferencePreview({reference,item,measurement}:{reference:{url:string;width:number;height:number};item?:CaptureItem;measurement?:CaptureReviewSnapshot['measurement']}) {
  return <figure className="capture-reference-preview"><svg viewBox={`0 0 ${reference.width} ${reference.height}`} role="img" aria-label={item?`Reference comparison for ${item.label}`:'Verified measurement on reference'}><image href={reference.url} width={reference.width} height={reference.height}/><CaptureGeometryOverlay item={item} measurement={measurement}/></svg><figcaption>Dashed amber: original. Solid green: edited or kept. Red: rejected. Purple: verified measurement.</figcaption></figure>;
}
