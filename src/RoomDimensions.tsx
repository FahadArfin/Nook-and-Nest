import {useEffect,useState} from 'react';

function ImperialLength({label,value,onChange}:{label:string;value:number;onChange(value:number):void}) {
  // Sixteenths keep imported measurements readable without resizing them on display.
  const total=Math.round(value/25.4*16)/16;
  const feet=String(Math.floor(total/12)), inches=String(total%12);
  const [ft,setFt]=useState(feet),[inch,setInch]=useState(inches);
  useEffect(()=>{setFt(feet);setInch(inches);},[value,feet,inches]);
  const commit=()=>{
    if(ft===feet&&inch===inches)return;
    const f=Number(ft),i=Number(inch),mm=Math.round((f*12+i)*25.4);
    if(ft.trim()&&inch.trim()&&Number.isInteger(f)&&f>=0&&Number.isFinite(i)&&i>=0&&mm>=100)onChange(mm);
    else {setFt(feet);setInch(inches);}
  };
  return <fieldset className="bp-room-length"><legend>{label}</legend><label>Feet<input aria-label={`${label} feet`} type="number" min="0" step="1" value={ft} onChange={e=>setFt(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label><label>Inches<input aria-label={`${label} inches`} type="number" min="0" step="0.0625" value={inch} onChange={e=>setInch(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label></fieldset>;
}
function MetricLength({label,value,onChange}:{label:string;value:number;onChange(value:number):void}) {
  const [text,setText]=useState(String(value/1000));
  useEffect(()=>setText(String(value/1000)),[value]);
  const commit=()=>{if(Number(text)===value/1000&&text.trim())return;const mm=Math.round(Number(text)*1000);if(text.trim()&&Number.isFinite(mm)&&mm>=100)onChange(mm);else setText(String(value/1000));};
  return <label>{label} (m)<input aria-label={`${label.toLowerCase()} (m)`} type="number" min="0.1" step="0.001" value={text} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export function RoomDimensions({width,depth,onChange}:{width:number;depth:number;onChange(patch:{width?:number;depth?:number}):void}) {
  const [metric,setMetric]=useState(false);
  return <><div className="bp-button-row" role="group" aria-label="Room dimension units"><button type="button" className={!metric?'active':''} aria-pressed={!metric} onClick={()=>setMetric(false)}>Feet &amp; inches</button><button type="button" className={metric?'active':''} aria-pressed={metric} onClick={()=>setMetric(true)}>Metric</button></div>
    {(['width','depth'] as const).map(key=>{const props={label:key==='width'?'Width':'Depth',value:key==='width'?width:depth,onChange:(v:number)=>onChange({[key]:v})};return metric?<MetricLength key={key} {...props}/>:<ImperialLength key={key} {...props}/>;})}
    <small>Drag the room on the drawing to move it.</small></>;
}
