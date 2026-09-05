import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import {instanceHolidayBranches} from '../src/scene/HolidayBranches';
import {LivingModels,holidayBrightness} from '../src/scene/LivingModels';
import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';

describe('compact holiday trees',()=>{
 it('imports reusable branches and reduces them to one pickable instanced mesh without shifting the tree',async()=>{
  for(const id of ['christmas-tree','christmas-slim-tree']){const engine=new NullEngine(),scene=new Scene(engine);try{
   const bytes=readFileSync(`public/models/furniture/${id}.glb`);expect(bytes.length).toBeLessThan(1_200_000);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());expect(json.meshes).toHaveLength(2);expect(json.nodes.filter((n:any)=>n.extras?.shared_geometry)).toHaveLength(104);
   const asset=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});const root=new TransformNode('tree',scene);root.position.set(3,1,-2);root.rotation.y=.4;root.scaling.set(1.2,.9,1.2);const instance=asset.instantiateModelsToScene(n=>n,false,{doNotInstantiate:true});instance.rootNodes.forEach(n=>n.parent=root);
   const bounds=()=>{const boxes=root.getChildMeshes().map(m=>{m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox;});return [0,1,2].flatMap(i=>[Math.min(...boxes.map(b=>b.minimumWorld.asArray()[i])),Math.max(...boxes.map(b=>b.maximumWorld.asArray()[i]))]);};
   const branchMatrices=root.getChildMeshes().filter(m=>/^linked_bough_/.test(m.name)).map(m=>m.computeWorldMatrix(true).clone());expect(instanceHolidayBranches(root)).toBe(104);const master=root.getChildMeshes().find(m=>m.hasThinInstances)! as Mesh;master.computeWorldMatrix(true);const placed=master.thinInstanceGetWorldMatrices();placed.forEach((matrix,i)=>matrix.multiply(master.getWorldMatrix()).asArray().forEach((value,j)=>expect(value).toBeCloseTo(branchMatrices[i].asArray()[j],4)));expect(master.thinInstanceEnablePicking).toBe(true);expect(root.getChildMeshes().length).toBeLessThan(12);

  }finally{scene.dispose();engine.dispose();}}
 });
 it('pulses red blue and yellow lights slowly, keeps geometry fixed, and disposes glow materials',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),living=new LivingModels(scene),root=new TransformNode('tree',scene);
  for(const color of ['red','blue','yellow']){const bulb=MeshBuilder.CreateBox(color,{},scene);bulb.parent=root;bulb.material=new StandardMaterial('holiday-light-'+color,scene);}
  living.attach(root,'christmas-tree',1,1,1.9);expect(root.getChildMeshes().every(m=>m.material instanceof ShaderMaterial)).toBe(true);const count=scene.meshes.length;for(let t=0;t<12;t+=.1){living.tick(t);expect(holidayBrightness(t)).toBeGreaterThanOrEqual(.439999);expect(holidayBrightness(t)).toBeLessThanOrEqual(1);expect(Math.abs(holidayBrightness(t+.016)-holidayBrightness(t))).toBeLessThan(.005);}
  expect(scene.meshes).toHaveLength(count);expect(holidayBrightness(0)).toBeCloseTo(holidayBrightness(6));root.dispose();expect(scene.materials.some(m=>m.name==='holiday-glow')).toBe(false);living.dispose();scene.dispose();engine.dispose();
 });
});
