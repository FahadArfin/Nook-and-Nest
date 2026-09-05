import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import {LivingModels,swimPose,motionData} from '../src/scene/LivingModels';
import {cameraFacingRotation} from '../src/placementFacing';
import {usePlanner} from '../src/store';
import {createSamplePlan} from '../src/domain';
import {catalog} from '../src/catalog';

describe('living furniture and camera-facing placement',()=>{
 it('faces camera quadrants without changing wall placement rules',()=>{
  for(const [x,z,angle] of [[0,1,0],[1,0,90],[0,-1,180],[-1,0,270]])expect(cameraFacingRotation('sofa',{x,z},{x:0,z:0})).toBe(angle);
  expect(cameraFacingRotation('window-casement',{x:-5,z:3},{x:0,z:0})).toBe(0);
 });
 it('records a held rotation as one undo step',()=>{
  const s=usePlanner.getState();s.replacePlan(createSamplePlan());s.placeFurniture('sofa');const before=usePlanner.getState().plan,id=before.furniture[0].id,count=usePlanner.getState().past.length;s.beginTurn(id);
  for(let i=0;i<50;i++)s.turnFurniture(id,1.5);expect(usePlanner.getState().past).toHaveLength(count);s.finishTurn();expect(usePlanner.getState().past).toHaveLength(count+1);expect(usePlanner.getState().plan.furniture[0].rotation).toBe(75);s.undo();expect(usePlanner.getState().plan.furniture).toEqual(before.furniture);s.redo();expect(usePlanner.getState().plan.furniture[0].rotation).toBe(75);
 });
 it('animates existing authored flame geometry and releases the shader on disposal',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),living=new LivingModels(scene),root=new TransformNode('fire',scene),mesh=MeshBuilder.CreateBox('flame',{},scene);mesh.parent=root;mesh.material=new StandardMaterial('golden-flame',scene);
  living.attach(root,'cottage-fireplace',1,.5,1);expect(mesh.material).toBeInstanceOf(ShaderMaterial);living.tick(1);const count=scene.meshes.length;for(let t=0;t<100;t++)living.tick(t);expect(scene.meshes).toHaveLength(count);root.dispose();expect(scene.materials.some(m=>m.name==='living-fire')).toBe(false);living.dispose();scene.dispose();engine.dispose();
 });
 it('imports aquariums with separate moving fish, tails and bubbles that stay in the glass',async()=>{
  for(const id of ['desktop-aquarium','planted-aquarium','reef-aquarium']){
   const engine=new NullEngine(),scene=new Scene(engine),living=new LivingModels(scene),root=new TransformNode('aquarium',scene);const c=catalog.find(c=>c.id===id)!;
   try{const asset=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});const instance=asset.instantiateModelsToScene(name=>'placed:'+name,false,{doNotInstantiate:true});for(const n of instance.rootNodes)n.parent=root;
    const nodes=root.getDescendants(false).filter(n=>motionData(n).motion_role&&!motionData(n.parent).motion_role) as TransformNode[];
    const fish=nodes.filter(n=>motionData(n).motion_role==='fish'),bubbles=nodes.filter(n=>motionData(n).motion_role==='bubble');expect(fish.length,id).toBe(id==='desktop-aquarium'?4:6);expect(bubbles,id).toHaveLength(18);
    living.attach(root,id,c.widthMm/1000,c.depthMm/1000,c.heightMm/1000);const initial=fish[0].position.clone();living.tick(2);expect(fish[0].position.equals(initial)).toBe(false);const count=scene.meshes.length;
    for(let t=0;t<120;t+=.5){living.tick(t);for(const node of fish){expect(Math.abs(node.position.x)).toBeLessThan(c.widthMm/2000);expect(Math.abs(node.position.z)).toBeLessThan(c.depthMm/2000);expect(node.position.y).toBeLessThan(c.heightMm/1000-.03);for(const mesh of node.getChildMeshes()){mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;expect(Math.max(Math.abs(b.minimumWorld.x),Math.abs(b.maximumWorld.x))).toBeLessThan(c.widthMm/2000);expect(Math.max(Math.abs(b.minimumWorld.z),Math.abs(b.maximumWorld.z))).toBeLessThan(c.depthMm/2000);}}}
    expect(scene.meshes).toHaveLength(count);root.dispose();living.tick(121);
   }finally{living.dispose();scene.dispose();engine.dispose();}
  }
 });
 it('uses continuous bounded swimming paths',()=>{for(let i=0;i<6;i++)for(let t=0;t<100;t++){const p=swimPose(t,i,1,.5),next=swimPose(t+.016,i,1,.5);expect(Math.abs(p.x)).toBeLessThanOrEqual(.105);expect(Math.hypot(next.x-p.x,next.z-p.z)).toBeLessThan(.005);}});
});
