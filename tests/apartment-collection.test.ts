import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import rows from '../src/apartmentExpansion.json';
import materials from '../src/modelMaterials.json';
import {catalog,defaultMountHeight,isSurfaceMounted} from '../src/catalog';
import {showerIds,showerScaleX,globeAngle} from '../src/apartmentCollection';
import {LivingModels,motionData} from '../src/scene/LivingModels';
import {tabletopChoices} from '../src/tabletop';
import {createSamplePlan,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {usePlanner} from '../src/store';
import {architectureKey} from '../src/sceneUpdate';
import {glbBounds} from './glbBounds';
import type {FurniturePlacement} from '../src/types';
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:1500,z:1500,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'white'};};
const glb=(id:string)=>{const b=readFileSync(`public/models/furniture/${id}.glb`);return {bytes:b,g:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};};
describe('apartment and reading collection',()=>{
 it('has 40 editable, bounded models with exact catalog footprints and complete previews',async()=>{
  expect(rows).toHaveLength(40);expect(new Set(catalog.map(c=>c.id)).size).toBe(catalog.length);
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const [id] of rows){const name=String(id),c=catalog.find(c=>c.id===id)!;expect(c).toBeDefined();const {bytes,g}=glb(name),bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(b=>b.max[axis]))-Math.min(...bounds.map(b=>b.min[axis])))*1000,name).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(b=>b.min[1])),name).toBeCloseTo(0,5);
   expect(g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0),name).toBeLessThan(60000);
   expect(bytes.length,name).toBeLessThan(6_000_000);expect(existsSync(`assets-source/blender/${id}.blend`)).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`)).toBe(true);expect((materials as any)[name]?.length).toBeGreaterThan(0);
   const asset=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(asset.meshes.length,name).toBeLessThan(20);asset.dispose();
  }}finally{scene.dispose();engine.dispose();}
 },30000);
 it('supports compact lamps on each independently placeable bedside table',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  for(const [id] of rows.filter(r=>String(r[0]).startsWith('apartment-bedside-'))){const table=piece(String(id),floor);table.elevationMm=defaultMountHeight(table.catalogId);plan.furniture=[table];
   for(const lampId of ['apartment-lamp-opal','apartment-lamp-cone']){const lamp=piece(lampId,floor);expect(isSurfaceMounted(lampId)).toBe(true);const choices=tabletopChoices(plan,lamp);expect(choices,table.catalogId).toHaveLength(1);expect(choices[0].placement.elevationMm).toBe((table.elevationMm??0)+table.heightMm);}
  }
 });
 it('saves and undoes shower handedness without changing architecture or existing dimensions',()=>{
  for(const id of showerIds){const plan=createSamplePlan();const item=piece(id,plan.floors[0].id);plan.furniture=[item];usePlanner.getState().replacePlan(plan);const key=architectureKey(plan,item.floorId,'select');usePlanner.getState().updateFurniture(id,{showerMirrored:true});const changed=usePlanner.getState().plan;
   expect(showerScaleX(changed.furniture[0])).toBe(-1);expect(architectureKey(changed,item.floorId,'select')).toBe(key);expect(parsePlan(serializePlan(changed)).furniture[0].showerMirrored).toBe(true);expect(decodeShare(encodeShare(changed)).furniture[0].showerMirrored).toBe(true);
   expect(changed.furniture[0].widthMm).toBe(item.widthMm);usePlanner.getState().undo();expect(usePlanner.getState().plan.furniture[0].showerMirrored).toBeUndefined();usePlanner.getState().redo();expect(usePlanner.getState().plan.furniture[0].showerMirrored).toBe(true);
   expect(()=>parsePlan(serializePlan({...plan,furniture:[{...item,showerMirrored:'yes'}]} as any))).toThrow();
  }
  expect(showerScaleX({catalogId:'round-table',showerMirrored:true})).toBe(1);
 });
 it('rotates only the globe with a stable pivot and no added meshes',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine),living=new LivingModels(scene),root=new TransformNode('globe',scene);
  try{const asset=await LoadAssetContainerAsync(glb('library-rotating-globe').bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});const inst=asset.instantiateModelsToScene(n=>'placed:'+n,false,{doNotInstantiate:true});for(const n of inst.rootNodes)n.parent=root;
   const moving=root.getDescendants(false).filter(n=>motionData(n).motion_role==='globe'&&motionData(n.parent).motion_role!=='globe') as TransformNode[];expect(moving).toHaveLength(1);const node=moving[0],pivot=node.position.clone(),count=scene.meshes.length;
   living.attach(root,'library-rotating-globe',.312,.3,.44);living.tick(0);const start=node.rotationQuaternion!.clone();living.tick(30);expect(node.rotationQuaternion!.equals(start)).toBe(false);expect(node.position.equals(pivot)).toBe(true);living.tick(120);expect(node.rotationQuaternion!.equals(start)).toBe(true);expect(globeAngle(120)).toBe(0);expect(scene.meshes).toHaveLength(count);root.dispose();living.tick(121);
  }finally{living.dispose();scene.dispose();engine.dispose();}
 });
});
