import applianceIds from './applianceDetailIds.json';
import {hasStudioAsset} from './studioCollection';
import modernDefaults from './modernDefaults.json';
/** Saved placement IDs stay stable; replaced assets receive a fresh cache key. */
export function modelAssetPath(id:string,preview=false){
  if(hasStudioAsset(id))return preview?`${import.meta.env.DEV?'/models/previews':'/api/previews'}/${id}.webp?v=studio-detail-1`:`/models/furniture/${id}.glb?v=studio-detail-1`;
  const modern=Object.prototype.hasOwnProperty.call(modernDefaults,id);
  if(preview)return `${import.meta.env.DEV?"/models/previews":"/api/previews"}/${id}.webp?v=${applianceIds.includes(id)?'appliance-detail-2':modern?'batch12-modern-1':'preview-webp-1'}`;
  return `/models/furniture/${id}.glb?v=${applianceIds.includes(id)?'appliance-detail-2':modern?'batch12-modern-1':id==='backdrop-city'?'toronto-massing-aerial-1':id.startsWith('backdrop-')?'scenery-toronto-3':'lossless-mesh-1'}`;
}


