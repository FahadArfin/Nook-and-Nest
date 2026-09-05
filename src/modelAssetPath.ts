import ids from './detailedModelIds.json';
const revised=new Set(ids);
/** Saved placement IDs stay stable; replaced assets receive a fresh cache key. */
export function modelAssetPath(id:string,preview=false){
  if(preview)return `/api/previews/${id}.webp?v=preview-webp-1`;
  const path=preview?`/models/previews/${id}.webp`:`/models/furniture/${id}.glb`;
  return revised.has(id)?`${path}?v=${id.startsWith('christmas-')?'holiday-shared-5':'interior-detail-4'}`:path;
}
