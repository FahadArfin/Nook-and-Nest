import { AbstractMesh, AssetContainer, Color3, Material, MultiMaterial, PBRMaterial, Scene, ShadowGenerator, TransformNode, Vector3 } from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { catalog, variants } from "../catalog";
import type { CatalogItem, FurniturePlacement } from "../types";

const MODEL_IDS = new Set(catalog.map((item) => item.id));

export class FurnitureModelLibrary {
  private containers = new Map<string, AssetContainer>();
  private pending = new Map<string, Promise<void>>();
  private materialVariants = new Map<string, Material>();

  constructor(private scene: Scene, private shadow: ShadowGenerator, private onReady: () => void) {}

  hasModel(catalogId: string) { return MODEL_IDS.has(catalogId); }

  private ensure(catalogId: string) {
    if (!this.hasModel(catalogId) || this.containers.has(catalogId) || this.pending.has(catalogId)) return;
    const request = LoadAssetContainerAsync(`/models/furniture/${catalogId}.glb`, this.scene)
      .then((container) => { this.containers.set(catalogId, container); })
      .catch((error) => { console.warn(`Could not load Blender furniture model ${catalogId}; using procedural fallback.`, error); })
      .finally(() => {
        this.pending.delete(catalogId);
        // A plan may request many models at once. Wait for the current batch so
        // the scene is rebuilt once, after every requested GLB has settled.
        if (this.pending.size === 0) this.onReady();
      });
    this.pending.set(catalogId, request);
  }

  private materialFor(source: Material, item: FurniturePlacement, ghost: boolean) {
    if (source instanceof MultiMaterial) {
      const key = `${source.uniqueId}:${item.variant}:${ghost ? "ghost" : "solid"}`;
      const cached = this.materialVariants.get(key);
      if (cached) return cached;
      const clone = source.clone(`model-${key}`);
      if (!clone) return source;
      clone.subMaterials = source.subMaterials.map((material) => material ? this.materialFor(material, item, ghost) : null);
      this.materialVariants.set(key, clone);
      return clone;
    }
    const isUpholstery = source.name.includes("upholstery-textured");
    if (!isUpholstery && !ghost) return source;
    const key = `${source.uniqueId}:${isUpholstery ? item.variant : "base"}:${ghost ? "ghost" : "solid"}`;
    const cached = this.materialVariants.get(key);
    if (cached) return cached;
    const clone = source.clone(`model-${key}`);
    if (!clone) return source;
    if (clone instanceof PBRMaterial) {
      if (isUpholstery) {
        const tint = variants[item.variant as keyof typeof variants] ?? variants.sage;
        clone.albedoColor = Color3.Lerp(Color3.White(), Color3.FromHexString(tint), .42);
      }
      if (ghost) {
        clone.alpha = .2;
        clone.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      }
    } else if (ghost) clone.alpha = .2;
    this.materialVariants.set(key, clone);
    return clone;
  }

  build(parent: TransformNode, definition: CatalogItem, item: FurniturePlacement, width: number, depth: number, height: number, ghost: boolean) {
    if (!this.hasModel(definition.id)) return false;
    const container = this.containers.get(definition.id);
    if (!container) { this.ensure(definition.id); return false; }

    const wrapper = new TransformNode(`blender-model:${item.id}`, this.scene);
    wrapper.parent = parent;
    const instance = container.instantiateModelsToScene((name) => `${item.id}:${name}`, false, { doNotInstantiate: true });
    for (const root of instance.rootNodes) root.parent = wrapper;
    const metadata = wrapper.getChildMeshes(false).find((mesh) => mesh.metadata?.nominal_width_m)?.metadata;
    const nominalWidth = Number(metadata?.nominal_width_m) || definition.widthMm / 1000;
    const nominalDepth = Number(metadata?.nominal_depth_m) || definition.depthMm / 1000;
    const nominalHeight = Number(metadata?.nominal_height_m) || definition.heightMm / 1000;
    wrapper.scaling = new Vector3(width / nominalWidth, height / nominalHeight, depth / nominalDepth);
    for (const mesh of wrapper.getChildMeshes(false)) {
      const typedMesh = mesh as AbstractMesh;
      if (typedMesh.material) typedMesh.material = this.materialFor(typedMesh.material, item, ghost);
      typedMesh.receiveShadows = true;
      this.shadow.addShadowCaster(typedMesh);
    }
    return true;
  }

  dispose() {
    for (const material of this.materialVariants.values()) material.dispose(false, false);
    for (const container of this.containers.values()) container.dispose();
    this.materialVariants.clear(); this.containers.clear(); this.pending.clear();
  }
}
