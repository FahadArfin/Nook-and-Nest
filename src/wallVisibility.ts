import type { PlanDocumentV1, WallVisibility } from "./types";

export const wallVisibilityModes = ["near-hidden", "all-hidden", "all-visible"] as const;
export const wallVisibilityLabels: Record<WallVisibility, string> = {
  "near-hidden": "Near walls hidden",
  "all-hidden": "All walls hidden",
  "all-visible": "All walls visible",
};
export const wallVisibilityActions: Record<WallVisibility, string> = {
  "near-hidden": "Hide near walls",
  "all-hidden": "Hide all walls",
  "all-visible": "Show all walls",
};

/** Read old saves without mutating them or changing their schema version. */
export function getWallVisibility(camera: PlanDocumentV1["camera"]): WallVisibility {
  return camera.wallVisibility ?? (camera.transparentWalls ? "near-hidden" : "all-visible");
}
export function nextWallVisibility(mode: WallVisibility): WallVisibility {
  return wallVisibilityModes[(wallVisibilityModes.indexOf(mode) + 1) % wallVisibilityModes.length];
}

export interface WallGeometry { ax: number; az: number; bx: number; bz: number; boundary: boolean }
interface Point { x: number; z: number }

/** Coordinates share one unit (the renderer uses metres). Boundary edges have
 * occupied floor on their right, so (dz, -dx) is their outward normal. */
export function isWallHidden(mode: WallVisibility, wall: WallGeometry, camera: Point, target: Point): boolean {
  if (mode === "all-hidden") return true;
  if (mode === "all-visible") return false;
  const vx = camera.x - target.x, vz = camera.z - target.z;
  const distance = Math.hypot(vx, vz);
  if (distance < .001) return false; // Directly overhead has no near side.
  const dx = wall.bx - wall.ax, dz = wall.bz - wall.az, length = Math.hypot(dx, dz);
  if (length < .0001) return false;
  const nx = dz / length, nz = -dx / length;
  const facing = (nx * vx + nz * vz) / distance;
  if (wall.boundary) return facing > .02;
  // Inside-wall endpoints can be drawn in either order. Hide only partitions
  // on the camera side of its target; far-side partitions stay solid.
  const side = (((wall.ax + wall.bx) / 2 - target.x) * nx + ((wall.az + wall.bz) / 2 - target.z) * nz);
  return side * facing > .01;
}

export function openingHostWall(walls: WallGeometry[], position: Point, rotation: number): WallGeometry | undefined {
  const horizontal = Math.abs(Math.cos(rotation * Math.PI / 180)) > .5;
  return walls.find(wall => {
    const wallHorizontal = Math.abs(wall.az - wall.bz) < .001;
    if (horizontal !== wallHorizontal) return false;
    const along = horizontal ? position.x : position.z;
    const start = horizontal ? wall.ax : wall.az, end = horizontal ? wall.bx : wall.bz;
    const distance = Math.abs(horizontal ? position.z - wall.az : position.x - wall.ax);
    return distance < .11 && along >= Math.min(start, end) - .001 && along <= Math.max(start, end) + .001;
  });
}

interface FadeMesh { visibility: number; isPickable: boolean }
interface VisibilityNode { setEnabled(enabled: boolean): void; getChildMeshes?(): FadeMesh[]; visibility?: number; isPickable?: boolean }
const geometryKey = (w: WallGeometry) => `${w.ax},${w.az},${w.bx},${w.bz},${w.boundary}`;
/** Mesh visibility fades without mutating shared materials. Interaction is turned
 * off immediately, and restored only once the returning wall is fully solid. */
export class WallVisibilityController {
  private entries: { node: VisibilityNode; wall: WallGeometry; visible?: boolean; meshes?: {mesh:FadeMesh; opacity:number; pickable:boolean}[] }[] = [];
  private opacity = new Map<string, number>();
  private blocked = new WeakSet<object>();
  clear(preserveFade = false) { this.entries = []; this.blocked = new WeakSet(); if(!preserveFade)this.opacity.clear(); }
  add(node: VisibilityNode, wall: WallGeometry) { this.entries.push({ node, wall }); }
  allowsInteraction(wall:WallGeometry) { return (this.opacity.get(geometryKey(wall)) ?? 1) >= .999; }
  allowsShadow(mesh:object) { return !this.blocked.has(mesh); }
  update(mode: WallVisibility, camera: Point, target: Point, deltaMs = Infinity, reducedMotion = false) {
    const next = new Map<string,number>();
    for (const entry of this.entries) {
      const hidden = isWallHidden(mode, entry.wall, camera, target), key=geometryKey(entry.wall);
      if(!next.has(key)) {
        const goal=hidden?0:1, previous=this.opacity.get(key)??goal;
        const step=reducedMotion||mode!=="near-hidden"?1:Math.max(0,deltaMs)/650;
        next.set(key, previous<goal?Math.min(goal,previous+step):Math.max(goal,previous-step));
      }
      const alpha=next.get(key)!, visible=alpha>0;
      entry.meshes ??= [...(typeof entry.node.visibility==="number"?[entry.node as FadeMesh]:[]),...(entry.node.getChildMeshes?.()??[])].map(mesh=>({mesh,opacity:mesh.visibility,pickable:mesh.isPickable}));
      for(const {mesh,opacity,pickable} of entry.meshes) {
        mesh.visibility=opacity*alpha; mesh.isPickable=pickable&&!hidden&&alpha>=.999;
        if(hidden)this.blocked.add(mesh);else this.blocked.delete(mesh);
      }
      if (entry.visible !== visible) { entry.node.setEnabled(visible); entry.visible = visible; }
    }
    this.opacity=next;
  }
}
