import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { applyAtmosphereFixtureLights, applyAtmosphereLighting } from '../src/scene/AtmosphereLighting';
import { defaultSceneAtmosphere, resolveAtmosphere } from '../src/sceneAtmosphere';
it('uses the existing lights, turns below-horizon sun off, applies per-lamp choices and restores legacy fixture state', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const sun = new DirectionalLight('sun', new Vector3(0, -1, 0), scene); new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  const fixture = new SpotLight('fixture:lamp-1', Vector3.Zero(), new Vector3(0, -1, 0), 1, 1, scene);
  const value = defaultSceneAtmosphere(); value.mode = 'mood'; value.mood.elevation = -10; value.mood.fixtureOverrides = { 'lamp-1': { enabled: false, brightness: 2, kelvin: 6500 } };
  const frame = resolveAtmosphere(value)!; applyAtmosphereLighting(scene, frame, Vector3.Zero()); applyAtmosphereFixtureLights(scene, frame, 1.1);
  expect(scene.lights).toHaveLength(3); expect(sun.intensity).toBe(0); expect(fixture.intensity).toBe(0); expect(fixture.diffuse.b).toBe(1);
  applyAtmosphereFixtureLights(scene, null, .65); expect(fixture.intensity).toBe(.65); expect(fixture.diffuse.b).toBe(.52);
  scene.dispose(); engine.dispose();
});
