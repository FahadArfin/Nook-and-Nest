import ids from './detailedModelIds.json';
const revised=new Set(ids);
/** Saved placement IDs stay stable; replaced assets receive a fresh cache key. */
export function modelAssetPath(id:string,preview=false){
  const path=preview?`/models/previews/${id}.png`:`/models/furniture/${id}.glb`;
  return revised.has(id)?`${path}?v=garden-detail-3`:path;
}
