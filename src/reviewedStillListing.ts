import {parseListing,type ListingDocument,type ListingMedia} from './listingTypes';
import type {PlanDocumentV1} from './types';

/** Keep a reviewed render separate from photos and bind its saved viewpoint to this project. */
export function reviewedStillListing(source:ListingDocument,plan:PlanDocumentV1,media:ListingMedia):ListingDocument {
  if(source.planId!==plan.id)throw Error('The project changed. Reopen the render queue.');
  if(!media.id.startsWith('still-')||!['render','concept'].includes(media.kind))throw Error('Only reviewed design images can be added here.');
  const floors=new Set(plan.floors.map(f=>f.id));
  if(media.floorId&&!floors.has(media.floorId)||media.camera&&!floors.has(media.camera.floorId))throw Error('This render belongs to a floor that was removed. Download the result to keep it, or create a new render from an existing floor.');
  const existing=source.media.find(m=>m.id===media.id);
  if(existing){
    if(JSON.stringify(existing)!==JSON.stringify(media))throw Error('This reviewed image is already in the listing. Keep the existing slide or remove it explicitly.');
    return source;
  }
  return parseListing({...source,media:[...source.media,media],updatedAt:new Date().toISOString()});
}
