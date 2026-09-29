import { floorBoundaryWalls, floorRects, subtractRect, type FloorRect } from './floorGeometry';
import { catalog, isWallOpening } from './catalog';
import { projectPoint } from './polygonGeometry';
import type { PlanDocumentV1 } from './types';
import { windowProblem, windowWallPieces } from './windows';
import { isSpiralStair, spiralStairHole } from './householdArchitecture';

export type WalkDirection = 'forward' | 'backward' | 'left' | 'right' | 'turn-left' | 'turn-right';
export interface CameraShotPose {
  version: 1;
  kind: 'orbit' | 'walkthrough';
  floorId: string;
  target: { x: number; y: number; z: number };
  alpha: number;
  beta: number;
  radius: number;
  mode: 0 | 1;
  fov: number;
}
export interface WalkPosition { x: number; z: number; yaw: number; pitch: number }
interface Segment { a: { x: number; z: number }; b: { x: number; z: number } }
interface FurnitureObstacle { x: number; z: number; halfWidth: number; halfDepth: number; cos: number; sin: number }
export interface WalkBounds {
  floorId: string;
  eyeHeight: number;
  regions: FloorRect[];
  startClear(x: number, z: number): boolean;
  contains(x: number, z: number): boolean;
  furnitureClear(x: number, z: number): boolean;
  colliders(x: number, z: number): Segment[];
}
export const WALK_RADIUS = .18;
const WALL_CLEARANCE = WALK_RADIUS + .05;
const COLLISION_CELL = 1;
const catalogById = new Map(catalog.map(item => [item.id, item]));
const solidShapes = new Set(['seat', 'bed', 'table', 'storage', 'appliance', 'bathroom']);

export function validCameraShot(value: unknown): value is CameraShotPose {
  if (!value || typeof value !== 'object') return false;
  const p = value as CameraShotPose;
  return p.version === 1 && ['orbit', 'walkthrough'].includes(p.kind) &&
    typeof p.floorId === 'string' && !!p.floorId && !!p.target &&
    [p.target.x, p.target.y, p.target.z, p.alpha, p.beta, p.radius, p.fov].every(Number.isFinite) &&
    Math.max(Math.abs(p.target.x), Math.abs(p.target.y), Math.abs(p.target.z)) <= 100000 &&
    p.radius >= .25 && p.radius <= 100000 && p.beta > 0 && p.beta < Math.PI &&
    (p.mode === 0 || p.mode === 1) && p.fov >= .2 && p.fov <= 1.8;
}

