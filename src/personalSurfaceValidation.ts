import {personalSurfaceSlots as slots} from './personalSurfaceSlots';
import type {FurniturePlacement} from './types';
import {parsePersonalSurface,type PersonalSurface} from './moodboards';
const allowedSlots=slots as Record<string,string[]>;
/** Names verified directly in the authored GLB material tables on 2026-09-29. */
export const personalArtModels:Record<string,{imageSlot:string;frameSlot:string}>={
  'landscape-painting':{imageSlot:'artwork-landscape',frameSlot:'wood-dark'},
  'botanical-print':{imageSlot:'artwork-botanical',frameSlot:'wood-dark'},
  'abstract-poster':{imageSlot:'artwork-abstract',frameSlot:'aged-bronze'},
  'coast-poster':{imageSlot:'artwork-coast',frameSlot:'aged-bronze'},
};
export function validateSurfaceForPiece(input:unknown,piece:Pick<FurniturePlacement,'catalogId'>):PersonalSurface {
  const value=parsePersonalSurface(input);
  if(value.kind==='art'){if(personalArtModels[piece.catalogId]?.imageSlot!==value.slotId)throw new Error('Choose a supported authored picture frame for personal art.');}
  else if(!(allowedSlots[piece.catalogId]??[]).includes(value.slotId))throw new Error('Choose a supported fabric material role for this swatch.');
  return value;
}
