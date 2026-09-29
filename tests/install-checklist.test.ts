import { describe, expect, it, vi } from 'vitest';
import { createSamplePlan } from '../src/domain';
import { geometryKey } from '../src/blueprint';
import { defaultSpecification } from '../src/selectionSchedule';
import { captureInstallChecklist, installCandidates, installChecklistCsv, installChecklistHtml, installPhotoIds, installRevision, packingSummary, parseInstallChecklist, refreshInstallChecklist, reviewInstallChecklist, updateInstallChecklist, withoutInstallChecklist, type InstallPlan } from '../src/installChecklist';

function fixture(): InstallPlan {
  const plan = createSamplePlan('Apartment', 'metric'), floor = plan.floors[0];
  floor.blueprint = { geometryKey: geometryKey(floor), rooms: [{ id: 'room-left', name: 'Bedroom', kind: 'Bedroom', enclosed: true, x: 0, z: 0, width: 2000, depth: 2000 }, { id: 'room-right', name: 'Bedroom', kind: 'Bedroom', enclosed: true, x: 2000, z: 0, width: 2000, depth: 2000 }] };
  plan.furniture = ['owned', 'selected', 'unknown'].map((id, index) => ({ id, floorId: floor.id, catalogId: 'side-table', x: index === 1 ? 2500 : 500, z: 500, widthMm: 500, depthMm: 450, heightMm: 600, rotation: 0, variant: 'oat', ...(index < 2 ? { specification: { ...defaultSpecification(), status: index === 0 ? 'owned' as const : 'selected' as const, purchase: { unit: 'pack' as const, quantity: 3, unitsPerPack: 6 } } } : {}) }));
  return plan;
}
const now = '2026-09-29T12:00:00.000Z';
const capture = (plan: InstallPlan, ids = plan.furniture.map(p => p.id)) => captureInstallChecklist(plan, 'install', ids, now);

