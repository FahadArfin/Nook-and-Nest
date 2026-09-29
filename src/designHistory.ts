import { catalog } from './catalog';
import { captureLayout, layoutIdeaName, snapshotAsPlan, validateLayoutAlternatives, type LayoutSnapshot, type PlanValidator } from './layoutAlternatives';
import type { PlanDocumentV1 } from './types';
import { validCameraShot, type CameraShotPose } from './walkthrough';

export const MAX_HISTORY_CHECKPOINTS = 12;
export const MAX_DESIGN_MILESTONES = 10;
export const MAX_HISTORY_BYTES = 2_000_000;
export const MAX_CHECKPOINT_BYTES = 750_000;
export const MAX_HISTORY_PROJECT_BYTES = 8_000_000;
export interface DesignCheckpoint { id: string; capturedAt: string; activeFloorId: string; snapshot: LayoutSnapshot }
export interface DesignMilestone { id: string; name: string; checkpointId: string; createdAt: string }
export interface RenovationPhases { baselineId: string; proposedId: string; revision: number }
export interface DesignHistoryV1 {
  version: 1; recordingEnabled: boolean; checkpoints: DesignCheckpoint[];
  renovation?: RenovationPhases; milestones: DesignMilestone[]; replayView?: CameraShotPose;
}
export type HistoryPlan = PlanDocumentV1 & { designHistory?: DesignHistoryV1 };
export type HistoryMetadata = { id?: string; checkpointId?: string; now?: string };
export type PhaseStatus = 'keep' | 'remove' | 'new' | 'changed';
export interface PhaseEntity {
  key: string; id: string; floorId: string; domain: 'architecture' | 'furniture';
  kind: 'floor' | 'wall' | 'opening' | 'stairs' | 'wall-cut' | 'furniture';
  name: string; value: unknown;
}
export interface PhaseChange { key: string; status: PhaseStatus; before?: PhaseEntity; after?: PhaseEntity }
export interface PhaseFilters { architecture: boolean; furniture: boolean; statuses: PhaseStatus[]; floorId?: string }
export interface DesignHistoryPreview {
  checkpoint: DesignCheckpoint; label: string; phase: 'existing' | 'proposed' | 'milestone'; revision: number;
  camera?: CameraShotPose;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const stamp = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
export function historyBytes(v: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(v)).length; } catch { throw new Error('Design history contains unsupported data.'); }
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (record(v)) return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v) ?? 'undefined';
}
export const emptyDesignHistory = (): DesignHistoryV1 => ({ version: 1, recordingEnabled: false, checkpoints: [], milestones: [] });

