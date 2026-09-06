import modernDefaults from './modernDefaults.json';
/** Saved placement IDs stay stable; replaced assets receive a fresh cache key. */
export function modelAssetPath(id:string,preview=false){
  const modern=Object.prototype.hasOwnProperty.call(modernDefaults,id);
  if(preview)return `${import.meta.env.DEV?"/models/previews":"/api/previews"}/${id}.webp?v=${modern?'batch12-modern-1':'preview-webp-1'}`;
  return `/models/furniture/${id}.glb?v=${modern?'batch12-modern-1':id.startsWith('backdrop-')?'scenery-toronto-3':'lossless-mesh-1'}`;
}