describe('private install / photo-day capture', () => {
  it('captures independent room identities despite duplicate names, with all manual facts unknown', () => {
    const plan = fixture(), original = structuredClone(plan), list = capture(plan);
    expect(list.rooms.map(r => r.roomKey)).toEqual(['room-left', 'room-right']);
    expect(list.tasks.filter(t => t.roomKey === 'room-left')).toHaveLength(3);
    expect(list.tasks.filter(t => t.roomKey === 'room-right')).toHaveLength(3);
    expect(list.items.map(i => i.sourceStatus)).toEqual(['owned', 'selected', 'unknown']);
    expect(list.items.every(i => i.packing === 'unknown' && i.delivery === 'unknown')).toBe(true);
    expect(list.tasks.every(t => t.state === 'unknown' && !t.assignee && !t.dueDate)).toBe(true);
    expect(plan).toEqual(original); expect(parseInstallChecklist(JSON.parse(JSON.stringify(list)))).toEqual(list);
    expect(captureInstallChecklist(plan, 'photo-day', [], now).tasks[0].title).toContain('privacy');
  });
  it('counts only explicitly included current reviewed physical pieces, separate from pack quantity, ownership and delivery', () => {
    const list = capture(fixture());
    expect(packingSummary(list).count).toBe(0);
    list.items[0].packing = 'include'; list.items[0].delivery = 'received'; list.items[1].packing = 'include'; list.items[1].delivery = 'pending';
    expect(packingSummary(list)).toMatchObject({ count: 2, owned: 1, selected: 1, received: 1, pending: 1, unknownDelivery: 0, undecided: 1 });
    list.items[2].packing = 'include';
    expect(packingSummary(list)).toMatchObject({ count: 3, unknownStatus: 1, unknownDelivery: 1 });
    list.items[1].needsReview = true; list.items[0].present = false;
    expect(packingSummary(list)).toMatchObject({ count: 1, needsReview: 1, unknownStatus: 1 });
  });
  it('preserves old capture and task scopes through edits, then flags explicit refresh without silently moving tasks', () => {
    const plan = fixture(), list = capture(plan), evidence = structuredClone(list);
    list.items[0].packing = 'include'; list.tasks[1].state = 'done';
    const changed = structuredClone(plan); changed.furniture[0].x = 2500; changed.furniture = changed.furniture.filter(p => p.id !== 'selected');
    changed.furniture.push({ ...changed.furniture[0], id: 'new' });
    const review = reviewInstallChecklist(changed, list);
    expect(review.stale).toBe(true); expect(review.changed.map(i => i.placementId)).toEqual(['owned']); expect(review.removed.map(i => i.placementId)).toEqual(['selected']); expect(review.notIncluded.map(i => i.placementId)).toEqual(['new']);
    expect(list.items[0].roomKey).toBe('room-left');
    const refreshed = refreshInstallChecklist(changed, list, ['owned', 'unknown', 'new'], now);
    expect(refreshed.items.find(i => i.placementId === 'owned')).toMatchObject({ roomKey: 'room-right', needsReview: true, packing: 'include' });
    expect(refreshed.items.find(i => i.placementId === 'selected')).toMatchObject({ present: false, needsReview: true });
    expect(refreshed.tasks[1]).toMatchObject({ id: evidence.tasks[1].id, roomKey: 'room-left', state: 'done', needsReview: true, evidenceRevision: list.revision.fingerprint });
    expect(refreshed.revision.fingerprint).toBe(installRevision(changed)); expect(packingSummary(refreshed).count).toBe(0);
  });
  it('ignores timestamp, camera and checklist-only updates in revision while guarding exact stale editor bases', () => {
    const plan = fixture(), list = capture(plan), validate = vi.fn();
    const next = updateInstallChecklist(plan, plan, list, validate); expect(validate).toHaveBeenCalledOnce();
    next.updatedAt = '2026-09-30T12:00:00Z'; next.camera = { ...next.camera, mode: 'top' };
    expect(installRevision(next)).toBe(list.revision.fingerprint); expect(next.floors).toBe(plan.floors); expect(next.furniture).toBe(plan.furniture);
    expect(() => updateInstallChecklist(plan, next, list, validate)).toThrow('changed');
    expect(() => updateInstallChecklist(plan, plan, { ...list, projectId: 'other' }, validate)).toThrow('different project');
    expect(() => refreshInstallChecklist({ ...plan, id: 'other' }, list, [], now)).toThrow('different project');
    expect(plan).not.toHaveProperty('installChecklist');
  });
  it('bounds metadata and accepts only private photo hashes, real dates, known references and enumerated facts', () => {
    const list = capture(fixture()), photo = 'sha256:' + 'a'.repeat(64);
    list.tasks[0].photoAssetIds = [photo];
    expect(installPhotoIds(parseInstallChecklist(list))).toEqual([photo]);
    for (const bad of [{ ...list, public: true }, { ...list, tasks: [{ ...list.tasks[0], dueDate: '2026-02-30' }] }, { ...list, tasks: [{ ...list.tasks[0], photoAssetIds: ['https://private.example/photo'] }] }, { ...list, tasks: [{ ...list.tasks[0], itemId: 'missing' }] }, { ...list, tasks: [{ ...list.tasks[0], assignee: 'a'.repeat(101) }] }, { ...list, tasks: Array.from({ length: 161 }, (_, i) => ({ ...list.tasks[0], id: `task-${i}` })) }, { ...list, items: [{ ...list.items[0], sourceStatus: 'delivered' }] }]) expect(() => parseInstallChecklist(bad)).toThrow();
    expect(() => captureInstallChecklist(fixture(), 'install', ['owned', 'owned'], now)).toThrow('distinct');
    const oversized = { ...fixture(), name: 'x'.repeat(8_000_001) }; const ownList = { ...list, projectId: oversized.id };
    expect(() => updateInstallChecklist(oversized, oversized, ownList, vi.fn())).toThrow('8 MB');
  });
  it('exports escaped, script-free revision-labelled records and strips every private field from public payloads', () => {
    const plan = fixture(), list = capture(plan), photo = 'sha256:' + 'f'.repeat(64);
    list.tasks[0] = { ...list.tasks[0], title: '<script>alert(1)</script>', assignee: '=IMPORTXML("secret")', dueDate: '2026-10-01', note: 'Private note', photoAssetIds: [photo] };
    const printable = installChecklistHtml(list, 'changed-revision'), csv = installChecklistCsv(list, 'changed-revision');
    expect(printable).toContain('&lt;script&gt;'); expect(printable).not.toMatch(/<script\b|<img\b|https?:\/\//i); expect(printable).toContain("default-src 'none'"); expect(printable).toContain('Layout changes need review'); expect(printable).toContain(list.revision.fingerprint); expect(printable).not.toContain(photo);
    expect(csv).toContain("'=IMPORTXML"); expect(csv).toContain('Physical packing count'); expect(csv).not.toContain(photo);
    const privatePlan = { ...plan, installChecklist: list }, shared = withoutInstallChecklist(privatePlan);
    expect(shared).not.toHaveProperty('installChecklist'); expect(privatePlan.installChecklist.tasks[0].note).toBe('Private note');
  });
  it('marks architecture changes stale without inventing new uncaptured pieces and never assigns by name', () => {
    const plan = fixture(), list = capture(plan, ['owned']);
    expect(reviewInstallChecklist(plan, list)).toMatchObject({ stale: false, changed: [], removed: [] });
    expect(reviewInstallChecklist(plan, list).notIncluded).toHaveLength(2);
    const movedWall = structuredClone(plan); movedWall.floors[0].heightMm += 100;
    expect(reviewInstallChecklist(movedWall, list).stale).toBe(true);
    expect(installCandidates(plan)[0].roomKey).not.toBe(installCandidates(plan)[1].roomKey);
  });
});
