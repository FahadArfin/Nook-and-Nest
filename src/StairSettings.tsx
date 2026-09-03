import { stairWarnings } from "./building";
import { usePlanner } from "./store";
import type { FurniturePlacement } from "./types";
export function StairSettings({item}:{item:FurniturePlacement}) {
  const state=usePlanner(),index=state.plan.floors.findIndex(f=>f.id===item.floorId),next=state.plan.floors[index+1],warnings=stairWarnings(state.plan,item);
  return <section className="inspector-section stair-settings"><h3>Stair connection</h3><label>Connect to floor<select value={item.toFloorId??""} onChange={e=>state.updateFurniture(item.id,{toFloorId:e.target.value||undefined})}><option value="">Unconnected layout model</option>{next&&<option value={next.id}>{next.name}</option>}</select></label><label>Floor-to-floor rise (mm)<input type="number" min="100" max="10000" step="10" disabled={!!item.toFloorId} value={item.stairRiseMm??2800} onChange={e=>{const value=Number(e.target.value);if(value>=100&&value<=10000)state.updateFurniture(item.id,{stairRiseMm:value})}}/></label><p>Connected stairs match the next floor's elevation and reserve their footprint as an opening above. Moving or removing them updates the opening. Rotate in 90° steps.</p>{warnings.length>0&&<ul aria-label="Stair layout warnings">{warnings.map(w=><li key={w}>⚠ {w}</li>)}</ul>}<p>Layout guide only—not structural, headroom, or building-code approval.</p></section>;
}
