import {parsePersonalItemMetadata} from './personalItems';
import {catalog, isDoor, isStairs, isWallOpening} from './catalog';
import clipping from 'polygon-clipping';
import {designWarnings, footprint, overlap} from './agentDesign';
import {floorRects} from './floorGeometry';
import {visibleFloorRects} from './building';
import {geometryArea, polygonBounds, shapeOf, unionShapes} from './polygonGeometry';
import {restsOnShelf} from './shelfSurfaces';
import {validatePlan, MAX_PLAN_BYTES} from './planValidation';
import type {FurniturePlacement, PlanDocumentV1} from './types';

export const MAX_KIT_PIECES = 40;
export const MAX_SAVED_KITS = 40;
export const MAX_KIT_BYTES = 256 * 1024;
export type KitPiece = Omit<FurniturePlacement, 'id' | 'floorId' | 'toFloorId' | 'stairRiseMm' | 'doorless' | 'hostDoorId'>;
export interface FurnitureKit {
  version: 1; id: string; name: string; createdAt: string; updatedAt: string; pieces: KitPiece[];
}
export interface KitPosition {x: number; z: number; rotation: number}
const byId = new Map(catalog.map(item => [item.id, item]));
const pieceKeys = new Set(['personalItem','catalogId','x','z','rotation','widthMm','depthMm','heightMm','variant','surfaceVariant','materialColors','elevationMm','moduleRun','showerMirrored','openFraction','terrainAnchored']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, min = -10_000_000, max = 10_000_000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const shortText = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);

export function kitName(name: unknown): string {
  if (!shortText(name, 80)) throw new Error('Give this kit a name of 1–80 characters.');
  return name.trim();
}

/** Deliberately bounded first slice: no wall attachments, apertures or floor links. */
export function kitPieceProblem(piece: Pick<FurniturePlacement, 'catalogId' | 'toFloorId' | 'terrainAnchored'>): string | undefined {
  const item = byId.get(piece.catalogId);
  if (!item) return `The catalog no longer includes ${piece.catalogId}.`;
  if (isDoor(item.id) || isStairs(item.id) || isWallOpening(item.id) || piece.toFloorId) return 'Doors, windows and stairs stay outside reusable furniture kits.';
  if (item.mount === 'wall' || item.mount === 'ceiling') return 'Wall and ceiling attachments are not included in this first kit collection.';
  if (piece.terrainAnchored) return 'Terrain-anchored pieces need individual placement in the new landscape.';
  return undefined;
}

