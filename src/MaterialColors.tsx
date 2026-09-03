import metadata from './modelMaterials.json';
import { usePlanner } from './store';
import type { FurniturePlacement } from './types';

export function MaterialColors({item}:{item:FurniturePlacement}) {
  const update=usePlanner(s=>s.updateFurniture);
  const slots=(metadata as Record<string,{id:string;label:string;color:string}[]>)[item.catalogId]??[];
  return <section className="inspector-section material-colors"><h3>Individual parts</h3><p className="finish-intro">Change body, doors, legs, trim or fabric independently. Textures stay visible.</p>{slots.map(slot=><label key={slot.id}><span>{slot.label}</span><input type="color" aria-label={`${slot.label} color`} value={item.materialColors?.[slot.id]??slot.color} onChange={event=>update(item.id,{materialColors:{...item.materialColors,[slot.id]:event.target.value}})}/><button title={`Reset ${slot.label}`} onClick={()=>{const next={...item.materialColors};delete next[slot.id];update(item.id,{materialColors:next})}}>Reset</button></label>)}{slots.length>0&&<button onClick={()=>update(item.id,{materialColors:{}})}>Reset all parts</button>}</section>;
}
