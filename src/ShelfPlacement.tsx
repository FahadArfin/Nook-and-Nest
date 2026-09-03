import { catalog,isSurfaceMounted } from './catalog';
import { shelfIds } from './interiorCatalog';
import { shelfChoices } from './shelfSurfaces';
import { usePlanner } from './store';
import type { FurniturePlacement } from './types';
export function ShelfPlacement({item}:{item:FurniturePlacement}){
  const state=usePlanner();
  if(shelfIds.has(item.catalogId))return <p className="finish-intro">Drag books, small plants or collectibles onto a shelf. For a precise level, select the décor and use Rest on a shelf. Pieces remain independent when the shelf moves.</p>;
  if(!isSurfaceMounted(item.catalogId))return null;
  const choices=shelfChoices(state.plan,item),shelves=state.plan.furniture.filter(s=>s.floorId===item.floorId&&shelfIds.has(s.catalogId));
  if(!shelves.length)return null;
  return <section className="inspector-section"><h3>Rest on a shelf</h3><label className="finish-intro">Choose a shelf level<select aria-label="Rest on a shelf" value="" disabled={!choices.length} onChange={e=>{const choice=choices.find(c=>c.key===e.target.value);if(choice)state.updateFurniture(item.id,choice.placement)}}><option value="">{choices.length?'Choose a shelf or cubby…':'No shelf fits this piece'}</option>{shelves.map((owner,i)=><optgroup key={owner.id} label={`${catalog.find(c=>c.id===owner.catalogId)?.name} ${i+1}`}>{choices.filter(c=>c.owner.id===owner.id).map(c=><option key={c.key} value={c.key}>{c.surface.label}</option>)}</optgroup>)}</select></label><p className="finish-intro">Centers and turns the piece to face the shelf. Only levels with enough width, depth and height are listed. Drag to fine-tune, or undo to return. Check space around other décor.</p></section>;
}
