import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Camera } from '@babylonjs/core/Cameras/camera';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

// Saved plans use +X right, +Z down the drawing, and +Y above the floor.
// A right-handed view preserves that orientation when viewed from above.
export function configurePlanCoordinates(scene: Scene) {
  scene.useRightHandedSystem = true;
}

export const planViewAngles = (mode: 'top' | 'isometric' | 'dollhouse') => ({
  alpha: Math.PI / 2,
  beta: mode === 'top' ? .001 : mode === 'dollhouse' ? .85 : .6,
});

export function applyPlanView(camera: ArcRotateCamera, mode: 'top' | 'isometric' | 'dollhouse') {
  Object.assign(camera, planViewAngles(mode));
  camera.mode = mode === 'top' ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA;
  camera.inertialAlphaOffset = 0;
  camera.inertialBetaOffset = 0;
}

export function updatePlanProjection(camera: ArcRotateCamera, aspect: number) {
  if (camera.mode !== Camera.ORTHOGRAPHIC_CAMERA) return;
  const halfHeight = camera.radius * Math.tan(camera.fov / 2);
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  camera.orthoLeft = -halfHeight * aspect;
  camera.orthoRight = halfHeight * aspect;
}

// Existing catalog placements were authored against the glTF loader's old
// left-handed root transform. Retain that local geometry without rewriting
// saved positions, rotations, stair paths, or support-surface coordinates.
export function preserveCatalogCoordinates(container: AssetContainer) {
  if (!container.scene.useRightHandedSystem) return;
  for (const root of container.rootNodes) {
    if ('rotationQuaternion' in root && 'scaling' in root) {
      const transform = root as import('@babylonjs/core/Meshes/transformNode').TransformNode;
      transform.rotationQuaternion = new Quaternion(0, 1, 0, 0);
      transform.scaling.set(1, 1, -1);
    }
  }
}