/** Local data is untrusted. Validate without dropping unknown-catalog pieces: keep the kit recoverable. */
export function parseFurnitureKit(value: unknown): FurnitureKit {
  if (!record(value) || Object.keys(value).some(k => !['version','id','name','createdAt','updatedAt','pieces'].includes(k)) || value.version !== 1 || !shortText(value.id, 100) || !Array.isArray(value.pieces) || !value.pieces.length || value.pieces.length > MAX_KIT_PIECES) throw new Error('This saved kit is invalid or too large.');
  const name = kitName(value.name);
  for (const key of ['createdAt','updatedAt'] as const) if (!shortText(value[key], 40) || !Number.isFinite(Date.parse(value[key]))) throw new Error('This kit has an invalid saved date.');
  for (const p of value.pieces) {
    if (!record(p) || Object.keys(p).some(k => !pieceKeys.has(k)) || !shortText(p.catalogId, 160) || !shortText(p.variant, 100)) throw new Error('A kit piece is invalid.');
    if(p.personalItem!==undefined)parsePersonalItemMetadata(p.personalItem);
    for (const key of ['x','z','rotation']) if (!finite(p[key])) throw new Error('A kit contains an invalid position.');
    for (const key of ['widthMm','depthMm','heightMm']) if (!finite(p[key], 1, 50000)) throw new Error('A kit contains invalid dimensions.');
    if (p.elevationMm !== undefined && !finite(p.elevationMm)) throw new Error('A kit contains an invalid height.');
    if (p.surfaceVariant !== undefined && !shortText(p.surfaceVariant, 100)) throw new Error('A kit finish is invalid.');
    if (p.openFraction !== undefined && !finite(p.openFraction, 0, 1)) throw new Error('A kit state is invalid.');
    for (const key of ['moduleRun','showerMirrored','terrainAnchored']) if (p[key] !== undefined && typeof p[key] !== 'boolean') throw new Error('A kit option is invalid.');
    if (p.materialColors !== undefined) {
      if (!record(p.materialColors) || Object.keys(p.materialColors).length > 100) throw new Error('A kit has invalid material colors.');
      for (const [key, color] of Object.entries(p.materialColors)) if (!shortText(key, 100) || ['__proto__','constructor','prototype'].includes(key) || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('A kit has invalid material colors.');
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_KIT_BYTES) throw new Error('This kit is too large to save.');
  return structuredClone({...value, name}) as unknown as FurnitureKit;
}

export function createFurnitureKit(plan: PlanDocumentV1, floorId: string, selectedIds: readonly string[], name: string): FurnitureKit {
  if (!plan.floors.some(f => f.id === floorId)) throw new Error('Choose an existing floor first.');
  const ids = new Set(selectedIds);
  if (!ids.size || ids.size !== selectedIds.length || ids.size > MAX_KIT_PIECES) throw new Error(`Choose 1–${MAX_KIT_PIECES} distinct pieces.`);
  const chosen = plan.furniture.filter(piece => ids.has(piece.id));
  if (chosen.length !== ids.size || chosen.some(piece => piece.floorId !== floorId)) throw new Error('Choose pieces from the current floor only.');
  for (const piece of chosen) {const problem = kitPieceProblem(piece); if (problem) throw new Error(problem);}
  // Anchor to a selected item, avoiding rounding and any implicit selection of supported decorations.
  const anchor = chosen[0], now = new Date().toISOString();
  const pieces = chosen.map(piece => {
    const copy: Record<string, unknown> = {};
    for (const key of pieceKeys) if (Object.hasOwn(piece, key)) copy[key] = structuredClone((piece as unknown as Record<string, unknown>)[key]);
    copy.x = piece.x - anchor.x; copy.z = piece.z - anchor.z;
    return copy as unknown as KitPiece;
  });
  return parseFurnitureKit({version: 1, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, pieces});
}

export function unavailableKitPieces(kit: FurnitureKit): string[] {
  return [...new Set(kit.pieces.map(p => kitPieceProblem(p)).filter((p): p is string => !!p))];
}

/** Selection is explicit and never rewrites the private source or shifts its anchor. */
export function selectKitPieces(input: FurnitureKit, indices: readonly number[]): FurnitureKit {
  const kit = parseFurnitureKit(input), selected = new Set(indices);
  if (!selected.size) throw new Error('Keep at least one piece before previewing.');
  if (selected.size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= kit.pieces.length)) throw new Error('Choose valid pieces from this arrangement.');
  return {...kit, pieces: kit.pieces.filter((_, i) => selected.has(i))};
}

/** An explicit substitute gets its own authored dimensions and finishes, never a retired model's overrides. */
export function replaceKitPiece(input: FurnitureKit, index: number, catalogId: string): FurnitureKit {
  const kit=parseFurnitureKit(input), item=byId.get(catalogId);
  if(!Number.isInteger(index)||index<0||index>=kit.pieces.length)throw new Error('Choose a piece in this arrangement.');
  if(!item)throw new Error('Choose an available model.');
  const problem=kitPieceProblem({catalogId});if(problem)throw new Error(problem);
  const previous=kit.pieces[index];
  kit.pieces[index]={catalogId,x:previous.x,z:previous.z,rotation:previous.rotation,widthMm:item.widthMm,depthMm:item.depthMm,heightMm:item.heightMm,variant:'oat',...(previous.elevationMm===undefined?{}:{elevationMm:previous.elevationMm})};
  return parseFurnitureKit(kit);
}

function transformed(piece: KitPiece, position: KitPosition): KitPiece {
  const a = position.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return {...structuredClone(piece), x: position.x + piece.x * c + piece.z * s, z: position.z - piece.x * s + piece.z * c, rotation: piece.rotation + position.rotation};
}

export function kitBounds(kit: FurnitureKit, rotation = 0) {
  const points = kit.pieces.flatMap((p, i) => footprint({...transformed(p, {x: 0, z: 0, rotation}), id: String(i), floorId: 'kit'}));
  const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x));
  const top = Math.min(...points.map(p => p.z)), bottom = Math.max(...points.map(p => p.z));
  return {left, right, top, bottom, width: right - left, depth: bottom - top};
}

