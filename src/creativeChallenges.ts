import clipping from 'polygon-clipping';
import { catalog, isStairs } from './catalog';
import { createBlankPlan, rectangleCells } from './domain';
import { geometryKey } from './blueprint';
import { footprint } from './agentDesign';
import { visibleFloorRects } from './building';
import { fieldCount } from './vegetationField';
import { geometryArea, polygonBounds, shapeOf, unionShapes } from './polygonGeometry';
import type { PlanDocumentV1, Units } from './types';

export type ChallengeId = 'reading-nook' | 'two-hobbies' | 'pet-corner' | 'one-color-studio';
export interface CreativeChallenge { version: 1; briefId: ChallengeId; seed: number; startedAt: string; hintsDismissed: boolean }
export type ChallengePlan = PlanDocumentV1 & { creativeChallenge?: CreativeChallenge };
interface Requirement { label: string; ids: readonly string[] }
interface Definition { id: ChallengeId; title: string; description: string; size: [number, number]; maxPieces: number; requirements: Requirement[]; hints: readonly string[]; palette?: boolean }
export const challengeDefinitions: readonly Definition[] = [
  { id: 'reading-nook', title: 'A pocket of quiet', description: 'Make a small reading corner with a comfortable seat, a place for a cup and a reading light.', size: [2500, 2000], maxPieces: 6, requirements: [{ label: 'A reading seat', ids: ['armchair', 'slat-lounge-chair'] }, { label: 'A small table', ids: ['side-table', 'c-side-table', 'tray-side-table'] }, { label: 'A reading light', ids: ['floor-lamp', 'tripod-floor-lamp'] }], hints: ['Try the seat at an angle, then check its full footprint.', 'Leave some empty floor around the seat.', 'You can reuse the Quiet reading nook recipe and adjust its pieces.'] },
  { id: 'two-hobbies', title: 'Two hobbies, one hideaway', description: 'Combine a sewing or making desk with a quiet place to read in the same modest room.', size: [3500, 3250], maxPieces: 10, requirements: [{ label: 'A making desk', ids: ['trestle-desk', 'compact-computer-desk'] }, { label: 'A work chair', ids: ['dining-chair', 'office-chair'] }, { label: 'A sewing machine', ids: ['desktop-sewing-machine'] }, { label: 'A separate reading seat', ids: ['armchair', 'slat-lounge-chair'] }], hints: ['The Hobby corner recipe has independent desktop tools.', 'Use the support chooser for the sewing machine.', 'Try turning the desk before adding more storage.'] },
  { id: 'pet-corner', title: 'A shared sunny corner', description: 'Give a pet a resting spot, a drinking fountain and a nearby place for a person to relax.', size: [3000, 2500], maxPieces: 7, requirements: [{ label: 'A pet resting spot', ids: ['pet-bed', 'cat-tree'] }, { label: 'A pet fountain', ids: ['pet-water-fountain'] }, { label: 'A human seat', ids: ['armchair', 'slat-lounge-chair'] }], hints: ['Pet needs differ; these are layout pieces, not care guidance.', 'Keep the fountain on the floor with space around it.', 'A little empty space can connect the two resting spots.'] },
  { id: 'one-color-studio', title: 'One color, many textures', description: 'Create a compact sleeping, sitting and working room, repeating one main swatch on at least three pieces.', size: [4000, 4000], maxPieces: 12, requirements: [{ label: 'A bed', ids: ['single-bed'] }, { label: 'A seat', ids: ['armchair', 'loveseat'] }, { label: 'A work surface', ids: ['compact-computer-desk', 'trestle-desk'] }], palette: true, hints: ['Repeat the chosen main swatch while keeping wood and hardware finishes.', 'Try the Guest room and Cozy office recipes one at a time.', 'The color goal reads saved main swatches; untintable authored materials keep their own appearance.'] },
];
const names = new Map(catalog.map(c => [c.id, c.name]));
const catalogById = new Map(catalog.map(c => [c.id, c]));
export interface ChallengeBrief { id: ChallengeId; seed: number; title: string; description: string; widthMm: number; depthMm: number; areaM2: number; maxPieces: number; mainSwatch?: string; requirements: Array<{ label: string; ids: string[]; suggestion: string }>; hints: string[]; available: boolean; missing: string[] }
function random(seed: number) { let state = seed >>> 0; return () => { state += 0x6d2b79f5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
export function parseCreativeChallenge(value: unknown): CreativeChallenge {
  const c = value as CreativeChallenge;
  if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some(k => !['version', 'briefId', 'seed', 'startedAt', 'hintsDismissed'].includes(k)) || c.version !== 1 || !challengeDefinitions.some(d => d.id === c.briefId) || !Number.isInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff || typeof c.startedAt !== 'string' || c.startedAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(c.startedAt) || !Number.isFinite(Date.parse(c.startedAt)) || typeof c.hintsDismissed !== 'boolean') throw new Error('This private creative brief is invalid.');
  return structuredClone(c);
}
export function challengeBrief(id: ChallengeId, seed: number, available = new Set(catalog.map(c => c.id))): ChallengeBrief {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Use a whole seed number between 0 and 4,294,967,295.');
  const definition = challengeDefinitions.find(d => d.id === id); if (!definition) throw new Error('Choose an available creative brief.');
  const roll = random(seed), transpose = roll() > .5, widthMm = definition.size[transpose ? 1 : 0], depthMm = definition.size[transpose ? 0 : 1];
  const requirements = definition.requirements.map(r => { const ids = r.ids.filter(id => available.has(id)); return { label: r.label, ids, suggestion: ids.length ? ids[Math.floor(roll() * ids.length)] : '' }; });
  const swatches = ['sage', 'oat', 'clay', 'slate'];
  return { id, seed, title: definition.title, description: definition.description, widthMm, depthMm, areaM2: widthMm * depthMm / 1_000_000, maxPieces: definition.maxPieces, ...(definition.palette ? { mainSwatch: swatches[Math.floor(roll() * swatches.length)] } : {}), requirements, hints: [...definition.hints], available: requirements.every(r => r.ids.length > 0), missing: requirements.filter(r => !r.ids.length).map(r => r.label) };
}
/** Creates a new isolated document only. Parent owns saving the existing project and opening this one. */
export function createChallengeProject(brief: ChallengeBrief, units: Units, now = new Date().toISOString()): ChallengePlan {
  const checked = challengeBrief(brief.id, brief.seed); if (!checked.available) throw new Error('A required catalog piece is unavailable. Choose another brief.');
  const plan = createBlankPlan(`${checked.title} · ${checked.seed}`, units), first = plan.floors[0];
  const floor = { ...first, name: 'Creative room', heightMm: 2600, cells: rectangleCells(checked.widthMm / 250, checked.depthMm / 250) };
  floor.blueprint = { geometryKey: geometryKey(floor), rooms: [{ id: crypto.randomUUID(), name: 'Creative room', kind: 'Living', enclosed: true, x: 0, z: 0, width: checked.widthMm, depth: checked.depthMm }] };
  return { ...plan, createdAt: now, updatedAt: now, gridSizeMm: 250, floors: [floor], creativeChallenge: parseCreativeChallenge({ version: 1, briefId: checked.id, seed: checked.seed, startedAt: now, hintsDismissed: false }) };
}
export interface ChallengeGoal { id: string; label: string; complete: boolean; detail: string }
const floorShapes = new WeakMap<PlanDocumentV1['floors'], Map<string, Map<string, ReturnType<typeof unionShapes>>>>();
function challengeFloorShapes(plan: PlanDocumentV1) {
  const key = JSON.stringify([plan.gridSizeMm, plan.furniture.filter(p => isStairs(p.catalogId))]);
  const cache = floorShapes.get(plan.floors) ?? new Map<string, Map<string, ReturnType<typeof unionShapes>>>();
  const previous = cache.get(key); if (previous) return previous;
  const shapes = new Map(plan.floors.map(f => [f.id, unionShapes(visibleFloorRects(plan, f.id))]));
  if (cache.size >= 2) cache.clear(); cache.set(key, shapes); floorShapes.set(plan.floors, cache); return shapes;
}
export function challengeProgress(plan: ChallengePlan): { brief: ChallengeBrief; goals: ChallengeGoal[]; bounded: boolean } | undefined {
  if (!plan.creativeChallenge) return undefined;
  const saved = parseCreativeChallenge(plan.creativeChallenge), brief = challengeBrief(saved.briefId, saved.seed);
  if (plan.furniture.length > 300 || plan.floors.reduce((sum, floor) => sum + floor.cells.length, 0) > 2000 || fieldCount(plan.environment?.vegetationField) > 0) return { brief, bounded: false, goals: [{ id: 'scope', label: 'Keep this a small creative project', complete: false, detail: 'Constraint checks cover individual placed pieces, up to 300 pieces and 2,000 floor cells. Dense field-brush planting is outside this brief. Your design is still editable.' }] };
  const goals: ChallengeGoal[] = brief.requirements.map((r, i) => ({ id: `role-${i}`, label: r.label, complete: plan.furniture.some(p => r.ids.includes(p.catalogId)), detail: r.ids.length ? r.ids.map(id => names.get(id) ?? id).join(' or ') : 'Required catalog pieces are currently unavailable.' }));
  const floors = challengeFloorShapes(plan);
  const area = [...floors.values()].reduce((sum, shape) => sum + geometryArea(shape), 0) / 1_000_000;
  goals.push({ id: 'area', label: `Use at most ${brief.areaM2} m² of floor`, complete: area > 0 && area <= brief.areaM2 + .000001, detail: `${area.toFixed(2)} m² across the current floor layers.` });
  const outside = plan.furniture.filter(item => {
    const definition = catalogById.get(item.catalogId); if (definition?.mount === 'wall' || definition?.mount === 'ceiling' || ['Doors', 'Windows', 'Stairs'].includes(definition?.category ?? '')) return false;
    const corners = footprint(item); return geometryArea(clipping.difference(shapeOf(polygonBounds([corners[0], corners[1], corners[3], corners[2]])), floors.get(item.floorId) ?? [])) > 1;
  });
  goals.push({ id: 'inside', label: 'Keep freestanding footprints on the floor', complete: plan.furniture.length > 0 && !outside.length, detail: outside.length ? `${outside.length} footprints cross a floor edge or opening.` : 'Checks rotated footprints, including irregular floor edges. Wall and ceiling pieces are excluded.' });
  goals.push({ id: 'pieces', label: `Use no more than ${brief.maxPieces} separate pieces`, complete: plan.furniture.length > 0 && plan.furniture.length <= brief.maxPieces, detail: `${plan.furniture.length} independent pieces; grouped pieces still count separately.` });
  if (brief.mainSwatch) { const count = plan.furniture.filter(p => p.variant === brief.mainSwatch).length; goals.push({ id: 'swatch', label: `Repeat the ${brief.mainSwatch} main swatch on three pieces`, complete: count >= 3, detail: `${count} saved main swatches match. This does not measure every authored material or judge the visual result.` }); }
  return { brief, goals, bounded: true };
}
export function updateCreativeChallenge(base: ChallengePlan, current: ChallengePlan, value: CreativeChallenge | undefined, validate: (plan: unknown) => void): ChallengePlan {
  if (base !== current) throw new Error('The project changed. Reopen the creative brief before saving.');
  const { creativeChallenge: _old, ...rest } = base, next = value ? { ...rest, creativeChallenge: parseCreativeChallenge(value) } : rest;
  validate(next); if (new TextEncoder().encode(JSON.stringify(next)).length > 8_000_000) throw new Error('This project exceeds the 8 MB save limit.'); return next;
}
export function withoutCreativeChallenge<T extends { creativeChallenge?: unknown }>(plan: T): Omit<T, 'creativeChallenge'> { const { creativeChallenge: _private, ...publicPlan } = plan; return publicPlan; }
