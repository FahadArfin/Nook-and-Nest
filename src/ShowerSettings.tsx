import type {FurniturePlacement} from './types';
import {usePlanner} from './store';
export function ShowerSettings({item}:{item:FurniturePlacement}){
 const update=usePlanner(s=>s.updateFurniture);
 return <section className="inspector-section"><h3>Glass side</h3><div className="door-materials" role="group" aria-label="Shower glass side"><button aria-pressed={!item.showerMirrored} onClick={()=>update(item.id,{showerMirrored:false})}>Left</button><button aria-pressed={!!item.showerMirrored} onClick={()=>update(item.id,{showerMirrored:true})}>Right</button></div><p className="finish-intro">Viewed from the entry. Flips the complete shower layout and keeps its footprint.</p></section>;
}
