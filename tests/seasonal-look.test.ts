import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createSamplePlan } from '../src/domain';
import { SeasonalMaterials } from '../src/scene/SeasonalMaterials';
import { GrassRenderer } from '../src/scene/GrassRenderer';
import { initialSeasonalLook, parseSeasonalLook, renderableSeasonalLook, seasonalColor, seasonalPreview, seasonalRenderPlan, type SeasonalPlan } from '../src/seasonalLook';
import type { FurniturePlacement } from '../src/types';
let engine: NullEngine | undefined; afterEach(() => engine?.dispose());
function fixture(): SeasonalPlan { const plan = createSamplePlan('Garden', 'metric'); plan.furniture = [{ id: 'inside', catalogId: 'fern-clump', floorId: plan.floors[0].id, x: 500, z: 500, widthMm: 800, depthMm: 800, heightMm: 600, rotation: 25, variant: 'sage', materialColors: { 'foliage-main': '#112233', 'bark-umber': '#bb9988' } }, { id: 'outside', catalogId: 'fern-clump', floorId: plan.floors[0].id, x: 3500, z: 500, widthMm: 800, depthMm: 800, heightMm: 600, rotation: 90, variant: 'sage' }]; return plan; }
const look = (plan: SeasonalPlan) => ({ ...initialSeasonalLook(plan, plan.floors[0].id), palette: 'winter' as const, region: { floorId: plan.floors[0].id, x: 0, z: 0, width: 2000, depth: 2000 } });

