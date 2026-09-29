import { expect, it } from 'vitest';
import { createBlankPlan, rectangleCells } from '../src/domain';
import { validatePlan } from '../src/planValidation';
import { captureDesignMilestone, clearDesignMilestones, clearRenovationPhases, deleteDesignMilestone, designHistoryReferenceIds, filterPhaseChanges, historySnapshotAsPlan, milestonePreview, phasePreview, publicHistoryPlan, renovationChanges, renovationReport, restoreDesignCheckpoint, saveDesignReplayView, setMilestoneRecording, startRenovation, updateProposedPhase, validateDesignHistory, type HistoryPlan } from '../src/designHistory';
import type { CameraShotPose } from '../src/walkthrough';
const now = '2026-09-29T12:00:00.000Z';
function planFixture(): HistoryPlan {
  const plan = createBlankPlan('Design story', 'metric'); plan.gridSizeMm = 1000;
  const floor = plan.floors[0]; floor.cells = rectangleCells(5, 5); floor.walls = [{ id: 'wall-a', ax: 1, az: 0, bx: 1, bz: 5 }]; floor.openings = [{ id: 'opening-a', kind: 'door', wallKey: 'wall-a', offset: .3, widthMm: 900 }];
  floor.referenceId = 'a'.repeat(64);
  plan.furniture = [{ id: 'door-a', catalogId: 'door-flush', floorId: floor.id, x: 1000, z: 1500, rotation: 0, widthMm: 950, depthMm: 160, heightMm: 2150, variant: 'oak' }, { id: 'chair-a', catalogId: 'chair', floorId: floor.id, x: 3000, z: 2000, rotation: 0, widthMm: 500, depthMm: 500, heightMm: 800, variant: 'oak' }];
  return plan;
}
export const camera = (floorId: string): CameraShotPose => ({ version: 1, kind: 'orbit', floorId, target: { x: 2, y: 0, z: 2 }, alpha: .7, beta: 1, radius: 10, mode: 0, fov: .8 });
it('preserves immutable Existing walls, openings and furniture through proposed removal, preview and one replacement restore', () => {
  const source = planFixture(), original = JSON.stringify(source);
  const saved = startRenovation(source, source.floors[0].id, validatePlan, { checkpointId: 'baseline', now });
  const changed: HistoryPlan = { ...saved, floors: saved.floors.map(f => ({ ...f, walls: [], openings: [] })), furniture: saved.furniture.filter(p => p.id !== 'door-a').map(p => ({ ...p, x: p.x + 500 })) };
  const proposed = updateProposedPhase(changed, changed.floors[0].id, validatePlan, { checkpointId: 'proposed', now });
  expect(JSON.stringify(source)).toBe(original); expect(saved.designHistory!.checkpoints).toHaveLength(1);
  expect(phasePreview(proposed, 'existing').checkpoint.snapshot.floors[0].walls[0].id).toBe('wall-a');
  expect(phasePreview(proposed, 'existing').checkpoint.snapshot.floors[0].openings[0].id).toBe('opening-a');
  expect(phasePreview(proposed, 'existing').checkpoint.snapshot.furniture.some(p => p.id === 'door-a')).toBe(true);
  expect(phasePreview(proposed, 'proposed').revision).toBe(2);
  expect(() => startRenovation(proposed, source.floors[0].id, validatePlan)).toThrow(/cannot be overwritten/);
  const restored = restoreDesignCheckpoint(proposed, 'baseline', validatePlan);
  expect(restored.plan.furniture).toEqual(source.furniture); expect(restored.plan.designHistory).toBe(proposed.designHistory);
  restored.plan.floors[0].walls[0].ax = 8;
  expect(phasePreview(proposed, 'existing').checkpoint.snapshot.floors[0].walls[0].ax).toBe(1);
  expect(proposed.floors[0].walls).toEqual([]); // previous editor plan remains available for normal Undo
});
it('classifies stable architecture/furniture IDs and filters the report without mutating geometry', () => {
  const source = planFixture(), saved = startRenovation(source, source.floors[0].id, validatePlan, { checkpointId: 'baseline', now });
  const next = { ...saved, furniture: saved.furniture.filter(p => p.id !== 'door-a').map(p => ({ ...p, x: 3200 })).concat({ ...saved.furniture[1], id: 'chair-b' }) };
  const proposed = updateProposedPhase(next, next.floors[0].id, validatePlan, { checkpointId: 'proposed', now }), before = JSON.stringify(proposed);
  const changes = renovationChanges(proposed);
  expect(changes.find(c => c.before?.id === 'door-a')?.status).toBe('remove');
  expect(changes.find(c => c.before?.id === 'chair-a')?.status).toBe('changed');
  expect(changes.find(c => c.after?.id === 'chair-b')?.status).toBe('new');
  const removed = filterPhaseChanges(changes, { architecture: true, furniture: false, statuses: ['remove'] }); expect(removed).toHaveLength(1); expect(removed[0].before?.id).toBe('door-a');
  expect(renovationReport(proposed)).toContain('"Existing → Proposed","2","remove"'); expect(JSON.stringify(proposed)).toBe(before);
});
it('requires opt-in manual capture, deduplicates snapshots, rejects dangling/nested data and removes unreferenced private checkpoints', () => {
  let plan = planFixture(); expect(() => captureDesignMilestone(plan, 'First', plan.floors[0].id, validatePlan)).toThrow(/Enable/);
  plan = setMilestoneRecording(plan, true, validatePlan);
  plan = captureDesignMilestone(plan, 'First', plan.floors[0].id, validatePlan, { id: 'one', checkpointId: 'a', now });
  plan = captureDesignMilestone(plan, 'Same layout', plan.floors[0].id, validatePlan, { id: 'two', checkpointId: 'b', now });
  expect(plan.designHistory!.checkpoints).toHaveLength(1); expect(plan.designHistory!.milestones.map(m => m.checkpointId)).toEqual(['a', 'a']);
  plan = deleteDesignMilestone(plan, 'one', validatePlan); expect(plan.designHistory!.checkpoints).toHaveLength(1);
  const serialized = JSON.parse(JSON.stringify(plan.designHistory)); validateDesignHistory(serialized, snapshot => validatePlan(historySnapshotAsPlan(plan, snapshot)));
  const nested = structuredClone(serialized) as any; nested.checkpoints[0].snapshot.designHistory = serialized; expect(() => validateDesignHistory(nested, () => {})).toThrow();
  const dangling = structuredClone(serialized)!; dangling.milestones[0].checkpointId = 'missing'; expect(() => validateDesignHistory(dangling, () => {})).toThrow();
  const cleared = clearDesignMilestones(plan, validatePlan); expect(cleared.designHistory!.checkpoints).toEqual([]); expect(cleared.designHistory!.recordingEnabled).toBe(false);
});
it('shares a checkpoint between phases and milestones while preserving immutable local reference IDs and excluding history from shares', () => {
  let plan = planFixture(); plan = startRenovation(plan, plan.floors[0].id, validatePlan, { checkpointId: 'existing', now });
  plan = setMilestoneRecording(plan, true, validatePlan); plan = captureDesignMilestone(plan, 'Before', plan.floors[0].id, validatePlan, { id: 'before', now });
  expect(plan.designHistory!.checkpoints).toHaveLength(1); expect(designHistoryReferenceIds(plan)).toEqual(['a'.repeat(64)]);
  const clearedReplay = clearDesignMilestones(plan, validatePlan); expect(clearedReplay.designHistory!.checkpoints).toHaveLength(1);
  expect(clearRenovationPhases(clearedReplay, validatePlan).designHistory!.checkpoints).toEqual([]);
  expect(publicHistoryPlan(plan)).not.toHaveProperty('designHistory');
  expect(historySnapshotAsPlan(plan, plan.designHistory!.checkpoints[0].snapshot)).not.toHaveProperty('designHistory');
  expect(Object.keys(plan.designHistory!.checkpoints[0].snapshot)).not.toContain('studioDrafts');
});
it('bounds checkpoint count, retained bytes and total plan size and preserves the chosen replay camera through reload', () => {
  let plan = setMilestoneRecording(planFixture(), true, validatePlan);
  for (let i = 0; i < 10; i++) plan = captureDesignMilestone(plan, `Step ${i}`, plan.floors[0].id, validatePlan, { id: `m${i}`, now });
  expect(() => captureDesignMilestone(plan, 'Too many', plan.floors[0].id, validatePlan)).toThrow(/10 milestones/);
  plan = saveDesignReplayView(plan, camera(plan.floors[0].id), validatePlan); const loaded = JSON.parse(JSON.stringify(plan));
  expect(milestonePreview(loaded, 'm0').camera).toEqual(camera(plan.floors[0].id));
  const huge = setMilestoneRecording(planFixture(), true, validatePlan); huge.floors[0].blueprint = { geometryKey: 'x'.repeat(751_000), rooms: [] };
  expect(() => captureDesignMilestone(huge, 'Huge', huge.floors[0].id, validatePlan)).toThrow(/750 KB/);
  let medium = setMilestoneRecording(planFixture(), true, validatePlan); medium.floors[0].blueprint = { geometryKey: 'x'.repeat(680_000), rooms: [] };
  medium = captureDesignMilestone(medium, 'One', medium.floors[0].id, validatePlan, { id: 'medium-1' });
  medium = { ...medium, floors: medium.floors.map(f => ({ ...f, name: 'Updated' })) }; medium = captureDesignMilestone(medium, 'Two', medium.floors[0].id, validatePlan, { id: 'medium-2' });
  medium = { ...medium, floors: medium.floors.map(f => ({ ...f, name: 'Another' })) };
  expect(() => captureDesignMilestone(medium, 'Three', medium.floors[0].id, validatePlan, { id: 'medium-3' })).toThrow(/2 MB/);
  const overCount = structuredClone(plan.designHistory)!; overCount.checkpoints = Array.from({ length: 13 }, (_, i) => ({ ...overCount.checkpoints[0], id: `too-many-${i}` }));
  expect(() => validateDesignHistory(overCount, () => {})).toThrow(/invalid design history/);
  const oversized = Object.assign(planFixture(), { extraMetadata: 'x'.repeat(8_000_001) }); expect(() => setMilestoneRecording(oversized, true, validatePlan)).toThrow(/8 MB/);
});
