import type {FurniturePlacement} from './types';
import {usePlanner} from './store';
export function SlidingDoorSettings({item}:{item:FurniturePlacement}){
 const update=usePlanner(s=>s.updateFurniture);
 return <section className="inspector-section"><h3>Sliding position</h3><label>Open · {Math.round((item.openFraction??0)*100)}%<input aria-label="Door open position" type="range" min="0" max="1" step="0.05" value={item.openFraction??0} onChange={e=>update(item.id,{openFraction:+e.target.value})}/></label><p className="finish-intro">Pocket leaves slide inside the adjacent solid wall. Keep space beside the opening for the pocket or barn-door travel.</p></section>;
}
