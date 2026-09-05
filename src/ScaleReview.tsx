import {useState} from 'react';
import type {PlanReference} from './blueprintImport';
import type {Recognition} from './recognitionContract';

// Review detected evidence locally. Nothing here can issue a provider request.
export function ScaleReview({reference,result,message,onConfirm,onCancel}:{reference:PlanReference;result:Recognition;message:string;onConfirm:(scale:number)=>void;onCancel:()=>void}) {
  const first=result.dimensions[0];
  const [selected,setSelected]=useState(0),[length,setLength]=useState(first?String(first.millimetres/1000):'');
  const [line,setLine]=useState(first?{ax:first.ax,ay:first.ay,bx:first.bx,by:first.by}:undefined),[start,setStart]=useState<{x:number;y:number}>();
  const [marking,setMarking]=useState(!first);
  const distance=line?Math.hypot(line.bx-line.ax,line.by-line.ay):0,mm=Number(length)*1000,scale=mm/distance;
  const valid=!!line&&distance>=5&&mm>=100&&mm<=60000&&scale>=.1&&scale<=200&&!marking;
  return <section className="bp-scale-review" aria-label="Check drawing scale">
    <h2>Check one measurement</h2><p>{message} Your detected rooms are retained. This step makes no API request.</p>
    {!!result.dimensions.length&&<label>Detected measurement<select value={selected} onChange={e=>{const index=Number(e.target.value),d=result.dimensions[index];setSelected(index);setLength(String(d.millimetres/1000));setLine({ax:d.ax,ay:d.ay,bx:d.bx,by:d.by});setStart(undefined);setMarking(false);}}>{result.dimensions.map((d,i)=><option key={i} value={i}>{d.text} · {(d.millimetres/1000).toFixed(3)} m</option>)}</select></label>}
    <p>Check that the gold line spans the distance the printed number measures, from wall to wall. Correct the length or mark new endpoints if needed.</p>
    <svg aria-label="Measurement on uploaded floor plan" viewBox={`0 0 ${reference.width} ${reference.height}`} style={{width:'100%',height:'min(48vh, 520px)',background:'#fff',cursor:marking?'crosshair':'default'}} onPointerDown={e=>{if(!marking)return;const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(p.x<0||p.y<0||p.x>reference.width||p.y>reference.height)return;if(!start){setStart({x:p.x,y:p.y});setLine(undefined);}else{setLine({ax:start.x,ay:start.y,bx:p.x,by:p.y});setStart(undefined);setMarking(false);}}}>
      <image href={reference.url} width={reference.width} height={reference.height}/>
      {line&&<g><line x1={line.ax} y1={line.ay} x2={line.bx} y2={line.by} stroke="#bc7800" strokeWidth="4" vectorEffect="non-scaling-stroke"/>{[{x:line.ax,y:line.ay},{x:line.bx,y:line.by}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={reference.width/100} fill="#ffcc55" stroke="#553800"/>)}</g>}
      {start&&<circle cx={start.x} cy={start.y} r={reference.width/100} fill="#ffcc55"/>}
    </svg>
    <button onClick={()=>{setMarking(true);setStart(undefined);}}>Mark two endpoints</button>{marking&&<p role="status">{start?'Select the other end of the measured span.':'Select the first end of the measured span.'}</p>}
    <label>Printed length (metres)<input type="number" min="0.1" max="60" step="any" value={length} onChange={e=>setLength(e.target.value)}/></label>
    <p>Use the real printed length (1 foot = 0.3048 m; 1 inch = 0.0254 m). Your 3D home stays unchanged until its final review.</p>
    <button className="primary" disabled={!valid} onClick={()=>onConfirm(scale)}>Confirm measurement & load rooms</button><button onClick={onCancel}>Cancel measurement review</button>
  </section>;
}
