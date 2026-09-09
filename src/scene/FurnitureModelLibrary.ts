import {StaticPartInstances} from './StaticPartInstances';
import {isVegetation} from '../vegetation';
import modernMaterialAliases from '../modernMaterialAliases.json';
import {preserveCatalogCoordinates} from './planCoordinates';
import {MeshoptCompression} from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import {instanceHolidayBranches} from './HolidayBranches';
import {positionSlidingLeaves} from './SlidingDoors';
import {modelAssetPath} from "../modelAssetPath";
import {LivingModels} from './LivingModels';
import {LiveClocks} from './LiveClocks';
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
  private staticParts=new StaticPartInstances();
  private living:LivingModels;
  private clocks:LiveClocks;
  private containers = new Map<string, AssetContainer>();
  private residency=new Map<string,number>();private lastUsed=new Map<string,number>();private requests=new Set<AbortController>();
  private pending = new Map<string, Promise<void>>();
  private failed = new Set<string>();
  private disposed = false;
  private readyIds=new Set<string>();private readyTimer?:ReturnType<typeof setTimeout>;private queue=new Set<string>();private retryAfter=new Map<string,number>();
  private finishTextures=new Map<string,Texture>();
  private materialVariants = new Map<string, Material>();

  constructor(private scene: Scene, private shadow: ShadowGenerator, private onReady: (ids:string[]) => void) {this.living=new LivingModels(scene);this.clocks=new LiveClocks(scene);}

  hasModel(catalogId: string) { return MODEL_IDS.has(catalogId); }

  private ensure(catalogId: string) {
    if (this.disposed || !this.hasModel(catalogId) || (this.retryAfter.get(catalogId)??0)>Date.now() || this.containers.has(catalogId) || this.pending.has(catalogId)) return;
    if(this.pending.size>=4){this.queue.add(catalogId);return;}
    const abort=new AbortController();this.requests.add(abort);const timeout=setTimeout(()=>abort.abort(),30000);const path=modelAssetPath(catalogId);
    const request = fetch(path,{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('Model download failed: '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());return LoadAssetContainerAsync(bytes,this.scene,{pluginExtension:'.glb',rootUrl:path.slice(0,path.lastIndexOf('/')+1),name:catalogId+'.glb'})})
      .then((container) => { if(this.disposed)container.dispose();else {preserveCatalogCoordinates(container);this.containers.set(catalogId, container);const geometries=new Set();let bytes=0;for(const mesh of container.meshes){const geometry=(mesh as any).geometry;if(!geometry||geometries.has(geometry))continue;geometries.add(geometry);bytes+=mesh.getTotalVertices()*48+mesh.getTotalIndices()*4}for(const texture of container.textures){const size=texture.getSize();bytes+=size.width*size.height*4*4/3}this.residency.set(catalogId,bytes);} })
      .catch((error) => { this.failed.add(catalogId);this.retryAfter.set(catalogId,Date.now()+10000);console.warn(`Could not load Blender furniture model ${catalogId}; using procedural fallback.`, error); })
      .finally(() => {
        clearTimeout(timeout);this.requests.delete(abort);this.pending.delete(catalogId);this.prune(catalogId);this.readyIds.add(catalogId);
        // A plan may request many models at once. Wait for the current batch so
        // the scene is rebuilt once, after every requested GLB has settled.
        if(!this.disposed){for(const id of this.queue){if(this.pending.size>=4)break;this.queue.delete(id);this.ensure(id)}
          if(!this.readyTimer)this.readyTimer=setTimeout(()=>{this.readyTimer=undefined;if(this.disposed)return;const ids=[...this.readyIds];this.readyIds.clear();this.onReady(ids)},80);
        }
      });
    this.pending.set(catalogId, request);
  }

  private prune(protectedId:string){
    const used=new Set<Material>();for(const mesh of this.scene.meshes){if(mesh.material){used.add(mesh.material);if(mesh.material instanceof MultiMaterial)for(const m of mesh.material.subMaterials)if(m)used.add(m)}}
    if(this.materialVariants.size>256)for(const [key,m] of this.materialVariants){if(this.materialVariants.size<=192)break;if(!used.has(m)){m.dispose(false,false);this.materialVariants.delete(key)}}
    let resident=[...this.residency.values()].reduce((a,b)=>a+b,0);const budget=128*1024*1024;
    if(this.containers.size<=48&&resident<=budget)return;
    for(const [id,container] of [...this.containers].sort((a,b)=>(this.lastUsed.get(a[0])??0)-(this.lastUsed.get(b[0])??0))){if(this.containers.size<=32&&resident<=budget*.8)break;if(id===protectedId)continue;if(container.materials.some(m=>used.has(m))||container.meshes.some(m=>this.scene.meshes.some(active=>active!==m&&(active as any).geometry&&(active as any).geometry===(m as any).geometry)))continue;container.dispose();resident-=this.residency.get(id)??0;this.residency.delete(id);this.containers.delete(id);this.lastUsed.delete(id)}
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
    const isFrame=item.catalogId==="window-solarium"&&!source.name.includes("glazing");
    const isTintable = source.name.includes("upholstery-textured") || source.name.includes("variant-surface") || source.name.includes("door-surface") || source.name==="ceramic-tiles";
    const isCountertop = source.name.includes("countertop-surface");
    const isDoorSurface=source.name.includes("door-surface");
    if (!isTintable && !isCountertop && !isDoorSurface && !ghost && !custom && !isFrame) return source;
    const key = `${source.uniqueId}:${custom??""}:${isTintable ? item.variant : "base"}:${isCountertop||isDoorSurface ? item.surfaceVariant??"warm-granite" : "none"}:${ghost ? "ghost" : "solid"}`;
    const cached = this.materialVariants.get(key);
    if (cached) return cached;
    const clone = source.clone(`model-${key}`);
    if (!clone) return source;
    if(isFrame)clone.zOffset=-2;
    if (clone instanceof PBRMaterial) {
      if (isTintable) {
        const tint = variants[item.variant as keyof typeof variants] ?? variants.sage;
        clone.albedoColor = Color3.Lerp(Color3.White(), Color3.FromHexString(tint), .9);
      }
      if (isCountertop||isDoorSurface) {
        const finish = isDoorSurface?findDoorFinish(item.surfaceVariant):findCountertopFinish(item.surfaceVariant);
        const textureKey=finish.texture+':'+finish.scale;let texture=this.finishTextures.get(textureKey);if(!texture){texture=new Texture(finish.texture, this.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);this.finishTextures.set(textureKey,texture)}
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
    this.lastUsed.set(definition.id,Date.now());const container = this.containers.get(definition.id);
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
      if(!shadowless&&!isVegetation(item.catalogId))this.shadow.addShadowCaster(typedMesh);
    }
    if(!ghost&&!isVegetation(item.catalogId)&&!/(aquarium|fireplace|christmas|clock|door|window|fan)/.test(item.catalogId)){
      this.staticParts.convert(wrapper);for(const mesh of wrapper.getChildMeshes())this.shadow.addShadowCaster(mesh);
    }
    positionSlidingLeaves(wrapper,item.openFraction);
    if(!ghost){this.living.attach(wrapper,item.catalogId,nominalWidth,nominalDepth,nominalHeight);this.clocks.attach(wrapper,item.catalogId);}
    return true;
  }

  dispose() {
    this.staticParts.dispose();
    this.living.dispose();
    this.clocks.dispose();
    this.disposed=true;for(const request of this.requests)request.abort();this.requests.clear();clearTimeout(this.readyTimer);this.queue.clear();
    for (const material of this.materialVariants.values()) material.dispose(false, false);
    for (const container of this.containers.values()) container.dispose();
    for(const texture of this.finishTextures.values())texture.dispose();this.finishTextures.clear();
    this.materialVariants.clear(); this.containers.clear(); this.pending.clear();
  }
}
