import {publicMoodboardPlan} from './moodboards';
import {publicAtmospherePlan} from './sceneAtmosphere';
import {stripSurfaceTakeoffSettings} from './surfaceTakeoff';
import {stripSelectionSpecifications} from './selectionSchedule';
import {publicPersonalPlan} from './personalItems';
import type { FloorPlan, FurniturePlacement, PlanDocumentV1 } from './types';

export const MAX_LAYOUT_ALTERNATIVES = 6;
export const MAX_LAYOUT_SNAPSHOT_BYTES = 750_000;
export const MAX_LAYOUT_ALTERNATIVES_BYTES = 2_000_000;
const MAX_PROJECT_BYTES = 8_000_000;

export interface LayoutSnapshot {
  moodboards?:PlanDocumentV1["moodboards"];
  surfaceTakeoffSettings?:PlanDocumentV1["surfaceTakeoffSettings"];
  selectionBudgets?: PlanDocumentV1["selectionBudgets"];
  furnitureGroups?: PlanDocumentV1['furnitureGroups'];
  gridSizeMm: number;
  floors: FloorPlan[];
  furniture: FurniturePlacement[];
  environment?: PlanDocumentV1['environment'];
}
export interface LayoutAlternative {
  id: string;
  name: string;
  createdAt: string;
  activeFloorId: string;
  snapshot: LayoutSnapshot;
}
export interface LayoutAlternatives { version: 1; options: LayoutAlternative[] }
export type AlternativePlan = PlanDocumentV1 & { layoutAlternatives?: LayoutAlternatives };
export type PlanValidator = (value: unknown) => void;

const bytes = (value: unknown): number => {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch { throw new Error('Layout ideas contain unsupported or circular data.'); }
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every(key => keys.includes(key));
export function layoutIdeaName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Use a name between 1 and 60 characters.');
  }
  return name;
}

/** Invoke from the shared plan validator. The callback validates a nonrecursive snapshot. */
export function validateLayoutAlternatives(value: unknown, validateSnapshot: (snapshot: LayoutSnapshot) => void): asserts value is LayoutAlternatives {
  if (value === undefined) return;
  function fail(): never { throw new Error('This project contains invalid layout ideas.'); }
  if (!record(value) || !onlyKeys(value, ['version', 'options']) || value.version !== 1 ||
      !Array.isArray(value.options) || value.options.length > MAX_LAYOUT_ALTERNATIVES) fail();
  if (bytes(value) > MAX_LAYOUT_ALTERNATIVES_BYTES) throw new Error('Saved layout ideas exceed the 2 MB limit. Remove an idea or export a separate project.');
  const ids = new Set<string>();
  for (const option of value.options as unknown[]) {
    if (!record(option) || !onlyKeys(option, ['id', 'name', 'createdAt', 'activeFloorId', 'snapshot'])) fail();
    if (typeof option.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(option.id) || ids.has(option.id)) fail();
    ids.add(option.id);
    if (typeof option.name !== 'string' || layoutIdeaName(option.name) !== option.name) fail();
    if (typeof option.createdAt !== 'string' || option.createdAt.length > 40 || !Number.isFinite(Date.parse(option.createdAt))) fail();
    if (typeof option.activeFloorId !== 'string' || option.activeFloorId.length > 160) fail();
    const snapshot = option.snapshot;
    if (!record(snapshot) || !onlyKeys(snapshot, ['gridSizeMm', 'floors', 'furniture', 'environment','furnitureGroups','selectionBudgets','moodboards','surfaceTakeoffSettings'])) fail();
    if (bytes(snapshot) > MAX_LAYOUT_SNAPSHOT_BYTES) throw new Error('A layout idea exceeds the 750 KB limit. Export this layout as a separate project.');
    validateSnapshot(snapshot as unknown as LayoutSnapshot);
    if (!Array.isArray(snapshot.floors) || !snapshot.floors.some(floor => record(floor) && floor.id === option.activeFloorId)) fail();
  }
}

/** No camera, identity, references, drafts or option collection can enter a snapshot. */
export function captureLayout(plan: PlanDocumentV1): LayoutSnapshot {
  return structuredClone({
    gridSizeMm: plan.gridSizeMm,
    floors: plan.floors,
    furniture: plan.furniture,
    ...(plan.moodboards?{moodboards:plan.moodboards}:{}),
    ...(plan.surfaceTakeoffSettings?{surfaceTakeoffSettings:plan.surfaceTakeoffSettings}:{}),
    ...(plan.selectionBudgets?{selectionBudgets:plan.selectionBudgets}:{}),
    ...(plan.furnitureGroups?{furnitureGroups:plan.furnitureGroups}:{}),
    ...(plan.environment === undefined ? {} : { environment: plan.environment }),
  });
}

export function snapshotAsPlan(base: PlanDocumentV1, snapshot: LayoutSnapshot): PlanDocumentV1 {
  const { layoutAlternatives: _ideas, studioDrafts: _drafts, ...rest } = base as AlternativePlan;
  return { ...rest, ...snapshot, moodboards:snapshot.moodboards,surfaceTakeoffSettings:snapshot.surfaceTakeoffSettings,furnitureGroups:snapshot.furnitureGroups,selectionBudgets:snapshot.selectionBudgets, environment: snapshot.environment };
}

