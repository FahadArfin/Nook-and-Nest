import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { catalog } from '../catalog';
import { slidingDoorIds } from '../homeCollection';
import { livingMotion, resetLivingMotion, setLivingMotion, type LivingCommand, type LivingPlayBridge, type LivingPlayEntry } from '../livingPlay';
import type { FurniturePlacement } from '../types';
import { fireplaceIds, motionData } from './LivingModels';

const names = new Map(catalog.map(c => [c.id, c.name]));
interface Attached { root: TransformNode; info: LivingPlayEntry; flames: Array<{ mesh: AbstractMesh; enabled: boolean }>; leaves: Array<{ node: TransformNode; rest: Vector3; travel: number }> }
/** A bounded registry over actual authored moving nodes. No observer, RAF, mesh generation or plan write. */
export class LivingPlayController implements LivingPlayBridge {
  private entries = new Map<string, Attached>(); private listeners = new Set<() => void>(); private snapshot: readonly LivingPlayEntry[] = []; private disposed = false;
  constructor(private invalidate: () => void = () => {}) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish() { if (this.disposed) return; this.snapshot = [...this.entries.values()].map(e => ({ ...e.info, motion: livingMotion(e.root) })); for (const listener of this.listeners) listener(); this.invalidate(); }
  register(root: TransformNode, item: FurniturePlacement): () => void {
    const id = item.catalogId;
    if (this.disposed || item.id === 'capture' || item.id.startsWith('field:') || !(fireplaceIds.has(id) || slidingDoorIds.has(id) || id.endsWith('-aquarium') || ['christmas-tree', 'christmas-slim-tree', 'pet-water-fountain', 'library-rotating-globe'].includes(id))) return () => {};
    const old = this.entries.get(item.id); if (old) this.detach(item.id, old);
    if (this.entries.size >= 128) return () => {};
    const parts = root.getDescendants(false), meshes = root.getChildMeshes(), roles = new Set(parts.map(n => motionData(n).motion_role));
    const flames = fireplaceIds.has(id) ? meshes.filter(m => ['golden-flame', 'warm-light'].includes(m.metadata?.livingMaterial ?? '')).map(mesh => ({ mesh, enabled: mesh.isEnabled(false) })) : [];
    const savedFraction = Math.max(0, Math.min(1, item.openFraction ?? 0));
    const leaves = slidingDoorIds.has(id) ? parts.filter(n => motionData(n).motion_role === 'sliding_leaf' && !motionData(n.parent).motion_role).flatMap(part => {
      const node = part as TransformNode, travel = Number(motionData(node).slide_travel); return Number.isFinite(travel) && Math.abs(travel) > 0 && Math.abs(travel) <= 20 ? [{ node, rest: node.position.clone(), travel }] : [];
    }) : [];
    const canAnimate = !!flames.length || (id.endsWith('-aquarium') && roles.has('fish')) || (id === 'pet-water-fountain' && roles.has('fountain_ripple')) || (id === 'library-rotating-globe' && roles.has('globe')) || (id.startsWith('christmas-') && meshes.some(m => m.metadata?.livingMaterial?.startsWith('holiday-light-')));
    if (!canAnimate && !leaves.length) return () => {};
    const entry: Attached = { root, flames, leaves, info: { id: item.id, catalogId: id, name: names.get(id) ?? id, floorId: item.floorId, motion: 'playing', canAnimate, canExtinguish: !!flames.length, canSlide: !!leaves.length, fraction: savedFraction, savedFraction } };
    this.entries.set(item.id, entry);
    const observer = root.onDisposeObservable.add(() => { if (this.entries.get(item.id) === entry) { this.entries.delete(item.id); resetLivingMotion(root); this.publish(); } });
    this.publish();
    return () => { root.onDisposeObservable.remove(observer); if (this.entries.get(item.id) === entry) { this.detach(item.id, entry); this.publish(); } };
  }
  private restore(entry: Attached) {
    if (!entry.root.isDisposed()) { for (const leaf of entry.leaves) if (!leaf.node.isDisposed()) leaf.node.position.copyFrom(leaf.rest); for (const flame of entry.flames) if (!flame.mesh.isDisposed()) flame.mesh.setEnabled(flame.enabled); }
    entry.info.fraction = entry.info.savedFraction; resetLivingMotion(entry.root);
  }
  private detach(id: string, entry: Attached) { this.restore(entry); this.entries.delete(id); }
  command(id: string, command: LivingCommand) {
    const entry = this.entries.get(id); if (!entry || entry.root.isDisposed()) throw new Error('This authored interaction is not available yet. Wait for the model or choose another item.');
    if (command.type === 'reset') this.restore(entry);
    else if (command.type === 'slide') {
      if (!entry.info.canSlide || !Number.isFinite(command.fraction) || command.fraction < 0 || command.fraction > 1) throw new Error('Choose a supported door opening between 0 and 100%.');
      for (const leaf of entry.leaves) leaf.node.position.x = leaf.rest.x + leaf.travel * (command.fraction - entry.info.savedFraction);
      entry.info.fraction = command.fraction;
    } else if (command.type === 'motion') {
      if (!entry.info.canAnimate || !['playing', 'paused', 'off'].includes(command.mode) || command.mode === 'off' && !entry.info.canExtinguish) throw new Error('This item supports pause/play, but no authored off state.');
      setLivingMotion(entry.root, command.mode);
      for (const flame of entry.flames) flame.mesh.setEnabled(command.mode === 'off' ? false : flame.enabled);
    } else throw new Error('Unsupported interaction.');
    this.publish();
  }
  resetAll() { for (const entry of this.entries.values()) this.restore(entry); this.publish(); }
  pauseAll() { for (const entry of this.entries.values()) if (entry.info.canAnimate) setLivingMotion(entry.root, 'paused'); this.publish(); }
  dispose() { if (this.disposed) return; for (const [id, entry] of this.entries) this.detach(id, entry); this.disposed = true; this.snapshot = []; this.listeners.clear(); }
}
