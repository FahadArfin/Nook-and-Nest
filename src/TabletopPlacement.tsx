import {catalog,isSurfaceMounted} from './catalog';
import {tabletopChoices} from './tabletop';
import {usePlanner} from './store';
import type {FurniturePlacement} from './types';
export function TabletopPlacement({item}:{item:FurniturePlacement}){
  const state=usePlanner();if(!isSurfaceMounted(item.catalogId))return null;
  const choices=tabletopChoices(state.plan,item);
  return <section className="inspector-section"><h3>Rest on a table, counter or TV stand</h3>{item.catalogId==='countertop-microwave'&&<button onClick={()=>{const hood=catalog.find(c=>c.id==='microwave-hood')!;state.updateFurniture(item.id,{catalogId:hood.id,widthMm:hood.widthMm,depthMm:hood.depthMm,heightMm:hood.heightMm,elevationMm:1500});}}>Use wall-mounted microwave</button>}<select aria-label="Rest on a table, counter or TV stand" value="" onChange={e=>{const c=choices.find(c=>c.owner.id===e.target.value);if(c)state.updateFurniture(item.id,c.placement)}}><option value="">{choices.length?'Choose a supporting surface…':'No surface fits this piece'}</option>{choices.map((c,i)=><option key={c.owner.id} value={c.owner.id}>{catalog.find(d=>d.id===c.owner.catalogId)?.name} {i+1}</option>)}</select><p className="finish-intro">Centers and aligns this piece on a top that fits. Each placement can be undone; pieces remain independent.</p></section>;
}
