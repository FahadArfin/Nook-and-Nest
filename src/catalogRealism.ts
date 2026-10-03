import beds from './catalogRealismBeds.json';
/** Opt-in feature build only. Production keeps its existing catalog rendering. */
const revision = import.meta.env.VITE_CATALOG_REALISM_VERSION as string | undefined;
export const catalogRealismRevision = /^[a-f0-9]{64}$/.test(revision ?? '') ? revision! : null;

export function usesCatalogRealism(id: string) {
  return catalogRealismRevision !== null && !id.startsWith('backdrop-');
}

export function usesCatalogRealismBeddingTrim(id: string, material: string) {
  return usesCatalogRealism(id) && beds.includes(id) && /stitch|seam|welt|piping|thread/i.test(material);
}

export function catalogRealismAssetPath(id: string, preview: boolean) {
  const directory = import.meta.env.DEV
    ? `/experiments/catalog-realism/${preview ? 'previews' : 'models'}`
    : preview ? '/api/previews' : '/models/furniture';
  return `${directory}/${id}.${preview ? 'webp' : 'glb'}?catalog_realism=${catalogRealismRevision}`;
}
