import {LengthInput} from './LengthInput';
import type {Units} from './types';
export function RoomDimensions({width,depth,onChange,units='imperial',onUnits}:{width:number;depth:number;onChange(patch:{width?:number;depth?:number}):void;units?:Units;onUnits?:(units:Units)=>void}){
return <><div className="bp-button-row" role="group" aria-label="Room dimension units"><button aria-pressed={units==='imperial'} onClick={()=>onUnits?.('imperial')}>Feet &amp; inches</button><button aria-pressed={units==='metric'} onClick={()=>onUnits?.('metric')}>Metric</button></div>{(['width','depth'] as const).map(key=><LengthInput key={key} label={key==='width'?'Width':'Depth'} value={key==='width'?width:depth} units={units} min={100} onChange={value=>onChange({[key]:value})}/>)}</>;
}