// footprint() supplies corners for SAT, not perimeter order. Polygon clipping needs a simple ring.
function pieceShape(piece: KitPiece, position: KitPosition) {
  const corners = footprint({...transformed(piece, position), id: 'fit', floorId: 'fit'});
  return polygonBounds([corners[0], corners[1], corners[3], corners[2]]);
}

/** Full-area coverage catches concave gaps and floor holes even when all four corners are supported. */
export function kitFloorFit(plan: PlanDocumentV1, floorId: string, kit: FurnitureKit, position: KitPosition) {
  const floor = unionShapes(visibleFloorRects(plan, floorId));
  const outside = kit.pieces.flatMap((piece, index) => {
    const area = geometryArea(clipping.difference(shapeOf(pieceShape(piece, position)), floor));
    return area > 1 ? [index] : []; // one square millimetre absorbs clipping roundoff only
  });
  return {fits: outside.length === 0, outside, bounds: kitBounds(kit, position.rotation)};
}

export function initialKitPosition(plan: PlanDocumentV1, floorId: string, kit: FurnitureKit): KitPosition {
  const floor = plan.floors.find(f => f.id === floorId);
  if (!floor) throw new Error('Choose an existing floor first.');
  const rects = floorRects(floor, plan.gridSizeMm);
  if (!rects.length) throw new Error('Draw a floor before previewing a kit.');
  const left = Math.min(...rects.map(r => r.x)), right = Math.max(...rects.map(r => r.x + r.width));
  const top = Math.min(...rects.map(r => r.z)), bottom = Math.max(...rects.map(r => r.z + r.depth));
  const bounds = kitBounds(kit);
  return {x: (left + right - bounds.left - bounds.right) / 2, z: (top + bottom - bounds.top - bounds.bottom) / 2, rotation: 0};
}

export function buildKitPlacement(base: PlanDocumentV1, floorId: string, input: FurnitureKit, position: KitPosition) {
  const kit = parseFurnitureKit(input);
  if (![position.x, position.z, position.rotation].every(v => finite(v))) throw new Error('Enter a valid kit position and rotation.');
  if (!base.floors.some(f => f.id === floorId && f.cells.length)) throw new Error('Draw a floor before previewing a kit.');
  const missing = unavailableKitPieces(kit); if (missing.length) throw new Error(missing.join(' '));
  const added = kit.pieces.map(piece => ({...transformed(piece, position), id: crypto.randomUUID(), floorId}));
  const plan = {...base, furniture: [...base.furniture, ...added]};
  validatePlan(plan);
  if (new TextEncoder().encode(JSON.stringify(plan)).length > MAX_PLAN_BYTES) throw new Error('This arrangement would exceed the project size limit.');
  // Only compare newly proposed pieces against existing pieces: bounded O(kit * scene), not a fresh scene-wide pair scan.
  const warnings = designWarnings({...base, furniture: added}).filter(w => w.kind !== 'floor_edge');
  // Existing stair placements define holes; keep their geometry even though only new pieces are reviewed.
  const fit = kitFloorFit(base, floorId, kit, position);
  for (const index of fit.outside) if (warnings.length < 100) warnings.push({kind: 'floor_edge', ids: [added[index].id], message: `${byId.get(added[index].catalogId)?.name ?? 'A piece'} extends outside the floor shape or across a floor opening. Move, turn or skip this piece before applying.`});
  for (const item of added) for (const other of base.furniture) {
    if (warnings.length >= 100) break;
    if (byId.get(item.catalogId)?.shape === 'rug' || byId.get(other.catalogId)?.shape === 'rug' || restsOnShelf(item, other) || restsOnShelf(other, item)) continue;
    if (overlap(item, other)) warnings.push({kind: 'overlap', ids: [item.id, other.id], message: 'A kit piece overlaps existing furniture. Check the visible fit before applying.'});
  }
  return {plan, addedIds: added.map(p => p.id), warnings};
}

