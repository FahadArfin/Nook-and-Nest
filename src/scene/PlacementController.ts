import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Rendering/outlineRenderer";
import { Scene } from "@babylonjs/core/scene";
import {
  catalog,
  isKitchenWall,
  isStairs,
  isSurfaceMounted,
  isWallOpening,
} from "../catalog";
import { isRailing } from "../modularFurniture";
import { outsidePlacementPoint } from "../outdoors";
import { tabletopPoint, type PlacementPoint } from "../tabletop";
import type { FurniturePlacement, PlanDocumentV1 } from "../types";
import {
  getWallVisibility,
  isWallHidden,
  WallVisibilityController,
} from "../wallVisibility";
import { snapWindow, wallRuns } from "../windows";
/** Live dependencies supplied by the scene coordinator; no duplicate saved state. */
export interface PlacementControllerHost {
  activePlan: PlanDocumentV1 | undefined;
  scene: Scene;
  camera: ArcRotateCamera;
  activeFloorId: string;
  dragging: string | undefined;
  draggingDraft: boolean;
  wallVisibility: WallVisibilityController;
  previewNode: TransformNode | undefined;
  activeDraft: FurniturePlacement | undefined;
  draftPosition: PlacementPoint | undefined;
  canvas: HTMLCanvasElement;
  engine: Engine;
  selectedNode: TransformNode | undefined;
  selectedId: string | undefined;
}
export class PlacementController {
  constructor(private host: PlacementControllerHost) {}
  dragGrabOffset?: { x: number; z: number };
  pointOnActiveFloor(screenX: number, screenY: number) {
    if (!this.host.activePlan) return undefined;
    const ray = this.host.scene.createPickingRay(
      screenX,
      screenY,
      Matrix.Identity(),
      this.host.camera,
    );
    const floorY =
      (this.host.activePlan.floors.find(
        (floor) => floor.id === this.host.activeFloorId,
      )?.elevationMm ?? 0) / 1000;
    const distance = (floorY - ray.origin.y) / ray.direction.y;
    if (!Number.isFinite(distance) || distance <= 0) return undefined;
    const point = ray.origin.add(ray.direction.scale(distance));
    return {
      x: Math.round(point.x * 20) * 50,
      z: Math.round(point.z * 20) * 50,
    };
  }
  beginFurnitureDrag(item?: FurniturePlacement) {
    this.dragGrabOffset = undefined;
    if (
      !item ||
      !this.host.activePlan ||
      isRailing(item.catalogId) ||
      isWallOpening(item.catalogId) ||
      isKitchenWall(item.catalogId) ||
      isStairs(item.catalogId)
    )
      return;
    const floor = this.host.activePlan.floors.find(
      (f) => f.id === item.floorId,
    );
    if (!floor) return;
    const ray = this.host.scene.createPickingRay(
      this.host.scene.pointerX,
      this.host.scene.pointerY,
      Matrix.Identity(),
      this.host.camera,
    );
    const distance =
      ((floor.elevationMm + (item.elevationMm ?? 0) + 50) / 1000 -
        ray.origin.y) /
      ray.direction.y;
    if (!Number.isFinite(distance) || distance <= 0) return;
    this.dragGrabOffset = {
      x: item.x / 1000 - ray.origin.x - distance * ray.direction.x,
      z: item.z / 1000 - ray.origin.z - distance * ray.direction.z,
    };
  }
  positionForItem(
    screenX: number,
    screenY: number,
    item?: FurniturePlacement,
  ): PlacementPoint | undefined {
    const ray = this.host.scene.createPickingRay(
      screenX,
      screenY,
      Matrix.Identity(),
      this.host.camera,
    );
    // Shift the placement ray, before support tests, to keep the original grab point.
    if (
      this.dragGrabOffset &&
      (this.host.dragging === item?.id || this.host.draggingDraft)
    ) {
      ray.origin = ray.origin.add(
        new Vector3(this.dragGrabOffset.x, 0, this.dragGrabOffset.z),
      );
    }
    const movable =
      item &&
      !isRailing(item.catalogId) &&
      !isWallOpening(item.catalogId) &&
      !isKitchenWall(item.catalogId) &&
      !isStairs(item.catalogId) &&
      catalog.find((c) => c.id === item.catalogId)?.mount === "floor";
    const floorPoint =
      item &&
      this.host.activePlan &&
      (movable || isSurfaceMounted(item.catalogId))
        ? outsidePlacementPoint(
            this.host.activePlan,
            item,
            ray.origin,
            ray.direction,
          )
        : this.pointOnActiveFloor(screenX, screenY);
    if (item && isSurfaceMounted(item.catalogId) && this.host.activePlan) {
      return (
        tabletopPoint(this.host.activePlan, item, ray.origin, ray.direction) ??
        floorPoint
      );
    }
    if (
      !item ||
      (!isWallOpening(item.catalogId) && !isKitchenWall(item.catalogId)) ||
      !this.host.activePlan
    )
      return floorPoint;
    const floor = this.host.activePlan.floors.find(
      (f) => f.id === item.floorId,
    );
    if (!floor) return floorPoint;
    const hits = wallRuns(
      floor,
      this.host.activePlan.gridSizeMm,
      (wall, boundary) => {
        const s = this.host.activePlan!.gridSizeMm / 1000;
        const geometry = {
          ax: wall.ax * s,
          az: wall.az * s,
          bx: wall.bx * s,
          bz: wall.bz * s,
          boundary,
        };
        return (
          !isWallHidden(
            getWallVisibility(this.host.activePlan!.camera),
            geometry,
            this.host.camera.position,
            this.host.camera.target,
          ) && this.host.wallVisibility.allowsInteraction(geometry)
        );
      },
    )
      .filter(
        (run) =>
          run.end - run.start >=
          item.widthMm + (isKitchenWall(item.catalogId) ? 0 : 40),
      )
      .flatMap((run) => {
        const direction = run.horizontal ? ray.direction.z : ray.direction.x;
        if (Math.abs(direction) < 0.0001) return [];
        const origin = run.horizontal ? ray.origin.z : ray.origin.x;
        const distance = (run.line / 1000 - origin) / direction;
        if (distance <= 0) return [];
        const point = ray.origin.add(ray.direction.scale(distance)),
          along = (run.horizontal ? point.x : point.z) * 1000;
        if (
          along < run.start ||
          along > run.end ||
          point.y * 1000 < floor.elevationMm ||
          point.y * 1000 > floor.elevationMm + floor.heightMm
        )
          return [];
        return [
          {
            x: point.x * 1000,
            z: point.z * 1000,
            y: point.y * 1000,
            distance,
            run,
          },
        ];
      })
      .sort((a, b) => a.distance - b.distance);
    const point = hits[0];
    return point
      ? snapWindow(
          this.host.activePlan,
          {
            ...item,
            x: point.x,
            z: point.z,
            ...(isKitchenWall(item.catalogId)
              ? {
                  elevationMm: Math.max(
                    0,
                    point.y - floor.elevationMm - item.heightMm / 2 - 50,
                  ),
                  rotation: point.run.horizontal
                    ? ray.origin.z * 1000 >= point.run.line
                      ? 0
                      : 180
                    : ray.origin.x * 1000 >= point.run.line
                      ? 90
                      : 270,
                }
              : {}),
          },
          [point.run],
        )
      : undefined;
  }
  applyPreviewPosition(position: PlacementPoint) {
    if (!this.host.previewNode) return;
    const mounted =
      this.host.activePlan && this.host.activeDraft
        ? snapWindow(this.host.activePlan, {
            ...this.host.activeDraft,
            ...position,
          })
        : undefined;
    if (mounted) {
      position = mounted;
      this.host.previewNode.rotation.y = (mounted.rotation * Math.PI) / 180;
    }
    this.host.previewNode.position.x = position.x / 1000;
    this.host.previewNode.position.z = position.z / 1000;
    if (position.elevationMm !== undefined && this.host.activePlan) {
      const floor = this.host.activePlan.floors.find(
        (f) => f.id === this.host.activeFloorId,
      );
      this.host.previewNode.position.y =
        (floor?.elevationMm ?? 0) / 1000 +
        (this.host.activeDraft && isWallOpening(this.host.activeDraft.catalogId)
          ? 0
          : 0.05) +
        position.elevationMm / 1000;
    }
    this.host.draftPosition = position;
  }
  movePreviewFromClient(
    clientX: number,
    clientY: number,
    item?: FurniturePlacement,
  ) {
    const rect = this.host.canvas.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )
      return undefined;
    const position = this.positionForItem(
      clientX - rect.left,
      clientY - rect.top,
      item ?? this.host.activeDraft,
    );
    if (position) this.applyPreviewPosition(position);
    return position;
  }
  projectPreview() {
    if (!this.host.previewNode || !this.host.activeDraft) return undefined;
    const viewport = this.host.camera.viewport.toGlobal(
      this.host.engine.getRenderWidth(),
      this.host.engine.getRenderHeight(),
    );
    const anchor = this.host.previewNode
      .getAbsolutePosition()
      .add(new Vector3(0, this.host.activeDraft.heightMm / 1000 + 0.22, 0));
    const projected = Vector3.Project(
      anchor,
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
  projectSelected() {
    if (
      !this.host.selectedNode ||
      !this.host.activePlan ||
      !this.host.selectedId
    )
      return undefined;
    const item = this.host.activePlan.furniture.find(
      (placement) => placement.id === this.host.selectedId,
    );
    if (!item) return undefined;
    const viewport = this.host.camera.viewport.toGlobal(
      this.host.engine.getRenderWidth(),
      this.host.engine.getRenderHeight(),
    );
    const anchor = this.host.selectedNode
      .getAbsolutePosition()
      .add(new Vector3(0, item.heightMm / 1000 + 0.22, 0));
    const projected = Vector3.Project(
      anchor,
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
}
