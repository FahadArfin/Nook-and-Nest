import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Rendering/outlineRenderer";
import { Scene } from "@babylonjs/core/scene";
import { catalog } from "../catalog";
import { paintGrassCoverage } from "../grassCoverage";
import { scatterPlants } from "../planting";
import { usePlanner } from "../store";
import type { TerrainStroke } from "../terrain";
import { terrainRay } from "../terrain";
import type { FurniturePlacement, PlanDocumentV1, Tool } from "../types";
import { isVegetation } from "../vegetation";
import { FurnitureFactory } from "./FurnitureFactory";
import { FurnitureModelLibrary } from "./FurnitureModelLibrary";
import { GrassCoverageRenderer } from "./GrassCoverageRenderer";
import { GrassRenderer } from "./GrassRenderer";
import { TerrainScene } from "./TerrainScene";
/** Live dependencies supplied by the scene coordinator; no duplicate saved state. */
export interface LandscapeControllerHost {
  activePlan: PlanDocumentV1 | undefined;
  scene: Scene;
  furnitureModels: FurnitureModelLibrary;
  furnitureFactory: FurnitureFactory;
  shadow: ShadowGenerator;
  camera: ArcRotateCamera;
  engine: Engine;
  canvas: HTMLCanvasElement;
  tool: Tool;
  coverageRenderer: GrassCoverageRenderer | undefined;
  terrain: TerrainScene;
  resumeCameraControls: () => void;
  material: (name: string, hex: string, alpha?: number) => StandardMaterial;
}
export class LandscapeController {
  constructor(private host: LandscapeControllerHost) {}
  plantingPoints?: Array<{ x: number; z: number }>;
  plantingNodes = new Map<
    string,
    { node: TransformNode; born: number; loaded: boolean }
  >();
  plantingItems: FurniturePlacement[] = [];
  plantingAnchor?: Vector3;
  terrainStarted = 0;
  terrainLastPreview = 0;
  terrainBase?: PlanDocumentV1;
  plantingBase?: PlanDocumentV1;
  terrainStroke?: TerrainStroke;
  terrainCue?: Mesh;
  previewGrass?: GrassRenderer;
  clearPlantingPreview() {
    this.previewGrass?.clear();
    for (const p of this.plantingNodes.values()) p.node.dispose(false, false);
    this.plantingNodes.clear();
    this.plantingItems = [];
    this.plantingAnchor = undefined;
  }
  renderPlantingPreview(items: FurniturePlacement[], refresh = false) {
    if (
      items.length &&
      items.every((p) => isVegetation(p.catalogId)) &&
      this.host.activePlan
    ) {
      this.plantingItems = items;
      this.previewGrass ??= new GrassRenderer(
        this.host.scene,
        this.host.furnitureModels,
        this.host.furnitureFactory as any,
        false,
      );
      if (refresh) this.previewGrass.invalidate();
      this.previewGrass.update(
        { ...this.host.activePlan, furniture: items },
        items[0].floorId,
      );
      return;
    }
    this.previewGrass?.clear();
    this.plantingItems = items;
    const ids = new Set(items.map((p) => p.id));
    for (const [id, p] of this.plantingNodes)
      if (!ids.has(id)) {
        p.node.dispose(false, false);
        this.plantingNodes.delete(id);
      }
    for (const item of items) {
      const existing = this.plantingNodes.get(item.id);
      if (existing && (!refresh || existing.loaded)) continue;
      existing?.node.dispose(false, false);
      const node = new TransformNode(
          `garden-preview:${item.id}`,
          this.host.scene,
        ),
        def = catalog.find((c) => c.id === item.catalogId)!;
      const floor = this.host.activePlan?.floors.find(
        (f) => f.id === item.floorId,
      );
      node.position.set(
        item.x / 1000,
        ((floor?.elevationMm ?? 0) + (item.elevationMm ?? 0) + 50) / 1000,
        item.z / 1000,
      );
      node.rotation.y = (item.rotation * Math.PI) / 180;
      const loaded = this.host.furnitureModels.build(
        node,
        def,
        item,
        item.widthMm / 1000,
        item.depthMm / 1000,
        item.heightMm / 1000,
        false,
      );
      if (!loaded)
        this.host.furnitureFactory.build(
          node,
          def,
          item,
          item.widthMm / 1000,
          item.depthMm / 1000,
          item.heightMm / 1000,
          false,
        );
      for (const mesh of node.getChildMeshes()) {
        mesh.isPickable = false;
        this.host.shadow.removeShadowCaster(mesh);
      }
      this.plantingNodes.set(item.id, {
        node,
        born: existing?.born ?? performance.now(),
        loaded,
      });
    }
  }
  projectPlantingDraft() {
    if (!this.plantingAnchor) return;
    const v = this.host.camera.viewport.toGlobal(
        this.host.engine.getRenderWidth(),
        this.host.engine.getRenderHeight(),
      ),
      p = Vector3.Project(
        this.plantingAnchor,
        Matrix.Identity(),
        this.host.scene.getTransformMatrix(),
        v,
      );
    return {
      x: Math.max(
        90,
        Math.min(
          this.host.canvas.clientWidth - 90,
          (p.x * this.host.canvas.clientWidth) /
            this.host.engine.getRenderWidth(),
        ),
      ),
      y: Math.max(
        50,
        Math.min(
          this.host.canvas.clientHeight - 70,
          (p.y * this.host.canvas.clientHeight) /
            this.host.engine.getRenderHeight(),
        ),
      ),
    };
  }
  handlePointer(info: PointerInfo) {
    if (this.host.tool === "planting") {
      const s = usePlanner.getState(),
        ray = this.host.scene.createPickingRay(
          this.host.scene.pointerX,
          this.host.scene.pointerY,
          Matrix.Identity(),
          this.host.camera,
        );
      const hit = terrainRay(s.plan, ray.origin, ray.direction);
      if (
        info.type === PointerEventTypes.POINTERDOWN &&
        info.event.button === 0 &&
        hit &&
        !s.plantingDraft
      ) {
        this.host.canvas.setPointerCapture?.(
          (info.event as PointerEvent).pointerId,
        );
        this.plantingPoints = [];
        this.plantingBase = s.plan;
        this.host.camera.detachControl();
      }
      if (
        this.plantingPoints &&
        hit &&
        (info.type === PointerEventTypes.POINTERMOVE ||
          info.type === PointerEventTypes.POINTERDOWN)
      ) {
        const last = this.plantingPoints.at(-1);
        if (!last || Math.hypot(hit.x - last.x, hit.z - last.z) > 0.2) {
          if (this.plantingPoints.length < 8192)
            this.plantingPoints.push({ x: hit.x, z: hit.z });
          if (
            s.plantingBrush.coverage &&
            s.plantingBrush.catalogId === "grass-clump"
          )
            this.host.coverageRenderer?.update({
              ...s.plan,
              environment: {
                background: "plain",
                grass: "off",
                ...s.plan.environment,
                grassCoverage: paintGrassCoverage(
                  s.plan,
                  this.plantingPoints,
                  s.plantingBrush,
                ),
              },
            });
          else
            this.renderPlantingPreview(
              scatterPlants(
                s.plan,
                this.plantingPoints,
                s.plantingBrush,
              ).filter(
                (p) => !this.host.terrain?.isWet?.(p.x / 1000, p.z / 1000),
              ),
            );
          this.plantingAnchor = new Vector3(hit.x, hit.y + 0.1, hit.z);
        }
      }
      if (
        info.type === PointerEventTypes.POINTERUP &&
        info.event.button === 0 &&
        this.plantingPoints
      ) {
        const points = this.plantingPoints;
        this.plantingPoints = undefined;
        this.host.resumeCameraControls();
        if (s.plan === this.plantingBase) {
          if (
            s.plantingBrush.coverage &&
            s.plantingBrush.catalogId === "grass-clump"
          )
            s.paintCoverage(points);
          else {
            s.previewPlanting(points);
            const draft = usePlanner.getState().plantingDraft;
            if (draft)
              usePlanner.setState({
                plantingDraft: {
                  ...draft,
                  items: draft.items.filter(
                    (p) => !this.host.terrain?.isWet?.(p.x / 1000, p.z / 1000),
                  ),
                },
              });
            usePlanner.getState().confirmPlanting();
          }
          this.clearPlantingPreview();
        } else this.clearPlantingPreview();
      }
      return true;
    }
    if (this.host.tool.startsWith("terrain-")) {
      const ray = this.host.scene.createPickingRay(
        this.host.scene.pointerX,
        this.host.scene.pointerY,
        Matrix.Identity(),
        this.host.camera,
      );
      const hit = this.host.activePlan
        ? terrainRay(this.host.activePlan, ray.origin, ray.direction)
        : undefined;
      const point = hit ? { x: hit.x * 1000, z: hit.z * 1000 } : undefined;
      if (
        info.type === PointerEventTypes.POINTERDOWN &&
        info.event.button === 0 &&
        point
      ) {
        this.host.canvas.setPointerCapture?.(
          (info.event as PointerEvent).pointerId,
        );
        this.terrainBase = usePlanner.getState().plan;
        this.terrainStarted = performance.now();
        const state = usePlanner.getState();
        this.terrainStroke = {
          carve: false,
          kind: this.host.tool.slice(8) as TerrainStroke["kind"],
          radius: state.terrainRadius,
          strength: state.terrainStrength,
          points: [{ x: point.x / 1000, z: point.z / 1000 }],
        };
        this.host.camera.detachControl();
      }
      if (info.type === PointerEventTypes.POINTERMOVE && point) {
        if (!this.terrainCue) {
          this.terrainCue = MeshBuilder.CreateTorus(
            "terrain-brush",
            { diameter: 2, thickness: 0.025, tessellation: 48 },
            this.host.scene,
          );
          this.terrainCue.material = this.host.material(
            "terrain-cue",
            "#e6c46a",
          );
          this.terrainCue.isPickable = false;
        }
        this.terrainCue.scaling.set(
          usePlanner.getState().terrainRadius,
          1,
          usePlanner.getState().terrainRadius,
        );
        this.terrainCue.position.set(
          point.x / 1000,
          (hit?.y ?? 0) + 0.06,
          point.z / 1000,
        );
        const stroke = this.terrainStroke,
          last = stroke?.points.at(-1);
        if (
          stroke &&
          last &&
          stroke.points.length < 64 &&
          Math.hypot(point.x / 1000 - last.x, point.z / 1000 - last.z) > 0.35
        )
          stroke.points.push({ x: point.x / 1000, z: point.z / 1000 });
      }
      if (info.type === PointerEventTypes.POINTERUP && this.terrainStroke) {
        const stroke = this.terrainStroke;
        this.terrainStroke = undefined;
        this.host.resumeCameraControls();
        if (usePlanner.getState().plan === this.terrainBase) {
          usePlanner.getState().addTerrainStroke(stroke);
        } else if (this.host.activePlan)
          this.host.terrain.update(this.host.activePlan);
      }
      return true;
    }

    return false;
  }
}
