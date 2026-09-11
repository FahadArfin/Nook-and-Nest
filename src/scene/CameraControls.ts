import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Rendering/outlineRenderer";
import { closeZoomLimit, detailFocusRadius } from "../cameraPolicy";
import { floorRects } from "../floorGeometry";
import { landscapeBounds } from "../outdoors";
import { cameraFacingRotation } from "../placementFacing";
import type { HomeShot } from "../previewShots";
import type { FurniturePlacement, PlanDocumentV1 } from "../types";
import { applyPlanView } from "./planCoordinates";
/** Live dependencies supplied by the scene coordinator; no duplicate saved state. */
export interface CameraControlsHost {
  engine: Engine;
  camera: ArcRotateCamera;
  rotationGuide: TransformNode | undefined;
  canvas: HTMLCanvasElement;
  activePlan: PlanDocumentV1 | undefined;
  activeDraft: FurniturePlacement | undefined;
  selectedId: string | undefined;
}
export class CameraControls {
  constructor(private host: CameraControlsHost) {}
  homePreview?: {
    target: Vector3;
    alpha: number;
    beta: number;
    radius: number;
    mode: number;
  };
  homeOrbit = false;
  focusMotion?: {
    started?: number;
    from?: Vector3;
    target?: Vector3;
    radius?: number;
    toRadius?: number;
  };
  pointerHeld = false;
  cameraPointersSuspended = false;
  beginHomePreview() {
    if (this.homePreview) return;
    this.host.engine.resize();
    this.cancelFocus();
    this.homePreview = {
      target: this.host.camera.target.clone(),
      alpha: this.host.camera.alpha,
      beta: this.host.camera.beta,
      radius: this.host.camera.radius,
      mode: this.host.camera.mode,
    };
    this.host.camera.detachControl();
    this.host.rotationGuide?.setEnabled(false);
  }
  showHomeShot(shot: HomeShot, orbit = false) {
    if (!shot) return;
    this.homeOrbit = orbit;
    this.host.camera.mode = 0;
    this.host.camera.setTarget(new Vector3(shot.x, shot.y, shot.z));
    this.host.camera.alpha = shot.alpha;
    this.host.camera.beta = shot.beta;
    this.host.camera.radius = Math.min(
      this.host.camera.upperRadiusLimit ?? 80,
      shot.radius *
        Math.max(
          1,
          this.host.engine.getRenderHeight() /
            this.host.engine.getRenderWidth(),
        ),
    );
    this.host.camera.inertialAlphaOffset = 0;
    this.host.camera.inertialBetaOffset = 0;
    this.host.camera.inertialRadiusOffset = 0;
    this.host.camera.inertialPanningX = 0;
    this.host.camera.inertialPanningY = 0;
  }
  endHomePreview() {
    const saved = this.homePreview;
    if (!saved) return;
    this.homePreview = undefined;
    this.homeOrbit = false;
    this.host.camera.setTarget(saved.target);
    Object.assign(this.host.camera, {
      alpha: saved.alpha,
      beta: saved.beta,
      radius: saved.radius,
      mode: saved.mode,
    });
    this.host.camera.attachControl(this.host.canvas, true);
    requestAnimationFrame(() => this.host.engine.resize());
  }
  viewSurroundings() {
    if (!this.host.activePlan) return;
    const b = landscapeBounds(this.host.activePlan);
    this.host.camera.setTarget(new Vector3(b.x, 0, b.z));
    this.host.camera.mode = 0;
    this.host.camera.beta = 1.05;
    this.host.camera.alpha = Math.PI / 2;
    this.host.camera.upperRadiusLimit = Math.max(100, b.radius * 2.5);
    this.host.camera.radius =
      this.host.activePlan.environment?.background === "city"
        ? 650
        : Math.max(40, b.radius * 2.2);
    this.host.camera.upperRadiusLimit = Math.max(
      this.host.camera.upperRadiusLimit ?? 100,
      this.host.camera.radius * 2,
    );
    this.host.camera.inertialRadiusOffset = 0;
  }
  zoom(factor: number) {
    this.cancelFocus();
    this.host.camera.radius = Math.max(
      closeZoomLimit,
      Math.min(
        this.host.camera.upperRadiusLimit ?? 80,
        this.host.camera.radius * factor,
      ),
    );
    this.host.camera.inertialRadiusOffset = 0;
  }
  focusFloor(plan: PlanDocumentV1, floorId: string) {
    this.cancelFocus();
    applyPlanView(this.host.camera, plan.camera.mode);
    this.host.camera.inertialAlphaOffset = 0;
    this.host.camera.inertialBetaOffset = 0;
    const floor = plan.floors.find((f) => f.id === floorId);
    if (!floor?.cells.length) return;
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const r of floorRects(floor, plan.gridSizeMm)) {
      left = Math.min(left, r.x);
      right = Math.max(right, r.x + r.width);
      top = Math.min(top, r.z);
      bottom = Math.max(bottom, r.z + r.depth);
    }
    this.host.camera.inertialPanningX = 0;
    this.host.camera.inertialPanningY = 0;
    this.host.camera.inertialRadiusOffset = 0;
    this.host.camera.setTarget(
      new Vector3(
        (left + right) / 2000,
        floor.elevationMm / 1000 + 0.3,
        (top + bottom) / 2000,
      ),
    );
    const radius = Math.max(
      6,
      (Math.max(right - left, bottom - top) / 1000) *
        1.8 *
        Math.max(
          1,
          this.host.engine.getRenderHeight() /
            this.host.engine.getRenderWidth(),
        ),
    );
    this.host.camera.upperRadiusLimit = Math.max(80, radius);
    this.host.camera.radius = radius;
  }
  placementRotation(id: string, x: number, z: number) {
    return cameraFacingRotation(id, this.host.camera.position, {
      x: x / 1000,
      z: z / 1000,
    });
  }
  cancelFocus = () => {
    this.focusMotion = undefined;
  };
  cameraPointerDown = (event: PointerEvent) => {
    this.pointerHeld = true;
    if (event.target === this.host.canvas) this.cancelFocus();
  };
  cameraPointerUp = () => {
    this.pointerHeld = false;
  };
  suspendCameraPointers() {
    if (this.cameraPointersSuspended) return;
    this.host.camera.inputs.attached.pointers?.detachControl();
    this.cameraPointersSuspended = true;
  }
  resumeCameraControls() {
    // attachElement returns early while wheel input is still attached, so restore
    // only the pointer input explicitly after a furniture gesture.
    if (
      this.cameraPointersSuspended &&
      this.host.camera.inputs.attachedToElement
    )
      this.host.camera.inputs.attached.pointers?.attachControl(true);
    this.cameraPointersSuspended = false;
    this.host.camera.attachControl(this.host.canvas, true);
  }
  focusSelected() {
    if (this.host.activeDraft || this.host.selectedId) this.focusMotion = {};
  }

  updateFocus(
    item: FurniturePlacement,
    node: TransformNode,
    blocked: boolean,
    now: number,
  ) {
    if (this.focusMotion && !this.pointerHeld && !blocked) {
      const motion = this.focusMotion;
      if (motion.started === undefined) {
        motion.started = now;
        motion.from = this.host.camera.target.clone();
        motion.target = node.position.add(
          new Vector3(0, item.heightMm / 2000, 0),
        );
        motion.radius = this.host.camera.radius;
        motion.toRadius = Math.min(
          this.host.camera.radius,
          Math.min(
            4,
            detailFocusRadius(item.widthMm, item.depthMm, item.heightMm),
          ) *
            Math.max(
              1,
              Math.min(
                2.5,
                this.host.engine.getRenderHeight() /
                  this.host.engine.getRenderWidth(),
              ),
            ),
        );
        this.host.camera.inertialPanningX = 0;
        this.host.camera.inertialPanningY = 0;
        this.host.camera.inertialRadiusOffset = 0;
      }
      const t = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? 1
          : Math.min(1, (now - motion.started) / 850),
        ease = t * t * (3 - 2 * t);
      this.host.camera.setTarget(
        Vector3.Lerp(motion.from!, motion.target!, ease),
      );
      this.host.camera.radius =
        motion.radius! + (motion.toRadius! - motion.radius!) * ease;
      if (t === 1) this.focusMotion = undefined;
    }
  }
}
