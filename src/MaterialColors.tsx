import {useEffect} from 'react';
import metadata from './modelMaterials.json';
import { usePlanner } from './store';
import type { FurniturePlacement } from './types';

export function partLabel(label:string){const s=label.toLowerCase().replace(/[_-]/g,' ');if(/stitch/.test(s))return 'Stitching';if(/upholster|fabric|tailor/.test(s))return 'Upholstery';if(/joinery|brass|metal|feet|leg/.test(s))return 'Frame & hardware';if(/wood/.test(s))return 'Wood finish';return label.replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());}
export function MaterialColors({item,onHighlight}:{item:FurniturePlacement;onHighlight?:(slot?:string)=>void}) {
  useEffect(()=>()=>onHighlight?.(),[item.id]);
  const update=usePlanner(s=>s.updateFurniture);
  const slots=(metadata as Record<string,{id:string;label:string;color:string}[]>)[item.catalogId]??[];
  return <section className="inspector-section material-colors"><h3>Individual parts</h3><p className="finish-intro">Change body, doors, legs, trim or fabric independently. Textures stay visible.</p>{slots.map(slot=><label key={slot.id} onPointerEnter={()=>onHighlight?.(slot.id)} onPointerLeave={()=>onHighlight?.()} onFocus={()=>onHighlight?.(slot.id)} onBlur={()=>onHighlight?.()}><span>{partLabel(slot.label)}</span><input type="color" aria-label={`${partLabel(slot.label)} color (${slot.label})`} value={item.materialColors?.[slot.id]??slot.color} onChange={event=>update(item.id,{materialColors:{...item.materialColors,[slot.id]:event.target.value}})}/><button aria-label={`Reset ${partLabel(slot.label)} (${slot.label})`} title={`Reset ${slot.label}`} onClick={()=>{const next={...item.materialColors};delete next[slot.id];update(item.id,{materialColors:next})}}>Reset</button></label>)}{slots.length>0&&<button onClick={()=>update(item.id,{materialColors:{}})}>Reset all parts</button>}</section>;
}