function inRegion(x: number, z: number, r: FloorRect): boolean {
  if (x < r.x - .001 || x > r.x + r.width + .001 || z < r.z - .001 || z > r.z + r.depth + .001) return false;
  if (!r.polygon) return true;
  let inside = false;
  for (let i = 0, j = r.polygon.length - 1; i < r.polygon.length; j = i++) {
    const a = r.polygon[i], b = r.polygon[j];
    const q = projectPoint({ x, z }, a, b);
    if (Math.hypot(q.x - x, q.z - z) < .001) return true;
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Cache millimetre floor geometry and metre wall segments once per tour. */
export function createWalkBounds(plan: PlanDocumentV1, floorId: string): WalkBounds | undefined {
  const floor = plan.floors.find(f => f.id === floorId);
  if (!floor?.cells.length) return undefined;
  let regions = floorRects(floor, plan.gridSizeMm);
  // The existing flat tour cannot ascend a spiral or cross its upper shaft.
  // Preserve original staircase tour behavior and explicitly bound the new type.
  for(const stair of plan.furniture.filter(p=>isSpiralStair(p.catalogId)&&p.toFloorId===floorId&&p.floorId!==floorId)){
    regions=regions.flatMap(r=>subtractRect(r,spiralStairHole(stair)).map(part=>({...part,cell:r.cell})));
  }
  const regionsByCell = new Map<string, FloorRect[]>();
  for (const r of regions) {
    const key = `${r.cell.x},${r.cell.z}`;
    regionsByCell.set(key, [...(regionsByCell.get(key) ?? []), r]);
  }
  const wallCells = new Map<string, Segment[]>();
  const furnitureCells = new Map<string, FurnitureObstacle[]>();
  const openings = plan.furniture.filter(p => p.floorId === floorId && isWallOpening(p.catalogId) && !windowProblem(plan, p));
  const spawnObstacles = plan.furniture.filter(p => p.floorId === floorId && p.heightMm > 350 && (p.elevationMm ?? 0) < 1650);
  for (const p of plan.furniture) {
    const item = catalogById.get(p.catalogId);
    // A conservative footprint for large floor-standing solids. Mounted decor,
    // openings, rugs and small accessories must not close otherwise clear paths.
    if (p.floorId !== floorId || !item || item.mount !== 'floor' || (!solidShapes.has(item.shape)&&!isSpiralStair(item.id)) ||
      p.heightMm < 350 || Math.min(p.widthMm, p.depthMm) < 350 || (p.elevationMm ?? 0) > 250) continue;
    const angle = p.rotation * Math.PI / 180;
    const obstacle = { x: p.x / 1000, z: p.z / 1000, halfWidth: p.widthMm / 2000, halfDepth: p.depthMm / 2000, cos: Math.cos(angle), sin: Math.sin(angle) };
    const extentX = Math.abs(obstacle.cos) * obstacle.halfWidth + Math.abs(obstacle.sin) * obstacle.halfDepth + WALK_RADIUS;
    const extentZ = Math.abs(obstacle.sin) * obstacle.halfWidth + Math.abs(obstacle.cos) * obstacle.halfDepth + WALK_RADIUS;
    for (let x = Math.floor((obstacle.x - extentX) / COLLISION_CELL); x <= Math.floor((obstacle.x + extentX) / COLLISION_CELL); x++) {
      for (let z = Math.floor((obstacle.z - extentZ) / COLLISION_CELL); z <= Math.floor((obstacle.z + extentZ) / COLLISION_CELL); z++) {
        const key = `${x},${z}`, entries = furnitureCells.get(key) ?? [];
        entries.push(obstacle); furnitureCells.set(key, entries);
      }
    }
  }
  for (const wall of [...floorBoundaryWalls(floor, plan.gridSizeMm), ...floor.walls]) {
    const ax = wall.ax * plan.gridSizeMm, az = wall.az * plan.gridSizeMm;
    const bx = wall.bx * plan.gridSizeMm, bz = wall.bz * plan.gridSizeMm;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < .01) continue;
    const horizontal = az === bz, diagonal = !horizontal && ax !== bx;
    const point = (along: number) => diagonal
      ? { x: (ax + (bx - ax) * along / length) / 1000, z: (az + (bz - az) * along / length) / 1000 }
      : { x: (horizontal ? along : ax) / 1000, z: (horizontal ? az : along) / 1000 };
    for (const piece of windowWallPieces(wall, plan.gridSizeMm, wall.heightMm ?? floor.heightMm, openings)) {
      // Walk through full-height door apertures; windows and low partitions remain solid.
      if (piece.top <= 100 || piece.bottom >= 1700) continue;
      const segment = { a: point(piece.start), b: point(piece.end) };
      for (let x = Math.floor((Math.min(segment.a.x, segment.b.x) - WALL_CLEARANCE) / COLLISION_CELL); x <= Math.floor((Math.max(segment.a.x, segment.b.x) + WALL_CLEARANCE) / COLLISION_CELL); x++) {
        for (let z = Math.floor((Math.min(segment.a.z, segment.b.z) - WALL_CLEARANCE) / COLLISION_CELL); z <= Math.floor((Math.max(segment.a.z, segment.b.z) + WALL_CLEARANCE) / COLLISION_CELL); z++) {
          const key = `${x},${z}`;
          const entries = wallCells.get(key) ?? [];
          entries.push(segment);
          wallCells.set(key, entries);
        }
      }
    }
  }
  return {
    floorId,
    eyeHeight: floor.elevationMm / 1000 + .05 + Math.min(1.6, Math.max(.5, floor.heightMm / 1000 - .2)),
    regions,
    startClear: (x, z) => spawnObstacles.every(item => {
      const dx = x - item.x / 1000, dz = z - item.z / 1000, angle = item.rotation * Math.PI / 180;
      const localX = dx * Math.cos(angle) - dz * Math.sin(angle), localZ = dx * Math.sin(angle) + dz * Math.cos(angle);
      return Math.abs(localX) > item.widthMm / 2000 + WALL_CLEARANCE || Math.abs(localZ) > item.depthMm / 2000 + WALL_CLEARANCE;
    }),
    contains: (x, z) => {
      const mx = x * 1000, mz = z * 1000, gx = Math.floor(mx / plan.gridSizeMm), gz = Math.floor(mz / plan.gridSizeMm);
      // Check neighbors at tile seams without scanning the whole apartment.
      for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
        if (regionsByCell.get(`${i},${j}`)?.some(r => inRegion(mx, mz, r))) return true;
      }
      return false;
    },
    furnitureClear: (x, z) => (furnitureCells.get(`${Math.floor(x / COLLISION_CELL)},${Math.floor(z / COLLISION_CELL)}`) ?? []).every(item => {
      const dx = x - item.x, dz = z - item.z;
      const localX = dx * item.cos - dz * item.sin, localZ = dx * item.sin + dz * item.cos;
      const gapX = Math.max(0, Math.abs(localX) - item.halfWidth), gapZ = Math.max(0, Math.abs(localZ) - item.halfDepth);
      return Math.hypot(gapX, gapZ) >= WALK_RADIUS;
    }),
    colliders: (x, z) => wallCells.get(`${Math.floor(x / COLLISION_CELL)},${Math.floor(z / COLLISION_CELL)}`) ?? [],
  };
}