/** Strip both snapshot collections before invoking a shared plan validator: no recursion. */
export function historySnapshotAsPlan(base: PlanDocumentV1, snapshot: LayoutSnapshot): PlanDocumentV1 {
  const { designHistory: _history, ...plain } = base as HistoryPlan;
  return snapshotAsPlan(plain, snapshot);
}
export function validateDesignHistory(value: unknown, validateSnapshot: (snapshot: LayoutSnapshot) => void): asserts value is DesignHistoryV1 | undefined {
  if (value === undefined) return;
  function fail(): never { throw new Error('This project contains invalid design history.'); }
  if (!record(value) || !keys(value, ['version', 'recordingEnabled', 'checkpoints', 'renovation', 'milestones', 'replayView']) || value.version !== 1 || typeof value.recordingEnabled !== 'boolean' || !Array.isArray(value.checkpoints) || value.checkpoints.length > MAX_HISTORY_CHECKPOINTS || !Array.isArray(value.milestones) || value.milestones.length > MAX_DESIGN_MILESTONES) fail();
  if (historyBytes(value) > MAX_HISTORY_BYTES) throw new Error('Design history exceeds 2 MB. Remove milestones or keep a separate project backup.');
  const checkpointIds = new Set<string>(), referenced = new Set<string>(), milestoneIds = new Set<string>();
  for (const c of value.checkpoints) {
    if (!record(c) || !keys(c, ['id', 'capturedAt', 'activeFloorId', 'snapshot']) || !id(c.id) || checkpointIds.has(c.id) || !stamp(c.capturedAt)) fail();
    if (historyBytes(c.snapshot) > MAX_CHECKPOINT_BYTES) throw new Error('This checkpoint exceeds 750 KB. Keep a separate project backup.');
    // Reuse the existing strict snapshot structure, limits and real plan geometry validator.
    validateLayoutAlternatives({ version: 1, options: [{ id: c.id, name: 'Checkpoint', createdAt: c.capturedAt, activeFloorId: c.activeFloorId, snapshot: c.snapshot }] }, validateSnapshot);
    checkpointIds.add(c.id);
  }
  if (value.renovation !== undefined) {
    const r = value.renovation;
    if (!record(r) || !keys(r, ['baselineId', 'proposedId', 'revision']) || !id(r.baselineId) || !id(r.proposedId) || !checkpointIds.has(r.baselineId) || !checkpointIds.has(r.proposedId) || typeof r.revision !== 'number' || !Number.isSafeInteger(r.revision) || r.revision < 1 || r.revision > 1_000_000) fail();
    referenced.add(r.baselineId); referenced.add(r.proposedId);
  }
  for (const m of value.milestones) {
    if (!record(m) || !keys(m, ['id', 'name', 'checkpointId', 'createdAt']) || !id(m.id) || milestoneIds.has(m.id) || !id(m.checkpointId) || !checkpointIds.has(m.checkpointId) || !stamp(m.createdAt) || typeof m.name !== 'string' || layoutIdeaName(m.name) !== m.name) fail();
    milestoneIds.add(m.id); referenced.add(m.checkpointId);
  }
  if (checkpointIds.size !== referenced.size) fail(); // Deleted snapshots must not linger as hidden private history.
  if (value.replayView !== undefined) {
    if (!record(value.replayView) || !keys(value.replayView, ['version', 'kind', 'floorId', 'target', 'alpha', 'beta', 'radius', 'mode', 'fov']) || !validCameraShot(value.replayView) || value.replayView.kind !== 'orbit' || value.replayView.floorId.length > 160 || !keys(value.replayView.target as unknown as Record<string, unknown>, ['x', 'y', 'z'])) fail();
  }
}
function historyOf(plan: HistoryPlan) { return plan.designHistory ?? emptyDesignHistory(); }
function compact(history: DesignHistoryV1): DesignHistoryV1 {
  const referenced = new Set(history.milestones.map(m => m.checkpointId));
  if (history.renovation) { referenced.add(history.renovation.baselineId); referenced.add(history.renovation.proposedId); }
  return { ...history, checkpoints: history.checkpoints.filter(c => referenced.has(c.id)) };
}
function checked(plan: HistoryPlan, validate: PlanValidator): HistoryPlan {
  validateDesignHistory(plan.designHistory, snapshot => validate(historySnapshotAsPlan(plan, snapshot)));
  validate(plan);
  if (historyBytes(plan) > MAX_HISTORY_PROJECT_BYTES) throw new Error('This project exceeds the 8 MB save limit. Remove a saved idea/milestone or export a separate project.');
  return plan;
}
function withHistory(plan: HistoryPlan, history: DesignHistoryV1, validate: PlanValidator) { return checked({ ...plan, designHistory: compact(history) }, validate); }
function capture(plan: HistoryPlan, floorId: string, metadata: HistoryMetadata): { history: DesignHistoryV1; checkpoint: DesignCheckpoint } {
  const history = historyOf(plan), snapshot = captureLayout(plan), serialized = canonical(snapshot);
  const existing = history.checkpoints.find(c => c.activeFloorId === floorId && canonical(c.snapshot) === serialized);
  if (existing) return { history, checkpoint: existing };
  const checkpoint: DesignCheckpoint = { id: metadata.checkpointId ?? crypto.randomUUID(), capturedAt: metadata.now ?? new Date().toISOString(), activeFloorId: floorId, snapshot };
  if (history.checkpoints.some(c => c.id === checkpoint.id)) throw new Error('This checkpoint identifier is already in use.');
  return { history: { ...history, checkpoints: [...history.checkpoints, checkpoint] }, checkpoint };
}
export function startRenovation(plan: HistoryPlan, floorId: string, validate: PlanValidator, metadata: HistoryMetadata = {}): HistoryPlan {
  checked(plan, validate);
  if (plan.designHistory?.renovation) throw new Error('An Existing baseline is already saved. It cannot be overwritten.');
  const { history, checkpoint } = capture(plan, floorId, metadata);
  return withHistory(plan, { ...history, renovation: { baselineId: checkpoint.id, proposedId: checkpoint.id, revision: 1 } }, validate);
}
export function updateProposedPhase(plan: HistoryPlan, floorId: string, validate: PlanValidator, metadata: HistoryMetadata = {}): HistoryPlan {
  checked(plan, validate);
  const renovation = plan.designHistory?.renovation;
  if (!renovation) throw new Error('Save the Existing baseline first.');
  const { history, checkpoint } = capture(plan, floorId, metadata);
  return withHistory(plan, { ...history, renovation: { ...renovation, proposedId: checkpoint.id, revision: renovation.revision + 1 } }, validate);
}
export function setMilestoneRecording(plan: HistoryPlan, enabled: boolean, validate: PlanValidator): HistoryPlan {
  return withHistory(plan, { ...historyOf(plan), recordingEnabled: enabled }, validate);
}
export function captureDesignMilestone(plan: HistoryPlan, name: string, floorId: string, validate: PlanValidator, metadata: HistoryMetadata = {}): HistoryPlan {
  checked(plan, validate);
  if (!historyOf(plan).recordingEnabled) throw new Error('Enable manual milestones before saving one.');
  if (historyOf(plan).milestones.length >= MAX_DESIGN_MILESTONES) throw new Error('Keep up to 10 milestones. Remove one or export a separate project.');
  const { history, checkpoint } = capture(plan, floorId, metadata);
  const milestone = { id: metadata.id ?? crypto.randomUUID(), name: layoutIdeaName(name), checkpointId: checkpoint.id, createdAt: metadata.now ?? new Date().toISOString() };
  return withHistory(plan, { ...history, milestones: [...history.milestones, milestone] }, validate);
}
export function renameDesignMilestone(plan: HistoryPlan, milestoneId: string, name: string, validate: PlanValidator): HistoryPlan {
  const history = historyOf(plan); if (!history.milestones.some(m => m.id === milestoneId)) throw new Error('This milestone is no longer available.');
  return withHistory(plan, { ...history, milestones: history.milestones.map(m => m.id === milestoneId ? { ...m, name: layoutIdeaName(name) } : m) }, validate);
}
export function deleteDesignMilestone(plan: HistoryPlan, milestoneId: string, validate: PlanValidator): HistoryPlan {
  const history = historyOf(plan); if (!history.milestones.some(m => m.id === milestoneId)) throw new Error('This milestone is no longer available.');
  return withHistory(plan, { ...history, milestones: history.milestones.filter(m => m.id !== milestoneId) }, validate);
}
export function clearDesignMilestones(plan: HistoryPlan, validate: PlanValidator): HistoryPlan {
  const { replayView: _view, ...history } = historyOf(plan);
  return withHistory(plan, { ...history, recordingEnabled: false, milestones: [] }, validate);
}
export function clearRenovationPhases(plan: HistoryPlan, validate: PlanValidator): HistoryPlan {
  const { renovation: _renovation, ...history } = historyOf(plan);
  return withHistory(plan, history, validate);
}
export function saveDesignReplayView(plan: HistoryPlan, view: CameraShotPose, validate: PlanValidator): HistoryPlan {
  if (!validCameraShot(view) || view.kind !== 'orbit') throw new Error('Choose an orbit view before saving the replay camera.');
  return withHistory(plan, { ...historyOf(plan), replayView: structuredClone(view) }, validate);
}
export function historyCheckpoint(plan: HistoryPlan, checkpointId: string): DesignCheckpoint {
  const result = plan.designHistory?.checkpoints.find(c => c.id === checkpointId);
  if (!result) throw new Error('This design checkpoint is no longer available.');
  return result;
}
export function restoreDesignCheckpoint(plan: HistoryPlan, checkpointId: string, validate: PlanValidator): { plan: HistoryPlan; activeFloorId: string } {
  checked(plan, validate); const checkpoint = historyCheckpoint(plan, checkpointId);
  const replacement = historySnapshotAsPlan(plan, structuredClone(checkpoint.snapshot));
  return { plan: checked({ ...replacement, layoutAlternatives: plan.layoutAlternatives, designHistory: plan.designHistory }, validate), activeFloorId: checkpoint.activeFloorId };
}
export function phasePreview(plan: HistoryPlan, phase: 'existing' | 'proposed'): DesignHistoryPreview {
  const phases = plan.designHistory?.renovation; if (!phases) throw new Error('Save the Existing baseline first.');
  return { checkpoint: historyCheckpoint(plan, phase === 'existing' ? phases.baselineId : phases.proposedId), phase, revision: phase === 'existing' ? 0 : phases.revision, label: phase === 'existing' ? 'Existing · baseline' : `Proposed · revision ${phases.revision}` };
}
export function milestonePreview(plan: HistoryPlan, milestoneId: string): DesignHistoryPreview {
  const milestone = plan.designHistory?.milestones.find(m => m.id === milestoneId); if (!milestone) throw new Error('This milestone is no longer available.');
  const checkpoint = historyCheckpoint(plan, milestone.checkpointId), savedView = plan.designHistory?.replayView;
  const camera = savedView ? { ...structuredClone(savedView), floorId: checkpoint.snapshot.floors.some(f => f.id === savedView.floorId) ? savedView.floorId : checkpoint.activeFloorId } : undefined;
  return { checkpoint, phase: 'milestone', revision: 0, label: milestone.name, camera };
}
/** For backup reference collectors only; no files, pixels, URLs or reference contents are embedded. */
export function designHistoryReferenceIds(plan: HistoryPlan): string[] {
  return [...new Set((plan.designHistory?.checkpoints ?? []).flatMap(c => c.snapshot.floors.map(f => f.referenceId).filter((s): s is string => !!s)))];
}
export function publicHistoryPlan(plan: HistoryPlan): PlanDocumentV1 {
  const { designHistory: _history, ...publicPlan } = plan; return publicPlan;
}

