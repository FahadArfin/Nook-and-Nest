import type { FloorRect } from "./floorGeometry";
export type Units = "imperial" | "metric";
export type Tool = "select" | "terrain-raise" | "terrain-lower" | "terrain-river" | "measured-room" | "floor-finish" | "wall-finish" | "paint" | "erase" | "wall" | "door" | "window" | "stairs";
export type ViewMode = "isometric" | "top" | "dollhouse";
export type WallVisibility = "near-hidden" | "all-hidden" | "all-visible";
export type Category = "Outdoor" | "Living" | "Bedroom" | "Dining" | "Office" | "Kitchen" | "Storage" | "Lighting" | "Decor" | "Windows" | "Bathroom" | "Doors" | "Stairs";

export interface TileCell { x: number; z: number }
export interface WallSegment { id: string; ax: number; az: number; bx: number; bz: number }
export interface Opening { id: string; kind: "door" | "window"; wallKey: string; offset: number; widthMm: number; finishId?: string }
export interface StairPlacement { id: string; kind: "straight" | "l-shaped"; x: number; z: number; rotation: number; widthMm: number; lengthMm: number; toFloorId?: string }
export interface FurniturePlacement { id: string; catalogId: string; floorId: string; x: number; z: number; rotation: number; widthMm: number; depthMm: number; heightMm: number; variant: string; toFloorId?: string; stairRiseMm?: number; surfaceVariant?: string; materialColors?: Record<string,string>; elevationMm?: number }
export interface FloorPlan { id: string; name: string; elevationMm: number; heightMm: number; cells: TileCell[]; walls: WallSegment[]; openings: Opening[]; stairs: StairPlacement[]; floorFinishId?: string; wallFinishId?: string; cellRects?:Record<string,FloorRect[]>; cellFinishes?: Record<string,string>; wallFinishes?: Record<string,string> }
export interface PlanDocumentV1 {
  schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string; units: Units; gridSizeMm: number;
  floors: FloorPlan[]; furniture: FurniturePlacement[];
  environment?: { background: "plain"|"city"|"suburban"|"rural"|"farm"|"medieval"; grass:"off"|"sparse"|"lush"; terrain?:import('./terrain').TerrainStroke[] };
  camera: { mode: ViewMode; ghostBelow: boolean; showGrid: boolean; showClearance: boolean; wallVisibility?: WallVisibility; transparentWalls?: boolean; darkMode?: boolean };
}
export interface CatalogItem { id: string; name: string; category: Category; widthMm: number; depthMm: number; heightMm: number; icon: string; description: string; shape: "seat" | "table" | "bed" | "storage" | "lamp" | "plant" | "rug" | "decor" | "window" | "device" | "fan" | "bathroom" | "door" | "stairs" | "appliance" | "backsplash"; mount?: "floor" | "wall" | "surface" | "ceiling" }
