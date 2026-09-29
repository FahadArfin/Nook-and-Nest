import { describe, expect, it } from 'vitest';
import { createSamplePlan, rectangleCells } from '../src/domain';
import { advanceWalk, canWalkAt, createWalkBounds, validCameraShot, walkStart, type WalkDirection, type WalkPosition } from '../src/walkthrough';
import type { FurniturePlacement } from '../src/types';

const plan = () => {
  const p = createSamplePlan('Listing tour', 'metric');
  p.gridSizeMm = 1000;
  p.floors = [{ ...p.floors[0], id: 'main', elevationMm: 3000, heightMm: 2600, cells: rectangleCells(5, 5), walls: [], openings: [] }];
  p.furniture = [];
  return p;
};
const door = (): FurniturePlacement => ({ id: 'door', catalogId: 'door-flush', floorId: 'main', x: 2500, z: 2500, rotation: 90, widthMm: 1000, heightMm: 2100, depthMm: 100, variant: 'cream', elevationMm: 0 });
const direction = (...v: WalkDirection[]) => new Set(v);
const at = (x: number, z: number, yaw = 0): WalkPosition => ({ x, z, yaw, pitch: 0 });

describe('walkthrough movement and architectural bounds', () => {
  it('uses floor elevation, avoids outer walls, and never changes the source plan', () => {
    const p = plan(), before = JSON.stringify(p), b = createWalkBounds(p, 'main')!;
    expect(b.eyeHeight).toBeCloseTo(4.65);
    expect(walkStart(b)).toEqual({ x: 2.5, z: 2.5 });
    expect(canWalkAt(b, 0.1, 2)).toBe(false);
    expect(canWalkAt(b, 2, 2)).toBe(true);
    expect(canWalkAt(b, 5.1, 2)).toBe(false);
    expect(createWalkBounds(p, 'missing')).toBeUndefined();
    expect(JSON.stringify(p)).toBe(before);
  });
  it('keeps diagonal speed constant and clamps a resumed frame to 50 ms', () => {
    const b = createWalkBounds(plan(), 'main')!, start = at(2, 2);
    const direct = advanceWalk(start, b, direction('forward'), 50), diagonal = advanceWalk(start, b, direction('forward', 'right'), 50);
    expect(Math.hypot(diagonal.x - start.x, diagonal.z - start.z)).toBeCloseTo(Math.hypot(direct.x - start.x, direct.z - start.z));
    expect(advanceWalk(start, b, direction('forward'), 10000)).toEqual(direct);
    expect(advanceWalk(start, b, direction('forward'), -20)).toEqual(start);
    expect(advanceWalk(start, b, direction('forward', 'backward'), 50)).toEqual(start);
  });
  it('slides along solid walls and permits a correctly aligned door passage', () => {
    const p = plan();
    p.floors[0].walls = [{ id: 'partition', ax: 2.5, az: 0, bx: 2.5, bz: 5 }];
    let b = createWalkBounds(p, 'main')!, pos = at(2.2, 1, Math.PI / 2);
    for (let i = 0; i < 30; i++) pos = advanceWalk(pos, b, direction('forward'), 50);
    expect(pos.x).toBeLessThan(2.28);
    const slid = advanceWalk(pos, b, direction('forward', 'right'), 50);
    expect(slid.z).toBeGreaterThan(pos.z);
    p.furniture = [door()]; b = createWalkBounds(p, 'main')!;
    expect(canWalkAt(b, 2.5, 2.5)).toBe(true);
    pos = at(2, 2.5, Math.PI / 2);
    for (let i = 0; i < 20; i++) pos = advanceWalk(pos, b, direction('forward'), 50);
    expect(pos.x).toBeGreaterThan(3);
    expect(canWalkAt(b, 2.5, 1)).toBe(false);
    p.furniture = [{ ...door(), catalogId: 'window-casement', elevationMm: 850, heightMm: 1200 }];
    expect(canWalkAt(createWalkBounds(p, 'main')!, 2.5, 2.5)).toBe(false);
  });
  it('does not bridge missing floor tiles or the bounding box of an angled floor', () => {
    const p = plan(); p.floors[0].cells = p.floors[0].cells.filter(c => !(c.x === 2 && c.z === 2));
    expect(canWalkAt(createWalkBounds(p, 'main')!, 2.5, 2.5)).toBe(false);
    p.gridSizeMm = 5000; p.floors[0].cells = [{ x: 0, z: 0 }];
    p.floors[0].cellRects = { '0,0': [{ x: 0, z: 0, width: 5000, depth: 5000, polygon: [{ x: 0, z: 0 }, { x: 5000, z: 0 }, { x: 0, z: 5000 }] }] };
    const b = createWalkBounds(p, 'main')!;
    expect(canWalkAt(b, 1, 1)).toBe(true);
    expect(canWalkAt(b, 4, 4)).toBe(false);
    expect(canWalkAt(b, 2.5, 2.5)).toBe(false);
    const start = walkStart(b)!; expect(canWalkAt(b, start.x, start.z)).toBe(true);
    expect(walkStart(b, { x: 1, z: 1 })).toEqual({ x: 1, z: 1 });
  });
  it('rejects malformed camera poses before restoration', () => {
    const valid = { version: 1, kind: 'orbit', floorId: 'main', target: { x: 2, y: 0, z: 2 }, alpha: 1, beta: .6, radius: 8, mode: 0, fov: .8 };
    expect(validCameraShot(valid)).toBe(true);
    expect(validCameraShot({ ...valid, radius: NaN })).toBe(false);
    expect(validCameraShot({ ...valid, target: { x: Infinity, y: 0, z: 0 } })).toBe(false);
    expect(validCameraShot({ ...valid, kind: 'untrusted' })).toBe(false);
    expect(validCameraShot({ ...valid, beta: Math.PI })).toBe(false);
    expect(validCameraShot({ ...valid, fov: 5 })).toBe(false);
  });
  it('starts beside a doorway or furnishing instead of inside its rendered model', () => {
    const p = plan(); p.furniture = [door()];
    const bounds = createWalkBounds(p, 'main')!, start = walkStart(bounds, { x: 2.5, z: 2.5 })!;
    expect(start).not.toEqual({ x: 2.5, z: 2.5 });
    expect(bounds.startClear(start.x, start.z)).toBe(true);
    expect(canWalkAt(bounds, start.x, start.z)).toBe(true);
    // The spawn exclusion does not obstruct crossing a door during the tour.
    expect(canWalkAt(bounds, 2.5, 2.5)).toBe(true);
  });
  it('stops at large furniture footprints, including rotated furniture, without tunneling', () => {
    const p = plan();
    p.furniture = [{ ...door(), catalogId: 'sofa', x: 2500, z: 2500, rotation: 0, widthMm: 2000, depthMm: 800, heightMm: 850 }];
    let bounds = createWalkBounds(p, 'main')!, pos = at(2.5, 4);
    for (let i = 0; i < 100; i++) pos = advanceWalk(pos, bounds, direction('forward'), 200);
    expect(pos.z).toBeGreaterThanOrEqual(3.08);
    expect(pos.z).toBeLessThan(3.16);
    expect(canWalkAt(bounds, 2.5, 2.5)).toBe(false);
    expect(canWalkAt(bounds, 3.5, 3.1)).toBe(true);
    p.furniture[0].rotation = 90; bounds = createWalkBounds(p, 'main')!;
    expect(canWalkAt(bounds, 2.5, 3.4)).toBe(false);
    expect(canWalkAt(bounds, 3.4, 2.5)).toBe(true);
    p.furniture[0].rotation = 45; bounds = createWalkBounds(p, 'main')!;
    expect(canWalkAt(bounds, 3.05, 1.95)).toBe(false);
    expect(canWalkAt(bounds, 3.2, 3.2)).toBe(true);
  });
  it('leaves doorways, rugs, small plants and mounted items traversable and ignores other floors', () => {
    for (const catalogId of ['door-flush', 'window-casement', 'round-rug', 'small-plant', 'wall-cabinet']) {
      const p = plan(); p.furniture = [{ ...door(), catalogId }];
      expect(canWalkAt(createWalkBounds(p, 'main')!, 2.5, 2.5), catalogId).toBe(true);
    }
    const p = plan(); p.furniture = [{ ...door(), catalogId: 'sofa', elevationMm: 2200 }];
    expect(canWalkAt(createWalkBounds(p, 'main')!, 2.5, 2.5)).toBe(true);
    p.furniture[0].floorId = 'upstairs'; p.furniture[0].elevationMm = 0;
    expect(canWalkAt(createWalkBounds(p, 'main')!, 2.5, 2.5)).toBe(true);
  });
});
