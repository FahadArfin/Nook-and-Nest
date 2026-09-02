export type Units = "imperial" | "metric";
export type Tool = "select" | "paint" | "erase" | "wall" | "door" | "window" | "stairs";
export type ViewMode = "isometric" | "top" | "dollhouse";
export type Category = "Living" | "Bedroom" | "Dining" | "Office" | "Kitchen" | "Storage" | "Lighting" | "Decor" | "Windows" | "Bathroom";

export interface TileCell { x: number; z: number }
export interface WallSegment { id: string; ax: number; az: number; bx: number; bz: number }
export interface Opening { id: string; kind: "door" | "window"; wallKey: string; offset: number; widthMm: number; finishId?: string }
export interface StairPlacement { id: string; kind: "straight" | "l-shaped"; x: number; z: number; rotation: number; widthMm: number; lengthMm: number; toFloorId?: string }
export interface FurniturePlacement { id: string; catalogId: string; floorId: string; x: number; z: number; rotation: number; widthMm: number; depthMm: number; heightMm: number; variant: string; surfaceVariant?: string; elevationMm?: number }
export interface FloorPlan { id: string; name: string; elevationMm: number; heightMm: number; cells: TileCell[]; walls: WallSegment[]; openings: Opening[]; stairs: StairPlacement[]; floorFinishId?: string; wallFinishId?: string }
export interface PlanDocumentV1 {
  schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string; units: Units; gridSizeMm: number;
  floors: FloorPlan[]; furniture: FurniturePlacement[];
  camera: { mode: ViewMode; ghostBelow: boolean; showGrid: boolean; showClearance: boolean };
}
export interface CatalogItem { id: string; name: string; category: Category; widthMm: number; depthMm: number; heightMm: number; icon: string; description: string; shape: "seat" | "table" | "bed" | "storage" | "lamp" | "plant" | "rug" | "decor" | "window" | "device" | "fan" | "bathroom"; mount?: "floor" | "wall" | "surface" }
