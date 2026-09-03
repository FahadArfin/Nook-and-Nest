import { restsOnShelf } from "./shelfSurfaces";
import { validatePlan, MAX_PLAN_BYTES } from "./planValidation";
import LZString from "lz-string";
import type { FurniturePlacement, PlanDocumentV1, TileCell, Units, WallSegment } from "./types";

export const uid = () => crypto.randomUUID();
export const cellKey = (cell: TileCell) => `${cell.x},${cell.z}`;
export const parseCellKey = (key: string): TileCell => { const [x, z] = key.split(",").map(Number); return { x, z }; };
export function rectangleCells(width: number, depth: number): TileCell[] { const cells: TileCell[] = []; for (let z = 0; z < depth; z += 1) for (let x = 0; x < width; x += 1) cells.push({ x, z }); return cells; }
export function rectangleBetweenCells(start: TileCell, end: TileCell): TileCell[] { const cells: TileCell[] = []; const minX=Math.min(start.x,end.x),maxX=Math.max(start.x,end.x),minZ=Math.min(start.z,end.z),maxZ=Math.max(start.z,end.z); for(let z=minZ;z<=maxZ;z+=1)for(let x=minX;x<=maxX;x+=1)cells.push({x,z}); return cells; }
export function toggleCell(cells: TileCell[], cell: TileCell, present: boolean): TileCell[] { const set = new Set(cells.map(cellKey)); present ? set.add(cellKey(cell)) : set.delete(cellKey(cell)); return [...set].map(parseCellKey); }
export function toggleCells(cells: TileCell[], changes: TileCell[], present: boolean): TileCell[] { const set=new Set(cells.map(cellKey)); for(const cell of changes)present?set.add(cellKey(cell)):set.delete(cellKey(cell)); return [...set].map(parseCellKey); }
export function deriveBoundaryWalls(cells: TileCell[]): WallSegment[] {
  const occupied = new Set(cells.map(cellKey)); const walls: WallSegment[] = [];
  const push = (ax: number, az: number, bx: number, bz: number) => walls.push({ id: `${ax}:${az}:${bx}:${bz}`, ax, az, bx, bz });
  for (const { x, z } of cells) { if (!occupied.has(`${x},${z - 1}`)) push(x, z, x + 1, z); if (!occupied.has(`${x + 1},${z}`)) push(x + 1, z, x + 1, z + 1); if (!occupied.has(`${x},${z + 1}`)) push(x + 1, z + 1, x, z + 1); if (!occupied.has(`${x - 1},${z}`)) push(x, z + 1, x, z); }
  return walls;
}
export function snapMm(valueMm: number, incrementMm: number, free = false) { return free ? Math.round(valueMm) : Math.round(valueMm / incrementMm) * incrementMm; }
export function formatLength(mm: number, units: Units): string { if (units === "metric") return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm / 10)} cm`; const inches = Math.round(mm / 25.4); return `${Math.floor(inches / 12)}′ ${inches % 12}″`; }
export function furnitureOverlaps(items: FurniturePlacement[], item: FurniturePlacement): boolean { return items.some((other) => { if (other.id === item.id || other.floorId !== item.floorId || restsOnShelf(item,other) || restsOnShelf(other,item)) return false; const bottom=item.elevationMm??0,otherBottom=other.elevationMm??0; if(bottom>=otherBottom+other.heightMm-1||otherBottom>=bottom+item.heightMm-1)return false; const aW = item.rotation % 180 === 0 ? item.widthMm : item.depthMm; const aD = item.rotation % 180 === 0 ? item.depthMm : item.widthMm; const bW = other.rotation % 180 === 0 ? other.widthMm : other.depthMm; const bD = other.rotation % 180 === 0 ? other.depthMm : other.widthMm; return Math.abs(item.x - other.x) * 2 < aW + bW && Math.abs(item.z - other.z) * 2 < aD + bD; }); }
export function createSamplePlan(name = "Willow Street Apartment", units: Units = "imperial"): PlanDocumentV1 {
  const now = new Date().toISOString(); const floor1Id = uid(); const floor2Id = uid(); const cells = rectangleCells(14, 10).filter(({ x, z }) => !(x > 10 && z < 3));
  return { schemaVersion: 1, id: uid(), name, createdAt: now, updatedAt: now, units, gridSizeMm: units === "imperial" ? 304.8 : 250,
    floors: [{ id: floor1Id, name: "Ground floor", elevationMm: 0, heightMm: 2438, cells, walls: [], openings: [], stairs: [], floorFinishId: "honey-oak", wallFinishId: "cream-plaster" }, { id: floor2Id, name: "Upstairs", elevationMm: 2738, heightMm: 2438, cells: rectangleCells(9, 7), walls: [], openings: [], stairs: [], floorFinishId: "light-oak", wallFinishId: "sage-plaster" }],
    furniture: [], camera: { mode: "isometric", ghostBelow: true, showGrid: true, showClearance: false } };
}
export function serializePlan(plan: PlanDocumentV1): string { return JSON.stringify(plan, null, 2); }
export function parsePlan(json: string): PlanDocumentV1 { if(new TextEncoder().encode(json).length > MAX_PLAN_BYTES) throw new Error("Project exceeds the 1 MB limit."); const parsed:unknown=JSON.parse(json); validatePlan(parsed); return parsed; }
export function encodeShare(plan: PlanDocumentV1): string { return LZString.compressToEncodedURIComponent(JSON.stringify(plan)); }
export function decodeShare(payload: string): PlanDocumentV1 { const json = LZString.decompressFromEncodedURIComponent(payload); if (!json) throw new Error("The shared project link is incomplete."); const parsed = parsePlan(json); return { ...parsed, id: uid(), name: `${parsed.name} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
export function validateStair(widthMm: number, lengthMm: number, heightMm: number): string[] { const warnings: string[] = []; if (widthMm < 800) warnings.push("Stair width is below 80 cm."); if (lengthMm < heightMm * 1.1) warnings.push("Stair run may be too short for this floor height."); return warnings; }
