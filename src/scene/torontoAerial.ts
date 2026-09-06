import {RawTexture} from '@babylonjs/core/Materials/Textures/rawTexture';
import type {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {createTorontoGround,createTorontoLake} from './torontoLandscapeMaterials';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';
import imagery from '../../public/textures/toronto/aerial-2022.json';

/** Matches prepare-toronto-scenery.py and Blender's Z-up -> glTF Y-up export. */
export function torontoRoofUV(east: number, south: number): [number, number] {
  const lon = -79.3825 + east / (111320 * Math.cos(43.64 * Math.PI / 180));
  const lat = 43.64 - south / 111320;
  const e = imagery.extent;
  return [(lon - e.xmin) / (e.xmax - e.xmin), (lat - e.ymin) / (e.ymax - e.ymin)];
}

/** One shared bounded image; facades and emissive window materials remain intact. */
export function applyTorontoAerialRoofs(asset: AssetContainer, scene: Scene, night:()=>boolean = ()=>false) {
  const roofs = asset.meshes.filter(mesh => mesh.material instanceof PBRMaterial && mesh.material.name.endsWith('-roof'));
  if (!roofs.length) return;
  const ground = asset.meshes.filter(mesh => ['land','road','park'].includes(mesh.material?.name??''));
  for (const mesh of [...roofs,...ground]) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    const uv = new Float32Array(positions.length / 3 * 2);
    for (let i = 0; i < positions.length; i += 3) {
      const [u, v] = torontoRoofUV(positions[i], positions[i + 2]);
      uv[i / 3 * 2] = u; uv[i / 3 * 2 + 1] = v;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
  }
  const groundMaterials:ShaderMaterial[]=[];
  const texture = new Texture('/textures/toronto/aerial-2022.jpg', scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, () => {
    if (asset.meshes.length === 0) return;
    for (const mesh of roofs) {
      const material = mesh.material as PBRMaterial;
      material.albedoTexture = texture;
      material.albedoColor = Color3.White();
      material.roughness = .9;
      material.metallic = 0;
    }
    for (const material of groundMaterials) {material.setTexture('aerial',texture);material.setFloat('photoReady',1);}
  });
  const fallback=RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]),1,1,scene,false,false);asset.textures.push(fallback);
  for (const mesh of ground) {
    const material=createTorontoGround(scene,fallback,(mesh.material as PBRMaterial).albedoColor,night);
    groundMaterials.push(material);asset.materials.push(material);mesh.material=material;
  }
  texture.name = 'Toronto 2022 orthophoto roofs';
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 4;
  asset.textures.push(texture);
  const water=asset.meshes.find(mesh=>mesh.material?.name==='water');
  if(water){const lake=createTorontoLake(scene,night);asset.materials.push(lake);water.material=lake;}
  const glass=new Texture('/textures/toronto/glass-curtain-wall.png',scene);
  glass.uScale=.5;glass.vScale=.5;asset.textures.push(glass);
  const brick=new Texture('/textures/toronto/brick-facade.png',scene);asset.textures.push(brick);
  const masonry=new Texture('/textures/pale-limestone.jpg',scene);masonry.uScale=4;masonry.vScale=4;asset.textures.push(masonry);
  const lights = new Texture('/textures/toronto/night-windows.svg', scene);
  lights.name = 'Toronto window lights';
  asset.textures.push(lights);
  for (const material of asset.materials) {
    if (material instanceof PBRMaterial && /^(glass|stone[0-2])$/.test(material.name)) {
      material.emissiveTexture = lights;
      material.albedoTexture=material.name==='glass'?glass:material.name==='stone0'?brick:material.name==='stone1'?glass:masonry;
      material.albedoColor=material.name==='glass'?new Color3(.85,.95,1):material.name==='stone0'?Color3.White():material.name==='stone1'?new Color3(.78,.82,.83):new Color3(.9,.87,.81);
      material.roughness=material.name==='glass'?.22:.85;material.metallic=material.name==='glass'?.25:0;
    }
  }
}




