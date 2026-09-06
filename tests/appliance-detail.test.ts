import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import previous from './appliance-material-baseline.json';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import ids from '../src/applianceDetailIds.json';
import additions from '../src/applianceExpansion.json';
import inventory from '../tools/blender/appliance_inventory.json';
import materials from '../src/modelMaterials.json';
import {catalog,isSurfaceMounted} from '../src/catalog';
import {modelAssetPath} from '../src/modelAssetPath';
import {glbBounds} from './glbBounds';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {tabletopChoices} from '../src/tabletop';
import type {FurniturePlacement} from '../src/types';
const asset=(id:string)=>{const b=readFileSync(`public/models/furniture/${id}.glb`);return {b,g:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};};
describe('detailed appliance collection',()=>{
 it('preserves all 39 existing catalog contracts and material color identifiers',()=>{
  expect(inventory).toHaveLength(39);
  for(const item of inventory){
   expect(catalog.find(c=>c.id===item.id)).toMatchObject(item);
   const names=asset(item.id).g.materials.map((m:any)=>m.name);
   for(const m of (previous as any)[item.id]){expect(names,item.id).toContain(m.id);expect((materials as any)[item.id],item.id).toContainEqual(m);}
  }
 });
 it('ships 53 exact-size, grounded, bounded meshes with editable sources and previews',()=>{
  expect(ids).toHaveLength(53);expect(additions).toHaveLength(14);
  for(const id of ids){
   const c=catalog.find(c=>c.id===id)!;const {b,g}=asset(id),bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(a=>a.max[axis]))-Math.min(...bounds.map(a=>a.min[axis])))*1000,id).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(a=>a.min[1])),id).toBeCloseTo(0,5);
   const tris=g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0);
   expect(tris,id).toBeLessThan(60000);expect(b.length,id).toBeLessThan(8_000_000);
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);
   expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
   expect(modelAssetPath(id)).toContain('appliance-detail-2');expect(modelAssetPath(id,true)).toContain('appliance-detail-2');
  }
 });
 it('supports every new appliance independently on counters and preserves colors in saves',()=>{
  const plan=createSamplePlan(),floorId=plan.floors[0].id;
  const piece=(id:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:2000,z:2000,rotation:90,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};};
  const counter={...piece('base-cabinet'),widthMm:1200,depthMm:650};plan.furniture=[counter];
  for(const row of additions){const id=row[0] as string,item=piece(id);expect(isSurfaceMounted(id),id).toBe(true);const support=tabletopChoices(plan,item)[0]?.placement;expect(support?.elevationMm,id).toBe(counter.heightMm);
   const saved={...plan,furniture:[counter,{...item,...support,materialColors:{'variant-surface':'#1c2535'}}]};expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);
  }
 });
 it('loads all 53 GLBs through Babylon',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const id of ids){const a=await LoadAssetContainerAsync(asset(id).b,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(a.meshes.some(m=>m.getTotalVertices()>0),id).toBe(true);a.dispose();}}
  finally{scene.dispose();engine.dispose();}
 },30000);
});
