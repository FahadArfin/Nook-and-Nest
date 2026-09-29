import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { Scene } from '@babylonjs/core/scene';
import { lampColor, type AtmosphereFrame, type RGB } from '../sceneAtmosphere';
const color = (v: RGB) => new Color3(v.r, v.g, v.b);

/** Apply after existing updateLighting, when a resolved atmosphere is active.
 * Existing lighting remains responsible for the off/neutral-preview state.
 * center is the home focus in world metres. No new lights or shadow maps.
 */
export function applyAtmosphereLighting(scene: Scene, frame: AtmosphereFrame, center: Vector3): void {
  const sun = scene.getLightByName('sun'), sky = scene.getLightByName('sky');
  if (sun instanceof DirectionalLight) {
    sun.direction.set(frame.direction.x, frame.direction.y, frame.direction.z);
    sun.position.copyFrom(center).subtractInPlace(sun.direction.scale(60));
    sun.intensity = frame.sunIntensity; sun.diffuse.copyFrom(color(frame.sunColor));
  }
  if (sky instanceof HemisphericLight) {
    sky.intensity = frame.skyIntensity; sky.diffuse.copyFrom(color(frame.skyColor)); sky.groundColor.copyFrom(color(frame.groundColor));
  }
  scene.imageProcessingConfiguration.exposure = 1; scene.imageProcessingConfiguration.contrast = 1;
  for (const mesh of scene.meshes) if (mesh.name.startsWith('sun-ceiling:')) mesh.setEnabled(true);
}

/** Call AFTER FurnitureLights.update in the existing before-render observer.
 * baseIntensity is the existing legacy expression (night 2.1 / neutral .65 / day 1.1).
 * Passing null restores both legacy color and intensity immediately, including when
 * FurnitureLights skips its own update during its 150ms throttle window.
 */
export function applyAtmosphereFixtureLights(scene: Scene, frame: AtmosphereFrame | null, baseIntensity: number): void {
  for (const light of scene.lights) {
    if (!light.name.startsWith('fixture:')) continue;
    const override = frame?.fixtureOverrides[light.name.slice('fixture:'.length)];
    light.intensity = frame ? override ? (override.enabled ? override.brightness : 0) : frame.lampIntensity : baseIntensity;
    light.diffuse.copyFrom(override ? color(lampColor(override.kelvin)) : frame ? color(frame.lampColor) : new Color3(1, .78, .52));
  }
}
