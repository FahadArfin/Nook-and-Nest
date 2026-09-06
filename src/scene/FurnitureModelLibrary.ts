import modernMaterialAliases from '../modernMaterialAliases.json';
import {preserveCatalogCoordinates} from './planCoordinates';
import {MeshoptCompression} from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import {instanceHolidayBranches} from './HolidayBranches';
import {positionSlidingLeaves} from './SlidingDoors';
import {modelAssetPath} from "../modelAssetPath";
import {LivingModels} from './LivingModels';
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Material } from "@babylonjs/core/Materials/material";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Scene } from "@babylonjs/core/scene";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF/2.0";
import { catalog, variants, isStairs } from "../catalog";
import type { CatalogItem, FurniturePlacement } from "../types";
import { findCountertopFinish, findDoorFinish } from "../surfaces";

MeshoptCompression.Configuration={decoder:{url:'/vendor/meshopt-decoder-1.2.0.js'}};

const MODEL_IDS = new Set(catalog.map((item) => item.id));

export class FurnitureModelLibrary {
  private living:LivingModels;
  private containers = new Map<string, AssetContainer>();
  private pending = new Map<string, Promise<void>>();
  private failed = new Set<string>();
  private disposed = false;
  private materialVariants = new Map<string, Material>();

  constructor(private scene: Scene, private shadow: ShadowGenerator, private onReady: () => void) {this.living=new LivingModels(scene);}

  hasModel(catalogId: string) { return MODEL_IDS.has(catalogId); }

  private ensure(catalogId: string) {
    if (this.disposed || !this.hasModel(catalogId) || this.failed.has(catalogId) || this.containers.has(catalogId) || this.pending.has(catalogId)) return;
    const request = LoadAssetContainerAsync(modelAssetPath(catalogId), this.scene)
      .then((container) => { if(this.disposed)container.dispose();else {preserveCatalogCoordinates(container);this.containers.set(catalogId, container);} })
      .catch((error) => { this.failed.add(catalogId);console.warn(`Could not load Blender furniture model ${catalogId}; using procedural fallback.`, error); })
      .finally(() => {
        this.pending.delete(catalogId);
        // A plan may request many models at once. Wait for the current batch so
        // the scene is rebuilt once, after every requested GLB has settled.
        if (!this.disposed && this.pending.size === 0) this.onReady();
      });
    this.pending.set(catalogId, request);
  }

  private materialFor(source: Material, item: FurniturePlacement, ghost: boolean) {
    const colorsKey=JSON.stringify(item.materialColors??{});
    const aliases=(modernMaterialAliases as Record<string,Record<string,string[]>>)[item.catalogId]?.[source.name]??[];
    const custom=item.materialColors?.[source.name]??aliases.map(key=>item.materialColors?.[key]).find(Boolean);
    if (source instanceof MultiMaterial) {
      const key = `${source.uniqueId}:${colorsKey}:${item.variant}:${item.surfaceVariant??"default"}:${ghost ? "ghost" : "solid"}`;
      const cached = this.materialVariants.get(key);
      if (cached) return cached;
      const clone = source.clone(`model-${key}`);
      if (!clone) return source;
      clone.subMaterials = source.subMaterials.map((material) => material ? this.materialFor(material, item, ghost) : null);
      this.materialVariants.set(key, clone);
      return clone;
    }
    const isTintable = source.name.includes("upholstery-textured") || source.name.includes("variant-surface") || source.name.includes("door-surface") || source.name==="ceramic-tiles";
    const isCountertop = source.name.includes("countertop-surface");
    const isDoorSurface=source.name.includes("door-surface");
    if (!isTintable && !isCountertop && !isDoorSurface && !ghost && !custom) return source;
    const key = `${source.uniqueId}:${colorsKey}:${isTintable ? item.variant : "base"}:${isCountertop||isDoorSurface ? item.surfaceVariant??"warm-granite" : "none"}:${ghost ? "ghost" : "solid"}`;
    const cached = this.materialVariants.get(key);
    if (cached) return cached;
    const clone = source.clone(`model-${key}`);
    if (!clone) return source;
    if (clone instanceof PBRMaterial) {
      if (isTintable) {
        const tint = variants[item.variant as keyof typeof variants] ?? variants.sage;
        clone.albedoColor = Color3.Lerp(Color3.White(), Color3.FromHexString(tint), .9);
      }
      if (isCountertop||isDoorSurface) {
        const finish = isDoorSurface?findDoorFinish(item.surfaceVariant):findCountertopFinish(item.surfaceVariant);
        const texture = new Texture(finish.texture, this.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
        texture.wrapU = Texture.WRAP_ADDRESSMODE; texture.wrapV = Texture.WRAP_ADDRESSMODE;
        texture.uScale = finish.scale; texture.vScale = finish.scale; texture.anisotropicFilteringLevel = 4;
        clone.albedoTexture = texture; if(!isDoorSurface)clone.albedoColor = Color3.White(); clone.roughness = .9;
      }
      if(custom && /^#[0-9a-f]{6}$/i.test(custom)) clone.albedoColor=Color3.FromHexString(custom).toLinearSpace();
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
    // Blender Y-up export plus Babylon's left-handed root reverses X/Z.
    // Stair paths use +Z ascent in editor coordinates, including L/U landings.
    if(isStairs(item.catalogId))wrapper.rotation.y=Math.PI;
    const instance = container.instantiateModelsToScene((name) => `${item.id}:${name}`, false, { doNotInstantiate: true });
    for (const root of instance.rootNodes) root.parent = wrapper;
    const metadata = wrapper.getChildMeshes(false).find((mesh) => mesh.metadata?.nominal_width_m)?.metadata;
    const nominalWidth = Number(metadata?.nominal_width_m) || definition.widthMm / 1000;
    const nominalDepth = Number(metadata?.nominal_depth_m) || definition.depthMm / 1000;
    const nominalHeight = Number(metadata?.nominal_height_m) || definition.heightMm / 1000;
    wrapper.scaling = new Vector3(width / nominalWidth, height / nominalHeight, depth / nominalDepth);
    if(definition.id==='christmas-tree'||definition.id==='christmas-slim-tree')instanceHolidayBranches(wrapper);
    for (const mesh of wrapper.getChildMeshes(false)) {
      const typedMesh = mesh as AbstractMesh;
      typedMesh.metadata={...typedMesh.metadata,livingMaterial:typedMesh.material?.name};
      if (typedMesh.material) typedMesh.material = this.materialFor(typedMesh.material, item, ghost);
      const shadowless=typedMesh.metadata.livingMaterial?.startsWith('holiday-light-')||['aquarium-clear-glass','aquarium-water-surface','aquarium-air-bubble','golden-flame','warm-light'].includes(typedMesh.metadata.livingMaterial);
      typedMesh.receiveShadows = !shadowless;
      if(!shadowless)this.shadow.addShadowCaster(typedMesh);
    }
    positionSlidingLeaves(wrapper,item.openFraction);
    if(!ghost)this.living.attach(wrapper,item.catalogId,nominalWidth,nominalDepth,nominalHeight);
    return true;
  }

  dispose() {
    this.living.dispose();
    this.disposed=true;
    for (const material of this.materialVariants.values()) material.dispose(false, false);
    for (const container of this.containers.values()) container.dispose();
    this.materialVariants.clear(); this.containers.clear(); this.pending.clear();
  }
}
