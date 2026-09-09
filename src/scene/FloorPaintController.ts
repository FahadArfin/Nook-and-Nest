import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Rendering/outlineRenderer";
import { Scene } from "@babylonjs/core/scene";
import { rectangleBetweenCells } from "../domain";
import { type MeasuredRegion } from "../floorGeometry";
import type { PlanDocumentV1, TileCell, Tool } from "../types";
/** Live dependencies supplied by the scene coordinator; no duplicate saved state. */
export interface FloorPaintControllerHost {
  activePlan: PlanDocumentV1 | undefined;
  pointOnActiveFloor: (
    screenX: number,
    screenY: number,
  ) => { x: number; z: number } | undefined;
  activeFloorId: string;
  tool: Tool;
  scene: Scene;
  root: TransformNode;
  material: (name: string, hex: string, alpha?: number) => StandardMaterial;
  camera: ArcRotateCamera;
  engine: Engine;
  canvas: HTMLCanvasElement;
}
export class FloorPaintController {
  constructor(private host: FloorPaintControllerHost) {}
  tileDragStart?: TileCell;
  tileDragCurrent?: TileCell;
  tileDraftRoot?: TransformNode;
  tileDraftCells: TileCell[] = [];
  tileDraftPresent = true;
  measuredDraft?: MeasuredRegion;
  tileDraftAnchor?: Vector3;
  cellAtPointer(screenX: number, screenY: number) {
    if (!this.host.activePlan) return undefined;
    const point = this.host.pointOnActiveFloor(screenX, screenY);
    if (!point) return undefined;
    const grid = this.host.activePlan.gridSizeMm;
    return { x: Math.floor(point.x / grid), z: Math.floor(point.z / grid) };
  }
  renderTileDraft(start: TileCell, end: TileCell, present: boolean) {
    this.tileDraftRoot?.dispose(false, false);
    this.tileDraftRoot = undefined;
    this.tileDraftCells = [];
    this.tileDraftAnchor = undefined;
    if (!this.host.activePlan) return;
    const floor = this.host.activePlan.floors.find(
      (item) => item.id === this.host.activeFloorId,
    );
    if (!floor) return;
    const occupied = new Set(floor.cells.map((cell) => `${cell.x},${cell.z}`));
    const all = rectangleBetweenCells(start, end);
    this.tileDraftCells = all.filter((cell) =>
      this.host.tool === "floor-finish"
        ? occupied.has(`${cell.x},${cell.z}`)
        : present
          ? !occupied.has(`${cell.x},${cell.z}`) ||
            !!floor.cellRects?.[`${cell.x},${cell.z}`]
          : occupied.has(`${cell.x},${cell.z}`),
    );
    this.tileDraftPresent = present;
    if (!this.tileDraftCells.length) return;
    const scale = this.host.activePlan.gridSizeMm / 1000;
    const root = new TransformNode("tile-draft", this.host.scene);
    root.parent = this.host.root;
    this.tileDraftRoot = root;
    const material = this.host.material(
      "tile-draft-mat",
      present ? "#80bd55" : "#d27b67",
      0.58,
    );
    for (const cell of this.tileDraftCells) {
      const tile = MeshBuilder.CreateBox(
        "tile-draft-preview",
        { width: scale * 0.91, depth: scale * 0.91, height: 0.055 },
        this.host.scene,
      );
      tile.parent = root;
      tile.position = new Vector3(
        (cell.x + 0.5) * scale,
        floor.elevationMm / 1000 + 0.085,
        (cell.z + 0.5) * scale,
      );
      tile.material = material;
      tile.isPickable = false;
      tile.renderOutline = true;
      tile.outlineColor = Color3.FromHexString(present ? "#568d35" : "#a55242");
      tile.outlineWidth = 0.018;
    }
    const xs = this.tileDraftCells.map((cell) => cell.x),
      zs = this.tileDraftCells.map((cell) => cell.z);
    this.tileDraftAnchor = new Vector3(
      ((Math.min(...xs) + Math.max(...xs) + 1) * scale) / 2,
      floor.elevationMm / 1000 + 0.38,
      ((Math.min(...zs) + Math.max(...zs) + 1) * scale) / 2,
    );
  }
  projectTileDraft() {
    if (!this.tileDraftAnchor) return undefined;
    const viewport = this.host.camera.viewport.toGlobal(
      this.host.engine.getRenderWidth(),
      this.host.engine.getRenderHeight(),
    );
    const projected = Vector3.Project(
      this.tileDraftAnchor,
      Matrix.Identity(),
      this.host.scene.getTransformMatrix(),
      viewport,
    );
    return {
      x:
        (projected.x * this.host.canvas.clientWidth) /
        this.host.engine.getRenderWidth(),
      y:
        (projected.y * this.host.canvas.clientHeight) /
        this.host.engine.getRenderHeight(),
    };
  }
  previewMeasuredRoom(region: MeasuredRegion) {
    this.cancelTileDraft();
    this.measuredDraft = region;
    if (!this.host.activePlan) return;
    const floor = this.host.activePlan.floors.find(
      (f) => f.id === this.host.activeFloorId,
    );
    if (!floor) return;
    const root = new TransformNode("measured-room-preview", this.host.scene);
    root.parent = this.host.root;
    this.tileDraftRoot = root;
    const rect = Object.values(region.rects).flat(),
      mat = this.host.material("measured-preview", "#83b863", 0.6);
    for (const r of rect) {
      const mesh = MeshBuilder.CreateBox(
        "measured-tile",
        { width: r.width / 1000, depth: r.depth / 1000, height: 0.025 },
        this.host.scene,
      );
      mesh.parent = root;
      mesh.position = new Vector3(
        (r.x + r.width / 2) / 1000,
        floor.elevationMm / 1000 + 0.06,
        (r.z + r.depth / 2) / 1000,
      );
      mesh.material = mat;
      mesh.isPickable = false;
    }
    this.tileDraftAnchor = new Vector3(
      (region.origin.x * this.host.activePlan.gridSizeMm + region.widthMm / 2) /
        1000,
      floor.elevationMm / 1000 + 0.25,
      (region.origin.z * this.host.activePlan.gridSizeMm + region.depthMm / 2) /
        1000,
    );
  }
  cancelTileDraft() {
    this.measuredDraft = undefined;
    this.tileDraftRoot?.dispose(false, false);
    this.tileDraftRoot = undefined;
    this.tileDraftCells = [];
    this.tileDraftAnchor = undefined;
    this.tileDragStart = undefined;
    this.tileDragCurrent = undefined;
  }
}
