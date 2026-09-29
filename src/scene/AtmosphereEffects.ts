import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { MAX_RAIN_DROPS, type AtmosphereFrame } from '../sceneAtmosphere';

/** Metres, enclosing ALL home floors. Conservative exclusion keeps rain out of rooms. */
export interface AtmosphereBounds { minX: number; maxX: number; minZ: number; maxZ: number; groundY: number; roofY: number }
export interface RainPoint { x: number; y: number; z: number }
const fract = (v: number) => v - Math.floor(v);
const random = (index: number, salt: number) => fract(Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453);
const wrap = (v: number, min: number, max: number) => min + ((v - min) % (max - min) + max - min) % (max - min);
function validBounds(b: AtmosphereBounds) { return Object.values(b).every(Number.isFinite) && b.maxX >= b.minX && b.maxZ >= b.minZ && b.roofY > b.groundY; }
/** Deterministic four-sided rain band. Never creates drops within the home envelope. */
export function exteriorRainPoint(index: number, bounds: AtmosphereBounds): RainPoint {
  const margin = .7, band = 4, x = bounds.minX - band + random(index, 1) * (bounds.maxX - bounds.minX + 2 * band), z = bounds.minZ - band + random(index, 2) * (bounds.maxZ - bounds.minZ + 2 * band);
  const distance = margin + random(index, 3) * (band - margin);
  return { x: index % 4 === 0 ? bounds.minX - distance : index % 4 === 1 ? bounds.maxX + distance : x,
    z: index % 4 === 2 ? bounds.minZ - distance : index % 4 === 3 ? bounds.maxZ + distance : z,
    y: bounds.groundY + random(index, 4) * (bounds.roofY - bounds.groundY + 3) };
}
export function advanceRainPoint(point: RainPoint, index: number, bounds: AtmosphereBounds, seconds: number, windSpeed: number, windDirection: number): void {
  const dt = Math.max(0, Math.min(seconds, .05)), a = windDirection * Math.PI / 180;
  point.x = wrap(point.x + Math.sin(a) * windSpeed * 2 * dt, bounds.minX - 4, bounds.maxX + 4);
  point.z = wrap(point.z - Math.cos(a) * windSpeed * 2 * dt, bounds.minZ - 4, bounds.maxZ + 4);
  point.y = wrap(point.y - 4.5 * dt, bounds.groundY, bounds.roofY + 3);
  // Include a margin wider than each streak so diagonals cannot intrude into the home.
  if (point.x > bounds.minX - .35 && point.x < bounds.maxX + .35 && point.z > bounds.minZ - .35 && point.z < bounds.maxZ + .35) {
    const seed = exteriorRainPoint(index, bounds); point.x = seed.x; point.z = seed.z;
  }
}

/** One reused non-pickable line mesh; participates in the controller's existing render loop. */
export class AtmosphereEffects {
  private observer: Observer<Scene> | null;
  private mesh?: LinesMesh;
  private frame: AtmosphereFrame | null = null;
  private bounds?: AtmosphereBounds;
  private points: RainPoint[] = [];
  private lines: Vector3[][] = [];
  private media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  private visible = typeof document === 'undefined' || !document.hidden;
  private disposed = false;
  private visibility = () => { this.visible = !document.hidden; this.syncEnabled(); this.invalidate(); };
  private motion = () => { this.syncEnabled(); this.invalidate(); };
  constructor(private scene: Scene, private invalidate: () => void = () => {}) {
    this.observer = scene.onBeforeRenderObservable.add(() => this.tick());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
    this.media?.addEventListener('change', this.motion);
  }
  /** Used by SceneController's idle-render gate. No extra RAF, timer or render loop. */
  get needsAnimation() { return !this.disposed && this.visible && !!this.bounds && !!this.mesh && !!this.frame?.rain && !!this.frame.animated && !this.media?.matches; }
  configure(frame: AtmosphereFrame | null, bounds: AtmosphereBounds | undefined) {
    if (this.disposed) return;
    this.frame = frame;
    const next = bounds && validBounds(bounds) ? bounds : undefined;
    const reset = JSON.stringify(next) !== JSON.stringify(this.bounds);
    this.bounds = next ? { ...next } : undefined;
    if (!frame?.rain || !this.bounds) { this.syncEnabled(); this.invalidate(); return; }
    if (!this.mesh || reset) {
      this.points = Array.from({ length: MAX_RAIN_DROPS }, (_, i) => exteriorRainPoint(i, this.bounds!));
      this.lines = this.points.map(p => [new Vector3(p.x, p.y, p.z), new Vector3(p.x, p.y + .2, p.z)]);
      if (!this.mesh) {
        this.mesh = MeshBuilder.CreateLineSystem('atmosphere:rain', { lines: this.lines, updatable: true }, this.scene);
        this.mesh.isPickable = false; this.mesh.receiveShadows = false;
        this.mesh.color = new Color3(.67, .78, .86); this.mesh.alpha = .55;
        this.mesh.alwaysSelectAsActiveMesh = true;
      }
    }
    this.updateLines(); this.syncEnabled(); this.invalidate();
  }
  private syncEnabled() { this.mesh?.setEnabled(this.visible && !!this.frame?.rain && !!this.bounds); }
  private updateLines() {
    if (!this.frame || !this.bounds || !this.mesh) return;
    const count = Math.min(MAX_RAIN_DROPS, Math.ceil(this.frame.rain * MAX_RAIN_DROPS)), angle = this.frame.windDirection * Math.PI / 180;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i], [a, b] = this.lines[i]; a.set(p.x, p.y, p.z);
      if (i >= count) b.copyFrom(a);
      else b.set(p.x - Math.sin(angle) * this.frame.windSpeed * .12, p.y + .25, p.z + Math.cos(angle) * this.frame.windSpeed * .12);
    }
    MeshBuilder.CreateLineSystem('atmosphere:rain', { lines: this.lines, instance: this.mesh }, this.scene);
  }
  private tick() {
    if (!this.needsAnimation || !this.bounds || !this.frame) return;
    const seconds = this.scene.getEngine().getDeltaTime() / 1000;
    for (let i = 0; i < this.points.length; i++) advanceRainPoint(this.points[i], i, this.bounds, seconds, this.frame.windSpeed, this.frame.windDirection);
    this.updateLines();
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.scene.onBeforeRenderObservable.remove(this.observer); this.observer = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
    this.media?.removeEventListener('change', this.motion);
    this.mesh?.dispose(); this.mesh = undefined; this.points = []; this.lines = []; this.frame = null; this.bounds = undefined;
  }
}
