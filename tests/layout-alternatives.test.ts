import { describe, expect, it } from 'vitest';
import { createBlankPlan } from '../src/domain';
import { validatePlan } from '../src/planValidation';
import {
  applyLayoutAlternative, captureLayout, deleteLayoutAlternative, layoutDifference, layoutSummary,
  publicLayoutPlan, renameLayoutAlternative, saveLayoutAlternative, validateLayoutAlternatives,
} from '../src/layoutAlternatives';

const create = () => createBlankPlan('Ideas', 'metric');
const save = (plan: ReturnType<typeof create>, name = 'Option A', id = 'option-a') =>
  saveLayoutAlternative(plan, name, plan.floors[0].id, validatePlan, { id, now: '2026-09-29T12:00:00.000Z' });

describe('saved layout alternatives', () => {
  it('keeps snapshots independent from current edits and excludes identity, camera, drafts and nested ideas', () => {
    const plan = create();
    const first = save(plan);
    const second = save(first, 'Option B', 'option-b');
    expect(Object.keys(second.layoutAlternatives!.options[1].snapshot).sort()).toEqual(['floors', 'furniture', 'gridSizeMm']);
    expect(second.layoutAlternatives!.options[0].snapshot.floors).not.toBe(plan.floors);
    plan.floors[0].name = 'Edited outside';
    expect(second.layoutAlternatives!.options[0].snapshot.floors[0].name).not.toBe('Edited outside');
    expect(first.layoutAlternatives!.options).toHaveLength(1);
  });

  it('applies layout without changing project identity, display settings or saved snapshots', () => {
    const original = create();
    const saved = save(original);
    const beforeSnapshot = JSON.stringify(saved.layoutAlternatives);
    const edited = { ...saved, name: 'Current project title', units: 'imperial' as const, gridSizeMm: 500, camera: { ...saved.camera, mode: 'top' as const }, furniture: [], studioDrafts: {} };
    const next = applyLayoutAlternative(edited, 'option-a', original.floors[0].id, validatePlan);
    expect(next.plan.id).toBe(original.id);
    expect(next.plan.name).toBe(edited.name);
    expect(next.plan.units).toBe('imperial');
    expect(next.plan.camera).toBe(edited.camera);
    expect(next.plan.gridSizeMm).toBe(original.gridSizeMm);
    expect(next.plan.studioDrafts).toBeUndefined();
    expect(JSON.stringify(next.plan.layoutAlternatives)).toBe(beforeSnapshot);
    expect(next.plan.floors).not.toBe(next.plan.layoutAlternatives!.options[0].snapshot.floors);
  });

  it('preserves the current floor when present and otherwise chooses the saved floor', () => {
    const plan = save(create());
    const floorId = plan.floors[0].id;
    expect(applyLayoutAlternative(plan, 'option-a', floorId, validatePlan).activeFloorId).toBe(floorId);
    expect(applyLayoutAlternative(plan, 'option-a', 'deleted-floor', validatePlan).activeFloorId).toBe(floorId);
  });

  it('bounds count, per-snapshot size, combined size and total project bytes', () => {
    let plan = create();
    for (let index = 0; index < 6; index++) plan = save(plan, 'Idea ' + index, 'idea-' + index);
    expect(() => save(plan, 'Overflow', 'overflow')).toThrow(/6 layout ideas/);
    const huge = create();
    huge.floors[0].blueprint = { geometryKey: 'x'.repeat(751_000), rooms: [] };
    expect(() => save(huge)).toThrow(/750 KB/);
    const medium = create();
    medium.floors[0].blueprint = { geometryKey: 'x'.repeat(680_000), rooms: [] };
    const a = save(medium);
    const b = save(a, 'Option B', 'option-b');
    expect(() => save(b, 'Option C', 'option-c')).toThrow(/2 MB/);
    const oversized = Object.assign(create(), { extraMetadata: 'x'.repeat(8_000_001) });
    expect(() => save(oversized)).toThrow(/8 MB/);
    const imported = Object.assign(save(create()), { extraMetadata: 'x'.repeat(8_000_001) });
    expect(() => applyLayoutAlternative(imported, 'option-a', imported.floors[0].id, validatePlan)).toThrow(/8 MB/);
  });

  it('rejects invalid geometry, duplicate IDs, nested plans and stale IDs before producing a replacement', () => {
    const plan = save(create());
    const bad = structuredClone(plan);
    bad.layoutAlternatives!.options[0].snapshot.floors[0].heightMm = -2;
    expect(() => applyLayoutAlternative(bad, 'option-a', bad.floors[0].id, validatePlan)).toThrow();
    const nested = structuredClone(plan.layoutAlternatives) as any;
    nested.options[0].snapshot.layoutAlternatives = plan.layoutAlternatives;
    expect(() => validateLayoutAlternatives(nested, () => {})).toThrow();
    const duplicate = structuredClone(plan.layoutAlternatives)!;
    duplicate.options.push(duplicate.options[0]);
    expect(() => validateLayoutAlternatives(duplicate, () => {})).toThrow();
    expect(() => applyLayoutAlternative(plan, 'missing', plan.floors[0].id, validatePlan)).toThrow(/no longer/);
  });

  it('renames and deletes options without altering the current layout and strips private options from shares', () => {
    const plan = save(create());
    const renamed = renameLayoutAlternative(plan, 'option-a', '  More open  ', validatePlan);
    expect(renamed.layoutAlternatives!.options[0].name).toBe('More open');
    expect(renamed.floors).toBe(plan.floors);
    const removed = deleteLayoutAlternative(renamed, 'option-a', validatePlan);
    expect(removed.layoutAlternatives!.options).toEqual([]);
    expect(removed.floors).toBe(plan.floors);
    const published = publicLayoutPlan(Object.assign(plan, { studioDrafts: {} }));
    expect('layoutAlternatives' in published).toBe(false);
    expect('studioDrafts' in published).toBe(false);
    expect(plan.layoutAlternatives!.options).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(plan)).layoutAlternatives.options).toHaveLength(1);
  });

  it('counts physical grouped rooms, not blueprint rectangles, and compares stable item IDs', () => {
    const plan = create();
    plan.floors[0].blueprint = { geometryKey: 'example', rooms: [
      { id: 'part-a', groupId: 'room', name: 'Room', kind: 'Living', enclosed: false, x: 0, z: 0, width: 1000, depth: 1000 },
      { id: 'part-b', groupId: 'room', name: 'Room', kind: 'Living', enclosed: false, x: 1000, z: 0, width: 1000, depth: 1000 },
    ] };
    const item = { id: 'seat-a', catalogId: 'chair', floorId: plan.floors[0].id, x: 0, z: 0, rotation: 0, widthMm: 500, depthMm: 500, heightMm: 800, variant: 'oak' };
    plan.furniture = [item, { ...item, id: 'seat-b' }];
    const current = captureLayout(plan), target = captureLayout(plan);
    target.furniture = [{ ...item, variant: 'white' }, { ...item, id: 'seat-c' }];
    expect(layoutSummary(current)).toEqual({ floors: 1, namedRooms: 1, furniture: 2 });
    expect(layoutDifference(current, target)).toMatchObject({ added: 1, removed: 1, changed: 1, floorsChanged: 0 });
    expect(layoutDifference(current, { ...current, furniture: [...current.furniture].reverse() }).changed).toBe(0);
  });
});