const starterDate = '2026-09-29T00:00:00.000Z';
function starter(id: string, name: string, entries: Array<[string, number, number, number, string, number?]>): FurnitureKit {
  return parseFurnitureKit({version: 1, id, name, createdAt: starterDate, updatedAt: starterDate, pieces: entries.map(([catalogId, x, z, rotation, variant, elevationMm]) => {
    const item = byId.get(catalogId); if (!item) throw new Error(`Starter catalog item missing: ${catalogId}`);
    return {catalogId, x, z, rotation, variant, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, ...(elevationMm === undefined ? {} : {elevationMm})};
  })});
}

/** Original arrangements made entirely from existing independent catalog pieces. */
export const cozyStarterKits: readonly FurnitureKit[] = [
  starter('starter-reading', 'Quiet reading nook', [['armchair',0,0,0,'sage'],['side-table',720,100,0,'oat'],['floor-lamp',-680,-300,0,'cream']]),
  starter('starter-dining', 'Breakfast for two', [['breakfast-nook-table',0,0,0,'oat'],['breakfast-nook-chair',0,760,180,'clay'],['breakfast-nook-chair',0,-760,0,'clay']]),
  starter('starter-office', 'Cozy office', [['compact-computer-desk',0,0,0,'oat'],['office-chair',0,820,180,'slate'],['desktop-monitor',0,-100,0,'charcoal',760],['floor-lamp',-900,0,0,'cream']]),
  starter('starter-first-apartment', 'First apartment', [['loveseat',0,0,0,'sage'],['coffee-table',0,1200,0,'oat'],['floor-lamp',-1150,0,0,'cream'],['breakfast-nook-table',2450,0,0,'oat'],['breakfast-nook-chair',2450,760,180,'clay'],['breakfast-nook-chair',2450,-760,0,'clay']]),
  starter('starter-hobby', 'Hobby corner', [['trestle-desk',0,0,0,'oat'],['dining-chair',0,900,180,'clay'],['desktop-sewing-machine',-200,-70,0,'cream',760],['desk-organizer',470,-170,0,'sage',760],['office-filing-cabinet',1250,0,0,'sage']]),
  starter('starter-guest', 'Guest room', [['single-bed',0,0,0,'slate'],['nightstand',850,-600,0,'oat'],['table-lamp',850,-600,0,'cream',560],['wardrobe',-1800,0,0,'oat']]),
];

/** Editorial guidance stays outside private-kit data; saved snapshots keep their existing schema. */
export const roomRecipeDetails: Readonly<Record<string, {description: string; note: string; supports?: ReadonlyArray<readonly [number, number]>}>> = {
  'starter-reading': {description: 'A comfortable seat, a place for tea and warm reading light.', note: 'Leave space in front of the chair to stretch out.'},
  'starter-dining': {description: 'An everyday table for two with separate, movable chairs.', note: 'Allow more room behind the chairs to pull them out.'},
  'starter-office': {description: 'A compact desk, task chair, screen and a warm corner light.', note: 'Keep the screen with its desk, or adjust its height after placement.', supports: [[2,0]]},
  'starter-first-apartment': {description: 'Living and dining essentials for a small first home.', note: 'Includes seating and dining; add bedroom and kitchen pieces separately.'},
  'starter-hobby': {description: 'A sewing and making desk with a chair, supplies and nearby storage.', note: 'Desktop pieces are independent. Keep their table or provide another support.', supports: [[2,0],[3,0]]},
  'starter-guest': {description: 'A single bed, bedside light and useful wardrobe storage.', note: 'The layout leaves a gap beside the bed; check door and drawer access.', supports: [[2,1]]},
};

export function recipeSelectionNotes(kit: FurnitureKit, indices: readonly number[]): string[] {
  return (roomRecipeDetails[kit.id]?.supports ?? []).filter(([child, owner]) => indices.includes(child) && !indices.includes(owner)).map(([child]) => `${byId.get(kit.pieces[child].catalogId)?.name ?? 'This piece'} keeps its saved height. Include its support or adjust its height after applying.`);
}