function checked(plan: AlternativePlan, validate: PlanValidator): AlternativePlan {
  validateLayoutAlternatives(plan.layoutAlternatives, snapshot => validate(snapshotAsPlan(plan, snapshot)));
  validate(plan);
  if (bytes(plan) > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 8 MB save limit. Export a separate project or remove a layout idea.');
  return plan;
}

export function saveLayoutAlternative(
  plan: AlternativePlan, name: string, activeFloorId: string, validate: PlanValidator,
  metadata: { id?: string; now?: string } = {},
): AlternativePlan {
  const options = plan.layoutAlternatives?.options ?? [];
  if (options.length >= MAX_LAYOUT_ALTERNATIVES) throw new Error('You can save up to 6 layout ideas. Remove one or export a separate project.');
  const option: LayoutAlternative = {
    id: metadata.id ?? crypto.randomUUID(),
    name: layoutIdeaName(name),
    createdAt: metadata.now ?? new Date().toISOString(),
    activeFloorId,
    snapshot: captureLayout(plan),
  };
  return checked({ ...plan, layoutAlternatives: { version: 1, options: [...options, option] } }, validate);
}

export function renameLayoutAlternative(plan: AlternativePlan, id: string, name: string, validate: PlanValidator): AlternativePlan {
  const options = plan.layoutAlternatives?.options;
  if (!options?.some(option => option.id === id)) throw new Error('This layout idea is no longer available.');
  const renamed = layoutIdeaName(name);
  return checked({ ...plan, layoutAlternatives: { version: 1, options: options.map(option => option.id === id ? { ...option, name: renamed } : option) } }, validate);
}

export function deleteLayoutAlternative(plan: AlternativePlan, id: string, validate: PlanValidator): AlternativePlan {
  const options = plan.layoutAlternatives?.options;
  if (!options?.some(option => option.id === id)) throw new Error('This layout idea is no longer available.');
  return checked({ ...plan, layoutAlternatives: { version: 1, options: options.filter(option => option.id !== id) } }, validate);
}

export function applyLayoutAlternative(plan: AlternativePlan, id: string, activeFloorId: string, validate: PlanValidator): { plan: AlternativePlan; activeFloorId: string } {
  const option = plan.layoutAlternatives?.options.find(candidate => candidate.id === id);
  if (!option) throw new Error('This layout idea is no longer available.');
  // Validate the complete source before discarding anything; malformed imported options must not be applied.
  checked(plan, validate);
  const next = checked({ ...snapshotAsPlan(plan, structuredClone(option.snapshot)), layoutAlternatives: plan.layoutAlternatives }, validate);
  return {
    plan: next,
    activeFloorId: next.floors.some(floor => floor.id === activeFloorId) ? activeFloorId : option.activeFloorId,
  };
}

export function layoutSummary(layout: LayoutSnapshot): { floors: number; namedRooms: number; furniture: number } {
  const rooms = new Set<string>();
  for (const floor of layout.floors) {
    for (const room of floor.blueprint?.rooms ?? []) rooms.add(floor.id + ':' + (room.groupId ?? room.id));
  }
  return { floors: layout.floors.length, namedRooms: rooms.size, furniture: layout.furniture.length };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'undefined';
}

export function layoutDifference(current: LayoutSnapshot, saved: LayoutSnapshot) {
  const now = new Map(current.furniture.map(item => [item.id, item]));
  const then = new Map(saved.furniture.map(item => [item.id, item]));
  const currentFloors = new Map(current.floors.map(floor => [floor.id, floor]));
  const savedFloors = new Map(saved.floors.map(floor => [floor.id, floor]));
  return {
    added: saved.furniture.filter(item => !now.has(item.id)).length,
    removed: current.furniture.filter(item => !then.has(item.id)).length,
    changed: saved.furniture.filter(item => now.has(item.id) && canonical(now.get(item.id)) !== canonical(item)).length,
    floorsChanged: [...new Set([...currentFloors.keys(), ...savedFloors.keys()])].filter(id => canonical(currentFloors.get(id)) !== canonical(savedFloors.get(id))).length,
    moodboardsChanged:canonical(current.moodboards)!==canonical(saved.moodboards),
    surfaceAssumptionsChanged:canonical(current.surfaceTakeoffSettings)!==canonical(saved.surfaceTakeoffSettings),
    environmentChanged: canonical(current.environment) !== canonical(saved.environment),
    gridChanged: current.gridSizeMm !== saved.gridSizeMm,
  };
}

export function publicLayoutPlan(plan: AlternativePlan): PlanDocumentV1 {
  const { layoutAlternatives: _ideas, studioDrafts: _drafts, ...published } = plan;
  return publicAtmospherePlan(stripSurfaceTakeoffSettings(publicMoodboardPlan(stripSelectionSpecifications(publicPersonalPlan({...published,floors:published.floors.map(({referenceId:_privateReference,...floor})=>floor)})))));
}
