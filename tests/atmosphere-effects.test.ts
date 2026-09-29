// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AtmosphereEffects, advanceRainPoint, exteriorRainPoint } from '../src/scene/AtmosphereEffects';
import { defaultSceneAtmosphere, MAX_RAIN_DROPS, resolveAtmosphere } from '../src/sceneAtmosphere';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const bounds = { minX: -4, maxX: 7, minZ: -2, maxZ: 9, groundY: 0, roofY: 5 };
it('keeps the bounded rain outside the entire home envelope, even under drift and long frame gaps', () => {
  for (let i = 0; i < MAX_RAIN_DROPS; i++) {
    const p = exteriorRainPoint(i, bounds), oldY = p.y;
    advanceRainPoint(p, i, bounds, 20, 1, 135);
    const distance = ((oldY - p.y) + 8) % 8; expect(distance).toBeLessThanOrEqual(.226);
    for (let n = 0; n < 500; n++) {
      advanceRainPoint(p, i, bounds, .05, 1, n % 360);
      expect(p.x < bounds.minX - .35 || p.x > bounds.maxX + .35 || p.z < bounds.minZ - .35 || p.z > bounds.maxZ + .35).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThan(8);
    }
  }
});
it('reuses one non-pickable mesh, pauses hidden/reduced-motion updates and cleans observer/listeners', async () => {
  const handlers = new Set<() => void>(), media = { matches: false, addEventListener: vi.fn((_event: string, fn: () => void) => handlers.add(fn)), removeEventListener: vi.fn((_event: string, fn: () => void) => handlers.delete(fn)) };
  vi.stubGlobal('matchMedia', () => media); let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const engine = new NullEngine(), scene = new Scene(engine), invalidate = vi.fn(), before = scene.onBeforeRenderObservable.observers.length;
  const runtime = new AtmosphereEffects(scene, invalidate), value = defaultSceneAtmosphere(); value.mode = 'mood'; value.mood.rain = .5;
  const frame = resolveAtmosphere(value)!; runtime.configure(frame, bounds); const mesh = scene.getMeshByName('atmosphere:rain')!;
  expect(runtime.needsAnimation).toBe(true); expect(mesh.isPickable).toBe(false); expect(mesh.getTotalVertices()).toBe(MAX_RAIN_DROPS * 2);
  runtime.configure({ ...frame, rain: 1 }, bounds); expect(scene.getMeshByName('atmosphere:rain')).toBe(mesh);
  media.matches = true; handlers.forEach(fn => fn()); expect(runtime.needsAnimation).toBe(false); expect(mesh.isEnabled()).toBe(true);
  media.matches = false; hidden = true; document.dispatchEvent(new Event('visibilitychange')); expect(runtime.needsAnimation).toBe(false); expect(mesh.isEnabled()).toBe(false);
  hidden = false; document.dispatchEvent(new Event('visibilitychange')); expect(runtime.needsAnimation).toBe(true);
  runtime.configure(frame, undefined); expect(runtime.needsAnimation).toBe(false); expect(mesh.isEnabled()).toBe(false);
  runtime.dispose(); runtime.dispose(); expect(scene.getMeshByName('atmosphere:rain')).toBeNull(); expect(handlers.size).toBe(0);
  // Babylon defers removing observer entries until the current notification has finished.
  await new Promise(resolve => setTimeout(resolve, 0)); expect(scene.onBeforeRenderObservable.observers.length).toBe(before);
  scene.dispose(); engine.dispose();
});