const catalogNames = new Map(catalog.map(item => [item.id, item]));
function entities(layout: LayoutSnapshot): PhaseEntity[] {
  const result: PhaseEntity[] = [], key = (kind: string, floorId: string, entityId: string) => JSON.stringify([kind, floorId, entityId]);
  for (const floor of layout.floors) {
    const { walls, openings, stairs, wallCuts, referenceId: _reference, ...surface } = floor;
    result.push({ key: key('floor', floor.id, floor.id), id: floor.id, floorId: floor.id, domain: 'architecture', kind: 'floor', name: `${floor.name}: floor shape, height and finishes`, value: { ...surface, gridSizeMm: layout.gridSizeMm } });
    for (const [kind, values] of [['wall', walls], ['opening', openings], ['stairs', stairs], ['wall-cut', wallCuts ?? []]] as const) for (const item of values) {
      result.push({ key: key(kind, floor.id, item.id), id: item.id, floorId: floor.id, domain: 'architecture', kind, name: `${floor.name}: ${kind === 'wall-cut' ? 'wall cut' : kind}${kind === 'opening' ? ` (${'kind' in item ? item.kind : ''})` : ''}`, value: { ...item, gridSizeMm: layout.gridSizeMm } });
    }
  }
  for (const item of layout.furniture) {
    const known = catalogNames.get(item.catalogId), architecture = known && ['Doors', 'Windows', 'Stairs'].includes(known.category);
    result.push({ key: key('furniture', '', item.id), id: item.id, floorId: item.floorId, domain: architecture ? 'architecture' : 'furniture', kind: 'furniture', name: known?.name ?? item.catalogId, value: item });
  }
  return result;
}
/** Stable-ID planning differences, never an inferred demolition permission. */
export function renovationChanges(plan: HistoryPlan): PhaseChange[] {
  const phases = plan.designHistory?.renovation; if (!phases) return [];
  const before = new Map(entities(historyCheckpoint(plan, phases.baselineId).snapshot).map(e => [e.key, e]));
  const after = new Map(entities(historyCheckpoint(plan, phases.proposedId).snapshot).map(e => [e.key, e]));
  const result: PhaseChange[] = [...new Set([...before.keys(), ...after.keys()])].map(key => ({ key, before: before.get(key), after: after.get(key), status: !before.has(key) ? 'new' : !after.has(key) ? 'remove' : canonical(before.get(key)!.value) === canonical(after.get(key)!.value) ? 'keep' : 'changed' }));
  const priority: Record<PhaseStatus, number> = { remove: 0, new: 1, changed: 2, keep: 3 };
  return result.sort((a, b) => priority[a.status] - priority[b.status]);
}
export function filterPhaseChanges(changes: readonly PhaseChange[], filters: PhaseFilters): PhaseChange[] {
  return changes.filter(change => { const item = change.after ?? change.before!; return filters.statuses.includes(change.status) && (item.domain === 'architecture' ? filters.architecture : filters.furniture) && (!filters.floorId || item.floorId === filters.floorId || change.before?.floorId === filters.floorId); });
}
export function renovationReport(plan: HistoryPlan): string {
  const phases = plan.designHistory?.renovation; if (!phases) throw new Error('Save the Existing baseline first.');
  const quote = (v: string) => '"' + (/^[=+@\-\t\r]/.test(v) ? "'" : '') + v.replace(/"/g, '""') + '"';
  const rows = [['Phase', 'Revision', 'Classification', 'Kind', 'Item', 'Floor ID', 'Stable ID'], ...renovationChanges(plan).map(change => { const entity = change.after ?? change.before!; return ['Existing → Proposed', String(phases.revision), change.status, entity.kind, entity.name, entity.floorId, entity.id]; })];
  return 'Planning comparison only; not demolition approval, structural advice or permit documentation.\r\n' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
