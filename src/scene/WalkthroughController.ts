import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PlanDocumentV1 } from '../types';
import { advanceWalk, canWalkAt, createWalkBounds, validCameraShot, walkStart, type CameraShotPose, type WalkBounds, type WalkDirection, type WalkPosition } from '../walkthrough';

interface WalkthroughHost {
  camera: ArcRotateCamera;
  canvas: HTMLCanvasElement;
  activePlan: PlanDocumentV1 | undefined;
  activeFloorId: string;
}
const keyDirection: Record<string, WalkDirection> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', KeyD: 'right', ArrowLeft: 'turn-left', ArrowRight: 'turn-right',
};
const clearInertia = (camera: ArcRotateCamera) => {
  camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
  camera.inertialPanningX = camera.inertialPanningY = 0;
};

/** A movable, fixed-height eye using the existing scene camera and lighting. */
export class WalkthroughController {
  private saved?: CameraShotPose;
  private bounds?: WalkBounds;
  private position?: WalkPosition;
  private keyboard = new Set<string>();
  private buttons = new Set<WalkDirection>();
  private pointer?: { id: number; x: number; y: number };
  constructor(private host: WalkthroughHost) {}
  get active() { return !!this.saved; }
  get floorId() { return this.bounds?.floorId; }
  capture(): CameraShotPose {
    const c = this.host.camera;
    return { version: 1, kind: this.active ? 'walkthrough' : 'orbit', floorId: this.bounds?.floorId ?? this.host.activeFloorId,
      target: { x: c.target.x, y: c.target.y, z: c.target.z }, alpha: c.alpha, beta: c.beta,
      radius: c.radius, mode: c.mode === 1 ? 1 : 0, fov: c.fov };
  }
  begin(floorId = this.host.activeFloorId): boolean {
    if (this.active) return this.bounds?.floorId === floorId;
    if (!this.host.activePlan || floorId !== this.host.activeFloorId) return false;
    const bounds = createWalkBounds(this.host.activePlan, floorId);
    if (!bounds) return false;
    const start = walkStart(bounds, this.host.camera.target);
    if (!start) return false;
    this.saved = this.capture();
    this.bounds = bounds;
    this.position = { ...start, yaw: this.host.camera.alpha - Math.PI / 2, pitch: -.12 };
    this.host.camera.detachControl();
    clearInertia(this.host.camera);
    this.host.camera.fov = .95;
    const canvas = this.host.canvas;
    if (canvas.tabIndex < 0) canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    canvas.addEventListener('pointerdown', this.down, true);
    canvas.addEventListener('pointermove', this.look, true);
    canvas.addEventListener('lostpointercapture', this.up, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.up, true);
    window.addEventListener('keydown', this.keydown, true);
    window.addEventListener('keyup', this.keyup, true);
    window.addEventListener('blur', this.stop);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.dataset.walkthrough = 'true';
    this.applyEye();
    return true;
  }
  end() {
    if (!this.saved) return;
    const saved = this.saved;
    this.stop();
    this.saved = this.bounds = this.position = undefined;
    const canvas = this.host.canvas;
    canvas.removeEventListener('pointerdown', this.down, true);
    canvas.removeEventListener('pointermove', this.look, true);
    canvas.removeEventListener('lostpointercapture', this.up, true);
    window.removeEventListener('pointerup', this.up, true);
    window.removeEventListener('pointercancel', this.up, true);
    window.removeEventListener('keydown', this.keydown, true);
    window.removeEventListener('keyup', this.keyup, true);
    window.removeEventListener('blur', this.stop);
    document.removeEventListener('visibilitychange', this.visibility);
    delete canvas.dataset.walkthrough;
    delete canvas.dataset.walkthroughPosition;
    delete canvas.dataset.walkthroughHeading;
    this.applyPose(saved);
    this.host.camera.attachControl(canvas, true);
  }
  move(direction: WalkDirection, pressed: boolean) {
    if (!this.active) return;
    if (pressed) this.buttons.add(direction); else this.buttons.delete(direction);
  }
  tick(deltaMs: number) {
    if (!this.position || !this.bounds) return;
    const held = new Set([...this.buttons, ...[...this.keyboard].map(key => keyDirection[key])]);
    this.position = advanceWalk(this.position, this.bounds, held, deltaMs);
    this.applyEye();
  }
  restore(pose: CameraShotPose): boolean {
    if (!validCameraShot(pose) || pose.floorId !== this.host.activeFloorId) return false;
    if (pose.kind === 'walkthrough') {
      const bounds = this.host.activePlan && createWalkBounds(this.host.activePlan, pose.floorId);
      const x = pose.target.x + Math.cos(pose.alpha) * Math.sin(pose.beta) * pose.radius;
      const z = pose.target.z + Math.sin(pose.alpha) * Math.sin(pose.beta) * pose.radius;
      if (!bounds || !canWalkAt(bounds, x, z)) return false;
      if (!this.active && !this.begin(pose.floorId)) return false;
      this.stop();
      this.position = { x, z, yaw: pose.alpha - Math.PI / 2, pitch: Math.max(-1.25, Math.min(1.25, pose.beta - Math.PI / 2)) };
      this.bounds = bounds;
      this.host.camera.fov = pose.fov;
      this.applyEye();
    } else {
      this.end();
      this.applyPose(pose);
    }
    return true;
  }
  dispose() { this.end(); }
  private applyPose(pose: CameraShotPose) {
    const c = this.host.camera;
    c.setTarget(new Vector3(pose.target.x, pose.target.y, pose.target.z));
    Object.assign(c, { alpha: pose.alpha, beta: pose.beta, radius: pose.radius, mode: pose.mode, fov: pose.fov });
    clearInertia(c);
  }
  private applyEye() {
    if (!this.position || !this.bounds) return;
    const p = this.position, radius = .5, cos = Math.cos(p.pitch);
    this.host.camera.setTarget(new Vector3(p.x + Math.sin(p.yaw) * cos * radius, this.bounds.eyeHeight + Math.sin(p.pitch) * radius, p.z - Math.cos(p.yaw) * cos * radius));
    Object.assign(this.host.camera, { alpha: p.yaw + Math.PI / 2, beta: Math.PI / 2 + p.pitch, radius, mode: 0 });
    this.host.canvas.dataset.walkthroughPosition = `${p.x.toFixed(3)},${this.bounds.eyeHeight.toFixed(3)},${p.z.toFixed(3)}`;
    this.host.canvas.dataset.walkthroughHeading = p.yaw.toFixed(3);
  }
  private stop = () => {
    this.keyboard.clear();
    this.buttons.clear();
    if (this.pointer && this.host.canvas.hasPointerCapture?.(this.pointer.id)) this.host.canvas.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
  };
  private visibility = () => { if (document.hidden) this.stop(); };
  private keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!keyDirection[event.code]) return;
    event.preventDefault(); event.stopImmediatePropagation(); this.keyboard.add(event.code);
  };
  private keyup = (event: KeyboardEvent) => {
    if (!keyDirection[event.code]) return;
    this.keyboard.delete(event.code);
    event.preventDefault(); event.stopImmediatePropagation();
  };
  private down = (event: PointerEvent) => {
    if (event.button !== 0 || this.pointer) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.host.canvas.setPointerCapture?.(event.pointerId);
    this.host.canvas.focus({ preventScroll: true });
    event.preventDefault(); event.stopImmediatePropagation();
  };
  private look = (event: PointerEvent) => {
    if (!this.position || this.pointer?.id !== event.pointerId) return;
    this.position.yaw += Math.max(-150, Math.min(150, event.clientX - this.pointer.x)) * .004;
    this.position.pitch = Math.max(-1.25, Math.min(1.25, this.position.pitch - Math.max(-150, Math.min(150, event.clientY - this.pointer.y)) * .004));
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.applyEye();
    event.preventDefault(); event.stopImmediatePropagation();
  };
  private up = (event: PointerEvent) => {
    if (this.pointer?.id !== event.pointerId) return;
    if (this.host.canvas.hasPointerCapture?.(event.pointerId)) this.host.canvas.releasePointerCapture(event.pointerId);
    this.pointer = undefined;
    // The editor's two-finger tracker must receive release events too, or its
    // remembered touch can leak into the next navigation gesture.
    event.preventDefault();
  };
}
