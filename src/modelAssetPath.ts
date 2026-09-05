/** Saved placement IDs stay stable; replaced assets receive a fresh cache key. */
export function modelAssetPath(id:string,preview=false){
  if(preview)return `/api/previews/${id}.webp?v=preview-webp-1`;
  return `/models/furniture/${id}.glb?v=lossless-mesh-1`;
}
