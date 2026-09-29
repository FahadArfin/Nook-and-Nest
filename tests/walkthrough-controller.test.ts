// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createSamplePlan, rectangleCells } from '../src/domain';
import { WalkthroughController } from '../src/scene/WalkthroughController';
import { CameraControls } from '../src/scene/CameraControls';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { bindTouchNavigation } from '../src/touchNavigation';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(f => f()); vi.restoreAllMocks(); });
function fixture() {
  const engine = new NullEngine(), scene = new Scene(engine), canvas = document.createElement('canvas');
  scene.useRightHandedSystem = true;
  document.body.appendChild(canvas);
  const camera = new ArcRotateCamera('camera', 1.2, .45, 19, new Vector3(2.5, .3, 2.5), scene);
  camera.mode = 1; camera.fov = .8;
  vi.spyOn(camera, 'attachControl').mockImplementation(() => {});
  vi.spyOn(camera, 'detachControl').mockImplementation(() => {});
  const plan = createSamplePlan('Listing tour', 'metric');
  plan.gridSizeMm = 1000;
  plan.floors = [{ ...plan.floors[0], id: 'main', elevationMm: 3000, heightMm: 2600, cells: rectangleCells(5, 5), walls: [], openings: [] }];
  plan.furniture = [];
  const controller = new WalkthroughController({ camera, canvas, activePlan: plan, activeFloorId: 'main' });
  cleanups.push(() => { controller.dispose(); scene.dispose(); engine.dispose(); canvas.remove(); });
  return { controller, camera, canvas, plan, engine };
}
const key = (type: string, code: string) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number, id = 1) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: id });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  canvas.dispatchEvent(event);
};

describe('walkthrough camera lifecycle', () => {
  it('moves the actual eye at fixed floor height and exactly restores the editor camera', () => {
    const { controller: c, camera, plan } = fixture(), saved = c.capture(), original = JSON.stringify(plan);
    expect(c.begin()).toBe(true);
    camera.getViewMatrix(true);
    const start = camera.position.clone();
    expect(start.y).toBeCloseTo(4.65);
    c.move('forward', true); c.tick(50); c.move('forward', false);
    camera.getViewMatrix(true);
    expect(Vector3.Distance(start, camera.position)).toBeCloseTo(.075);
    expect(camera.position.y).toBeCloseTo(4.65);
    expect(c.capture().kind).toBe('walkthrough');
    c.end(); expect(c.capture()).toEqual(saved);
    expect(camera.attachControl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(plan)).toEqual(original);
  });
  it('stops held keyboard and touch buttons on blur and removes controls on dispose', () => {
    const { controller: c, canvas } = fixture();
    c.begin(); key('keydown', 'KeyW'); c.tick(50);
    const moving = c.capture();
    c.move('right', true); window.dispatchEvent(new Event('blur')); c.tick(50);
    expect(c.capture()).toEqual(moving);
    key('keydown', 'ArrowUp'); c.tick(50); expect(c.capture()).not.toEqual(moving);
    key('keyup', 'ArrowUp'); const released = c.capture(); c.tick(50); expect(c.capture()).toEqual(released);
    c.dispose(); expect(c.active).toBe(false); expect(canvas.dataset.walkthrough).toBeUndefined();
    const after = c.capture(); key('keydown', 'KeyW'); c.tick(50); expect(c.capture()).toEqual(after);
  });
  it('restores a captured walking shot and rejects stale unsafe or wrong-floor shots without moving', () => {
    const { controller: c } = fixture();
    c.begin(); const saved = c.capture(); c.move('right', true); c.tick(50); c.move('right', false);
    expect(c.restore(saved)).toBe(true); expect(c.capture()).toEqual(saved);
    expect(c.restore({ ...saved, floorId: 'other' })).toBe(false);
    expect(c.restore({ ...saved, target: { x: -100, y: 0, z: -100 } })).toBe(false);
    expect(c.capture()).toEqual(saved);
  });
  it('leaves typing inputs alone while keyboard navigation is enabled', () => {
    const { controller: c } = fixture(); c.begin(); const before = c.capture();
    const input = document.createElement('input'); document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true, cancelable: true })); c.tick(50);
    expect(c.capture()).toEqual(before); input.remove();
  });
  it('looks around with a touch drag without changing eye height and stops looking after release', () => {
    const { controller: c, camera, canvas } = fixture(); c.begin(); const before = c.capture();
    pointer(canvas, 'pointerdown', 100, 100); pointer(canvas, 'pointermove', 140, 160);
    expect(c.capture().alpha).toBeGreaterThan(before.alpha);
    expect(c.capture().beta).toBeLessThan(before.beta);
    camera.getViewMatrix(true); expect(camera.position.y).toBeCloseTo(4.65);
    pointer(canvas, 'pointerup', 140, 160); const released = c.capture();
    pointer(canvas, 'pointermove', 180, 200); expect(c.capture()).toEqual(released);
  });
  it('restores the original editor view after orbit presentation and a nested walk', () => {
    const { camera, canvas, plan, engine } = fixture();
    const controls = new CameraControls({ camera, canvas, activePlan: plan, activeFloorId: 'main', engine: engine as unknown as Engine, rotationGuide: undefined, activeDraft: undefined, selectedId: undefined });
    const original = controls.walkthrough.capture();
    controls.beginListingPresentation();
    expect(camera.mode).toBe(0);
    camera.alpha += .7; camera.radius = 8; camera.mode = 0;
    const orbit = controls.walkthrough.capture();
    expect(controls.walkthrough.begin()).toBe(true);
    controls.walkthrough.move('forward', true); controls.walkthrough.tick(40);
    controls.walkthrough.end(); expect(controls.walkthrough.capture()).toEqual(orbit);
    controls.endListingPresentation(); expect(controls.walkthrough.capture()).toEqual(original);
    expect(controls.listingPresentation).toBeUndefined();
    controls.endListingPresentation(); expect(controls.walkthrough.capture()).toEqual(original);
  });
  it('releases the existing two-finger tracker when a walking touch ends', () => {
    const { controller: c, canvas } = fixture();
    const begin = vi.fn(), end = vi.fn();
    const cleanup = bindTouchNavigation(canvas, { begin, end, move: vi.fn(), cancel: vi.fn() });
    cleanups.push(cleanup); c.begin();
    pointer(canvas, 'pointerdown', 100, 100, 1);
    pointer(canvas, 'pointerdown', 200, 100, 2);
    expect(begin).toHaveBeenCalledTimes(1);
    pointer(canvas, 'pointerup', 100, 100, 1);
    pointer(canvas, 'pointerup', 200, 100, 2);
    expect(end).toHaveBeenCalledTimes(1);
    pointer(canvas, 'pointerdown', 100, 100, 3);
    expect(begin).toHaveBeenCalledTimes(1);
    pointer(canvas, 'pointerup', 100, 100, 3);
  });
});
