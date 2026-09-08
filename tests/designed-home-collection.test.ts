import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {Ray} from '@babylonjs/core/Culling/ray';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import rows from '../src/designedHomeExpansion.json';
import materials from '../src/modelMaterials.json';
import {catalog,defaultMountHeight,isSurfaceMounted} from '../src/catalog';
import {tabletopChoices} from '../src/tabletop';
import {createSamplePlan} from '../src/domain';
import {glbBounds} from './glbBounds';
import type {FurniturePlacement} from '../src/types';
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:1500,z:1500,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'white'};};
const glb=(id:string)=>{const b=readFileSync(`public/models/furniture/${id}.glb`);return {bytes:b,g:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};};
import {designedHomeTopIds,designedHomeCounterIds} from "../src/designedHomeCollection";
import {supportsCountertopFinish} from "../src/surfaces";
describe('designed home collection',()=>{
 it('has 37 editable, bounded models with exact catalog footprints and complete previews',async()=>{
  expect(rows).toHaveLength(37);expect(new Set(catalog.map(c=>c.id)).size).toBe(catalog.length);
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const [id] of rows){const name=String(id),c=catalog.find(c=>c.id===id)!;expect(c).toBeDefined();const {bytes,g}=glb(name),bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(b=>b.max[axis]))-Math.min(...bounds.map(b=>b.min[axis])))*1000,name).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(b=>b.min[1])),name).toBeCloseTo(0,5);
   expect(g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0),name).toBeLessThan(60000);
   expect(bytes.length,name).toBeLessThan(6_000_000);expect(existsSync(`assets-source/blender/${id}.blend`)).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`)).toBe(true);expect((materials as any)[name]?.length).toBeGreaterThan(0);
   const asset=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(asset.meshes.length,name).toBeLessThan(20);asset.dispose();
  }}finally{scene.dispose();engine.dispose();}
 },30000);
 it('supports independent objects on media units, dressers and coffee tables',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  for(const id of [...designedHomeTopIds,...rows.filter(r=>String(r[0]).includes('-coffee-')).map(r=>String(r[0]))]){
   const owner=piece(id,floor);owner.elevationMm=defaultMountHeight(id);plan.furniture=[owner];
   const choices=tabletopChoices(plan,piece('apartment-lamp-opal',floor));expect(choices,id).toHaveLength(1);expect(choices[0].placement.elevationMm).toBe((owner.elevationMm??0)+owner.heightMm);
  }
 });
 it('retains proper mount heights and independent farmhouse worktop finishes',()=>{
  expect(defaultMountHeight('designed-media-floating')).toBe(250);expect(defaultMountHeight('designed-basin-wall')).toBe(650);expect(isSurfaceMounted('designed-basin-vessel')).toBe(true);
  for(const id of designedHomeCounterIds){expect(supportsCountertopFinish(id)).toBe(true);expect(glb(id).g.materials.some((m:any)=>m.name==='countertop-surface')).toBe(true);}

 });
 it('keeps the center of each exported basin recessed below its rim',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const [id] of rows.filter(r=>String(r[0]).includes('-sink-')||String(r[0]).includes('-basin-'))){
   const name=String(id),c=catalog.find(c=>c.id===id)!;
   const asset=await LoadAssetContainerAsync(glb(name).bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});asset.addAllToScene();
   for(const m of asset.meshes)m.computeWorldMatrix(true);
   const heightAt=(x:number)=>{const hit=scene.pickWithRay(new Ray(new Vector3(x,3,0),new Vector3(0,-1,0)),m=>asset.meshes.includes(m));expect(hit?.hit,name).toBe(true);return hit!.pickedPoint!.y;};
   const center=heightAt(name==='designed-sink-fluted'?-c.widthMm*.00022:0),rim=heightAt(c.widthMm*.00044);
   expect(rim-center,name).toBeGreaterThan(.05);asset.dispose();
  }}finally{scene.dispose();engine.dispose();}
 },30000);
});