describe('bounded cosmetic garden palettes', () => {
  it('uses a neutral fallback after later edits exceed the ordinary-plant bound without enumerating dense plants', () => {
    const plan = fixture(), setting = look(plan); plan.furniture = Array.from({ length: 2001 }, (_, i) => ({ ...plan.furniture[0], id: `plant-${i}` }));
    expect(() => seasonalPreview(plan, plan, plan.floors[0].id, setting, vi.fn())).toThrow('2,000');
    plan.environment = { background: 'plain', grass: 'off', seasonalLook: setting }; expect(renderableSeasonalLook(plan)).toBeUndefined(); expect(seasonalRenderPlan(plan)).toBe(plan);
    expect(seasonalColor('constructor', 'foliage-main', 'winter')).toBeUndefined();
  });
  it('stages only environment metadata, rejects stale/invalid regions and restores original saved colors unchanged', () => {
    const plan = fixture(), baseline = structuredClone(plan), request = seasonalPreview(plan, plan, plan.floors[0].id, look(plan), vi.fn());
    expect(request.plan.furniture).toBe(plan.furniture); expect(request.plan.floors).toBe(plan.floors); expect(request.addedIds).toEqual([]); expect(plan).toEqual(baseline);
    expect(() => seasonalPreview(plan, { ...plan }, plan.floors[0].id, look(plan), vi.fn())).toThrow('changed');
    for (const value of [{ ...look(plan), species: 'invented' }, { ...look(plan), region: { ...look(plan).region, width: Infinity } }, { ...look(plan), region: { ...look(plan).region, floorId: 'missing' } }]) expect(() => parseSeasonalLook(value, plan.floors.map(f => f.id))).toThrow();
    const winter = request.plan as SeasonalPlan, restored = seasonalPreview(winter, winter, plan.floors[0].id, undefined, vi.fn()).plan;
    expect(restored.furniture).toBe(plan.furniture); expect(restored.furniture[0].materialColors?.['foliage-main']).toBe('#112233');
  });
  it('derives cached render-only overrides by actual region, preserving identity, transforms, unknown roles and dense field records', () => {
    const plan = fixture(); plan.furniture.push({ ...plan.furniture[0], id: 'field:fern-clump|0|0:1' }, { ...plan.furniture[0], id: 'unknown', catalogId: 'cypress-tree' });
    plan.environment = { background: 'plain', grass: 'off', seasonalLook: look(plan), vegetationField: { cells: { 'fern-clump|0|0': 100 }, removed: {} } };
    const baseline = structuredClone(plan), rendered = seasonalRenderPlan(plan);
    expect(seasonalRenderPlan(plan)).toBe(rendered); expect(rendered.furniture[0].materialColors?.['foliage-main']).toBe(seasonalColor('fern-clump', 'foliage-main', 'winter'));
    expect(rendered.furniture[0]).toMatchObject({ id: 'inside', x: 500, z: 500, rotation: 25, widthMm: 800, catalogId: 'fern-clump' });
    expect(rendered.furniture[0].materialColors?.['bark-umber']).toBe('#bb9988'); expect(rendered.furniture.slice(1).every((p, i) => p === plan.furniture[i + 1])).toBe(true); expect(rendered.environment?.vegetationField).toBe(plan.environment.vegetationField); expect(plan).toEqual(baseline);
    expect(seasonalColor('maple-tree', 'bark-umber', 'winter')).toBeUndefined(); expect(seasonalColor('cypress-tree', 'foliage-main', 'winter')).toBeUndefined();
    const original = { ...plan, environment: { background: 'plain' as const, grass: 'off' as const } }; expect(seasonalRenderPlan(original)).toBe(original);
  });
  it('restores exact custom material objects for selected plants, keeps bark untouched and releases palette clones', () => {
    engine = new NullEngine(); const scene = new Scene(engine), root = new TransformNode('plant', scene), leaf = MeshBuilder.CreateBox('leaf', {}, scene), bark = MeshBuilder.CreateBox('bark', {}, scene), original = new PBRMaterial('custom leaf', scene), barkMaterial = new PBRMaterial('bark', scene); leaf.parent = bark.parent = root; leaf.material = original; bark.material = barkMaterial; leaf.metadata = { livingMaterial: 'foliage-main' }; bark.metadata = { livingMaterial: 'bark-umber' }; original.albedoColor = Color3.FromHexString('#112233');
    const plan = fixture(), controller = new SeasonalMaterials(); controller.register(root, plan.furniture[0]); controller.setLook(look(plan)); expect(leaf.material).not.toBe(original); expect(bark.material).toBe(barkMaterial); expect(controller.stats.materialClones).toBe(1);
    controller.updatePlacements([{...plan.furniture[0],x:90000}]);expect(leaf.material).toBe(original);
    controller.updatePlacements(plan.furniture);expect(leaf.material).not.toBe(original);
    controller.setLook(undefined); expect(leaf.material).toBe(original); expect(original.albedoColor.toHexString()).toBe('#112233'); expect(controller.stats.materialClones).toBe(0);
    controller.setLook(look(plan)); controller.dispose(); expect(leaf.material).toBe(original); expect(bark.material).toBe(barkMaterial);
  });
  it('updates actual thin-instance batches by region while keeping matrices/IDs and dense-detail colors intact', () => {
    engine = new NullEngine(); const scene = new Scene(engine), plan = fixture(); plan.furniture[1].materialColors = { ...plan.furniture[0].materialColors };
    const builder = { build(parent: TransformNode, _definition: unknown, piece: FurniturePlacement) { const mesh = MeshBuilder.CreateBox('authored foliage', { size: 1 }, scene); mesh.parent = parent; mesh.metadata = { livingMaterial: 'foliage-main' }; const material = new PBRMaterial('foliage-main', scene); material.albedoColor = Color3.FromHexString(piece.materialColors?.['foliage-main'] ?? '#112233').toLinearSpace(); mesh.material = material; return true; } };
    const grass = new GrassRenderer(scene, builder as never); grass.update(plan, plan.floors[0].id);
    const snapshots = () => scene.meshes.filter(m => m.metadata?.grassBatch && m.isEnabled()).map(m => ({ ids: m.metadata.grassIds as string[], color: (m.material as PBRMaterial).albedoColor.toHexString(), matrices: (m as any)._thinInstanceDataStorage.matrixData as Float32Array }));
    const before = snapshots(); expect(before.flatMap(m => m.ids).sort()).toEqual(['inside', 'outside']);
    const seasonal = { ...plan, environment: { background: 'plain' as const, grass: 'off' as const, seasonalLook: look(plan) } }; grass.update(seasonal, plan.floors[0].id);
    const after = snapshots(); expect(after.flatMap(m => m.ids).sort()).toEqual(['inside', 'outside']);
    expect(after.find(m => m.ids.includes('inside'))!.color).toBe(Color3.FromHexString(seasonalColor('fern-clump', 'foliage-main', 'winter')!).toLinearSpace().toHexString()); expect(after.find(m => m.ids.includes('outside'))!.color).toBe(before[0].color);
    for (const batch of after) for (let i = 0; i < batch.ids.length; i++) { const original = before.find(b => b.ids.includes(batch.ids[i]))!, index = original.ids.indexOf(batch.ids[i]); expect(Array.from(batch.matrices.slice(i * 16, i * 16 + 16))).toEqual(Array.from(original.matrices.slice(index * 16, index * 16 + 16))); }
    grass.update(plan, plan.floors[0].id); expect(snapshots().every(m => m.color === before[0].color)).toBe(true); grass.dispose();
  });
});