export function canWalkAt(bounds: WalkBounds, x: number, z: number): boolean {
  if (![x, z].every(Number.isFinite)) return false;
  if (!bounds.contains(x, z)) return false;
  if (!bounds.furnitureClear(x, z)) return false;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    if (!bounds.contains(x + Math.cos(angle) * WALK_RADIUS, z + Math.sin(angle) * WALK_RADIUS)) return false;
  }
  return bounds.colliders(x, z).every(s => {
    const q = projectPoint({ x, z }, s.a, s.b);
    return Math.hypot(x - q.x, z - q.z) >= WALL_CLEARANCE;
  });
}

export function walkStart(bounds: WalkBounds, preferred?: { x: number; z: number }): { x: number; z: number } | undefined {
  const clear = (x: number, z: number) => canWalkAt(bounds, x, z) && bounds.startClear(x, z);
  const near = (x: number, z: number) => {
    if (clear(x, z)) return { x, z };
    for (const distance of [.55, 1, 1.5]) for (let i = 0; i < 8; i++) {
      const point = { x: x + Math.cos(i * Math.PI / 4) * distance, z: z + Math.sin(i * Math.PI / 4) * distance };
      if (clear(point.x, point.z)) return point;
    }
    return undefined;
  };
  if (preferred) { const point = near(preferred.x, preferred.z); if (point) return point; }
  // Area-weighted center usually begins in the room rather than against its edge.
  let area = 0, x = 0, z = 0;
  for (const r of bounds.regions) { const a = r.width * r.depth; area += a; x += (r.x + r.width / 2) * a; z += (r.z + r.depth / 2) * a; }
  if (area) { const point = near(x / area / 1000, z / area / 1000); if (point) return point; }
  for (const r of bounds.regions) {
    const center = r.polygon
      ? { x: r.polygon.reduce((sum, p) => sum + p.x, 0) / r.polygon.length / 1000, z: r.polygon.reduce((sum, p) => sum + p.z, 0) / r.polygon.length / 1000 }
      : { x: (r.x + r.width / 2) / 1000, z: (r.z + r.depth / 2) / 1000 };
    if (clear(center.x, center.z)) return center;
    if (r.polygon) for (const fx of [.25, .5, .75]) for (const fz of [.25, .5, .75]) {
      const candidate = { x: (r.x + r.width * fx) / 1000, z: (r.z + r.depth * fz) / 1000 };
      if (clear(candidate.x, candidate.z)) return candidate;
    }
  }
  return undefined;
}

export function advanceWalk(position: WalkPosition, bounds: WalkBounds, held: ReadonlySet<WalkDirection>, deltaMs: number): WalkPosition {
  const dt = Math.max(0, Math.min(50, Number.isFinite(deltaMs) ? deltaMs : 0)) / 1000;
  const yaw = position.yaw + ((held.has('turn-right') ? 1 : 0) - (held.has('turn-left') ? 1 : 0)) * dt * 1.5;
  const forward = Number(held.has('forward')) - Number(held.has('backward'));
  const side = Number(held.has('right')) - Number(held.has('left'));
  const scale = dt * 1.5 / Math.max(1, Math.hypot(forward, side));
  const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * side) * scale;
  const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * side) * scale;
  let { x, z } = position;
  // Bounded substeps prevent tunneling and permit sliding along a wall.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .04));
  for (let i = 0; i < steps; i++) {
    if (canWalkAt(bounds, x + dx / steps, z)) x += dx / steps;
    if (canWalkAt(bounds, x, z + dz / steps)) z += dz / steps;
  }
  return { ...position, x, z, yaw };
}
