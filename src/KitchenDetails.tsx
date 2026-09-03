import { usePlanner } from './store';
import { isBacksplash,kitchenWallIds,kitchenCeilingIds,kitchenSurfaceIds } from './kitchenCatalog';
import type { FurniturePlacement } from './types';
export function BacksplashShortcut(){
  const state=usePlanner();return <div className="finish-intro"><button className="primary" onClick={()=>{state.setCategory('Kitchen');state.setSearch('backsplash');state.setTool('select')}}>Add kitchen backsplash</button><p>Choose a panel, drag it against a wall, then confirm. Resize it around your counters and windows.</p></div>;
}
export function KitchenDetails({item}:{item:FurniturePlacement}){
  if(isBacksplash(item.catalogId))return <p className="finish-intro">Backsplash panels sit in front of the wall without cutting it. Set width, height and Height from floor below. Tile and grout colors are independent. The pattern scales with panel size; duplicate panels to keep the same tile proportions. Use smaller panels around openings; rotating flips the wall side.</p>;
  if(kitchenWallIds.has(item.catalogId))return <p className="finish-intro">Snaps against a wall. Adjust Height from floor to line up cabinets or position a hood. Check real appliance clearances separately; this is a layout model, not installation guidance.</p>;
  if(kitchenCeilingIds.has(item.catalogId))return <p className="finish-intro">Suspended pendant: Height from floor positions its lowest point. Resize its height to change the overall drop. The canopy cannot extend above this floor's ceiling.</p>;
  if(item.catalogId.includes('closet')||item.catalogId==='sliding-closet'||item.catalogId==='double-door-closet')return <p className="finish-intro">Build your own closet using separate hanging, shelf and corner modules. Duplicate and rotate bays, or edit their dimensions and positions for a precise fit. Doors are shown closed; storage and wall anchoring are illustrative.</p>;
  if(kitchenSurfaceIds.has(item.catalogId))return <p className="finish-intro">This appliance is independently placeable. Drag onto a supported counter or table to rest on its top; use Height from floor for other surfaces. No appliance operation or ventilation simulation.</p>;
  return null;
}
