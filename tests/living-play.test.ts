import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { livingAnimationTime, livingMotion, resetLivingMotion, setLivingMotion } from '../src/livingPlay';
import { LivingPlayController } from '../src/scene/LivingPlayController';
import { LivingModels } from '../src/scene/LivingModels';
import type { FurniturePlacement } from '../src/types';
let engine: NullEngine | undefined;
afterEach(() => engine?.dispose());
const setup = () => { engine = new NullEngine(); return new Scene(engine); };
const item = (catalogId: string): FurniturePlacement => ({ id: 'piece', catalogId, floorId: 'floor', x: 2000, z: 1000, rotation: 0, widthMm: 1000, depthMm: 200, heightMm: 2100, variant: 'sage', openFraction: .25 });

describe('transient authored living interactions', () => {
  it('freezes pause/off without jumps, bounds frame delta and uses still reduced-motion poses', () => {
    const root = {};
    expect(livingAnimationTime(root, 10)).toBe(10);
    setLivingMotion(root, 'paused'); expect(livingAnimationTime(root, 10.02)).toBeUndefined(); expect(livingAnimationTime(root, 100)).toBeUndefined();
    setLivingMotion(root, 'playing'); expect(livingAnimationTime(root, 100.02)).toBeCloseTo(10.02); expect(livingAnimationTime(root, 110)).toBeCloseTo(10.07);
    expect(livingAnimationTime(root, 111, true)).toBe(0); setLivingMotion(root, 'off'); expect(livingAnimationTime(root, 112, true)).toBeUndefined();
    resetLivingMotion(root); expect(livingMotion(root)).toBe('playing');
  });
  it('detects real sliding roles, restores exact saved leaf coordinates, and never edits the placement', () => {
    const scene = setup(), root = new TransformNode('door', scene), leaf = new TransformNode('authored leaf', scene), saved = item('door-closet-sliding'); leaf.parent = root; leaf.position.set(.32, .12, -.05); leaf.metadata = { gltf: { extras: { motion_role: 'sliding_leaf', slide_travel: .5 } } };
    const original = structuredClone(saved), controller = new LivingPlayController(), changes: number[] = []; const unsubscribe = controller.subscribe(() => changes.push(controller.getSnapshot().length)); const release = controller.register(root, saved);
    expect(controller.getSnapshot()[0]).toMatchObject({ canSlide: true, canAnimate: false, fraction: .25 });
    controller.command(saved.id, { type: 'slide', fraction: 1 }); expect(leaf.position.x).toBeCloseTo(.695); expect(leaf.position.y).toBe(.12);
    expect(() => controller.command(saved.id, { type: 'slide', fraction: 1.2 })).toThrow(); expect(() => controller.command(saved.id, { type: 'motion', mode: 'playing' })).toThrow();
    controller.resetAll(); expect(leaf.position.asArray()).toEqual([.32, .12, -.05]); expect(saved).toEqual(original);
    controller.command(saved.id, { type: 'slide', fraction: 0 }); release(); expect(leaf.position.asArray()).toEqual([.32, .12, -.05]); expect(controller.getSnapshot()).toHaveLength(0); expect(changes.length).toBeGreaterThan(2); unsubscribe(); controller.dispose();
  });
  it('hides only authored fire meshes, preserves saved visibility, and omits fans without moving parts', () => {
    const scene = setup(), root = new TransformNode('fire', scene), flame = MeshBuilder.CreateBox('flame', {}, scene), stone = MeshBuilder.CreateBox('stone', {}, scene); flame.parent = stone.parent = root; flame.metadata = { livingMaterial: 'golden-flame' };
    const controller = new LivingPlayController(); controller.register(root, item('cottage-fireplace'));
    controller.command('piece', { type: 'motion', mode: 'off' }); expect(flame.isEnabled(false)).toBe(false); expect(stone.isEnabled(false)).toBe(true);
    controller.command('piece', { type: 'motion', mode: 'paused' }); expect(flame.isEnabled(false)).toBe(true); expect(livingMotion(root)).toBe('paused');
    const unsupported = new TransformNode('fan', scene); controller.register(unsupported, { ...item('pedestal-fan'), id: 'fan' }); expect(controller.getSnapshot().some(e => e.id === 'fan')).toBe(false);
    controller.dispose(); expect(flame.isEnabled(false)).toBe(true); expect(livingMotion(root)).toBe('playing');
  });
  it('does not tick authored parts outside the camera frustum or beyond the distance bound', () => {
    const scene = setup(), camera = new FreeCamera('view', new Vector3(0, 1, -5), scene); camera.setTarget(Vector3.Zero()); scene.activeCamera = camera;
    const root = new TransformNode('globe', scene), globe = MeshBuilder.CreateSphere('earth', { diameter: 1 }, scene); globe.parent = root; globe.metadata = { motion_role: 'globe' };
    const living = new LivingModels(scene); living.attach(root, 'library-rotating-globe', 1, 1, 1); root.computeWorldMatrix(true); globe.computeWorldMatrix(true);
    living.tick(0); living.tick(.04); const visible = globe.rotationQuaternion!.clone();
    root.position.x = 20; root.computeWorldMatrix(true); globe.computeWorldMatrix(true); living.tick(1); expect(globe.rotationQuaternion!.equals(visible)).toBe(true);
    root.position.x = 100; root.computeWorldMatrix(true); globe.computeWorldMatrix(true); living.tick(2); expect(globe.rotationQuaternion!.equals(visible)).toBe(true);
    root.position.x = 0; root.computeWorldMatrix(true); globe.computeWorldMatrix(true); living.tick(3); expect(globe.rotationQuaternion!.equals(visible)).toBe(false);
    root.dispose(); living.tick(4); living.dispose();
  });
});
