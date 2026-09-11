import type { TileCell, WallSegment } from "../types";
export interface Callbacks {
  onCell(x: number, z: number): void;
  onWallSegment(wall: Omit<WallSegment, "id">): void;
  onTileDraft(cells: TileCell[], present: boolean): void;
  onSelect(id?: string): void;
  onMove(
    id: string,
    xMm: number,
    zMm: number,
    elevationMm?: number,
    rotation?: number,
  ): void;
  onDraftMove(
    xMm: number,
    zMm: number,
    elevationMm?: number,
    rotation?: number,
  ): void;
  onRotate(id: string | undefined, rotation: number): void;
  onWall(id: string): void;
}
