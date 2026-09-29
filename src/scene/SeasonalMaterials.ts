import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { inSeasonalRegion, MAX_SEASONAL_MATERIALS, MAX_SEASONAL_PLACEMENTS, parseSeasonalLook, seasonalColor, seasonalRoles, type SeasonalLook } from '../seasonalLook';
import type { FurniturePlacement } from '../types';
interface Entry { root: TransformNode; item: FurniturePlacement; parts: Array<{ mesh: AbstractMesh; original: Material; role: string }> }
/** No render loop and no plant regeneration. Restores original material objects, including custom colors. */
export class SeasonalMaterials {
  private entries = new Map<TransformNode, Entry>(); private clones = new Map<string, Material>(); private look?: SeasonalLook; private disposed = false;
  private fallback = 0;
  constructor(private invalidate: () => void = () => {}) {}
  get stats() { return { registered: this.entries.size, materialClones: this.clones.size, neutralFallbackParts: this.fallback }; }
  register(root: TransformNode, item: FurniturePlacement): () => void {
    if (this.disposed || item.id === 'capture' || item.id === 'grass-source' || item.id.startsWith('field:') || !seasonalRoles[item.catalogId]) return () => {};
    if (this.entries.has(root)) { this.restore(this.entries.get(root)!); this.entries.delete(root); }
    if (this.entries.size >= MAX_SEASONAL_PLACEMENTS) return () => {};
    const parts = root.getChildMeshes().flatMap(mesh => { const role = String(mesh.metadata?.livingMaterial ?? ''); return mesh.material && seasonalRoles[item.catalogId].includes(role) ? [{ mesh, original: mesh.material, role }] : []; });
    const entry: Entry = { root, item: { ...item }, parts }; this.entries.set(root, entry); this.apply(entry);
    const observer = root.onDisposeObservable.add(() => this.entries.delete(root));
    return () => { root.onDisposeObservable.remove(observer); if (this.entries.get(root) === entry) { this.restore(entry); this.entries.delete(root); } };
  }
  setLook(value: SeasonalLook | undefined) {
    const next = value ? parseSeasonalLook(value) : undefined;
    if (JSON.stringify(next) === JSON.stringify(this.look)) return;
    for (const entry of this.entries.values()) this.restore(entry);
    // At most one active palette in the cache. Never retain four copies of a dense garden.
    for (const material of this.clones.values()) material.dispose(false, false); this.clones.clear(); this.fallback = 0; this.look = next;
    for (const entry of this.entries.values()) this.apply(entry); this.invalidate();
  }
  private restore(entry: Entry) { for (const part of entry.parts) if (!part.mesh.isDisposed()) part.mesh.material = part.original; }
  updatePlacements(items:readonly FurniturePlacement[]) {
    if(!this.entries.size)return;
    const byId=new Map(items.map(item=>[item.id,item]));
    for(const entry of this.entries.values()){
      const item=byId.get(entry.item.id);if(!item||item.x===entry.item.x&&item.z===entry.item.z&&item.floorId===entry.item.floorId)continue;
      this.restore(entry);entry.item={...item};this.apply(entry);
    }
  }
  private apply(entry: Entry) {
    if (!this.look || entry.root.isDisposed() || !inSeasonalRegion(entry.item, this.look)) return;
    for (const part of entry.parts) {
      const color = seasonalColor(entry.item.catalogId, part.role, this.look.palette); if (!color) continue;
      const key = `${part.original.uniqueId}:${color}`; let material = this.clones.get(key);
      if (!material) {
        if (this.clones.size >= MAX_SEASONAL_MATERIALS || !(part.original instanceof PBRMaterial || part.original instanceof StandardMaterial)) { this.fallback++; continue; }
        const clone = part.original.clone(`seasonal:${key}`); if (!clone) { this.fallback++; continue; }
        if (clone instanceof PBRMaterial) clone.albedoColor = Color3.FromHexString(color).toLinearSpace(); else if (clone instanceof StandardMaterial) clone.diffuseColor = Color3.FromHexString(color);
        material = clone; this.clones.set(key, clone);
      }
      part.mesh.material = material;
    }
  }
  dispose() { if (this.disposed) return; for (const entry of this.entries.values()) this.restore(entry); this.entries.clear(); for (const material of this.clones.values()) material.dispose(false, false); this.clones.clear(); this.disposed = true; }
}
