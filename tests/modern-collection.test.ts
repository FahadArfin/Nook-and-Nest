import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import manifest from '../tools/blender/modern_manifest.json';
import {catalog,isSurfaceMounted,isWallMounted} from '../src/catalog';
import {modernIds,modernDefaultVariant} from '../src/modernCollection';
import {filterLibrary} from '../src/library';
import {tabletopChoices} from '../src/tabletop';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {LivingModels,motionData} from '../src/scene/LivingModels';
import {shelfSurfaces,fitsShelf} from '../src/shelfSurfaces';
import {supportsCountertopFinish} from '../src/surfaces';
import type {FurniturePlacement} from '../src/types';
const piece=(id:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId:'floor',x:2500,z:2500,rotation:90,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}};
const browse={search:'',category:'All',type:'All',shelf:'browse' as const,favorites:[],inPlan:[],sort:'collection' as const};
describe('Batch 12 modern collection',()=>{
 it('preserves every revisited ID and exact catalog envelope',()=>{
  for(const row of manifest.revisited){const c=catalog.find(c=>c.id===row.id)!;expect(c,row.id).toBeDefined();expect([c.widthMm,c.depthMm,c.heightMm,c.mount],row.id).toEqual([row.widthMm,row.depthMm,row.heightMm,row.mount]);}
 });
 it('ships bounded authored additions with full previews and independent placement',()=>{
  expect(modernIds).toHaveLength(112);expect(new Set(modernIds).size).toBe(modernIds.length);
  for(const id of modernIds){
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
   const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
   const triangles=g.accessors.filter((a:any)=>a.type==='SCALAR').reduce((sum:number,a:any)=>sum+a.count/3,0);
   expect(triangles,id).toBeGreaterThan(100);expect(triangles,id).toBeLessThan(60000);expect(b.length,id).toBeLessThan(8_000_000);
  }
  for(const id of ['sonos-era-100','sonos-arc-ultra','sonos-amp','ellen-display-figurine'])expect(isSurfaceMounted(id),id).toBe(true);
  expect(isWallMounted('anime-landscape-1')).toBe(true);expect(isWallMounted('floating-media-console')).toBe(true);
 });
 it('retires nesting tables from browsing while preserving existing saved pieces',()=>{
  expect(filterLibrary(browse).items.some(c=>c.id==='nesting-tables')).toBe(false);
  expect(filterLibrary({...browse,shelf:'plan',inPlan:['nesting-tables']}).items.map(c=>c.id)).toEqual(['nesting-tables']);
  const p=createSamplePlan();p.furniture=[{...piece('nesting-tables'),floorId:p.floors[0].id,materialColors:{'wood-honey-textured':'#203344'}}];expect(parsePlan(serializePlan(p)).furniture).toEqual(p.furniture);
 });
 it('supports TVs on new media consoles without changing the previous plan',()=>{
  const p=createSamplePlan();p.floors[0].id='floor';p.furniture=[{...piece('floating-media-console'),elevationMm:280}];
  expect(tabletopChoices(p,piece('tv-75'))[0]?.placement.elevationMm).toBe(640);
  expect(supportsCountertopFinish('modern-double-sink-counter')).toBe(true);
 });
 it('keeps shelf placements inside the modeled bays and below the next panel',()=>{
  const owner={...piece('modular-low-storage'),rotation:0};const surfaces=shelfSurfaces(owner);expect(surfaces).toHaveLength(4);
  const s=surfaces[0],speaker={...piece('sonos-era-100'),rotation:0,x:owner.x+s.x,z:owner.z+s.z};
  expect(fitsShelf(speaker,owner,s)).toBe(true);expect(fitsShelf({...speaker,heightMm:1000},owner,s)).toBe(false);expect(fitsShelf(speaker,owner,s,owner.x,owner.z)).toBe(false);
 });
 it('uses modern colors only for new placements, preserving saved variants and overrides',()=>{
  const p=createSamplePlan();p.furniture=[{...piece('sofa'),floorId:p.floors[0].id,variant:'clay',materialColors:{'upholstery-textured':'#526789'}}];usePlanner.getState().replacePlan(p);const old=usePlanner.getState().plan.furniture[0];usePlanner.getState().placeFurniture('track-sofa');
  expect(usePlanner.getState().plan.furniture.find(c=>c.catalogId==='track-sofa')?.variant).toBe(modernDefaultVariant('track-sofa'));expect(usePlanner.getState().plan.furniture[0]).toEqual(old);usePlanner.getState().undo();expect(usePlanner.getState().plan.furniture).toEqual([old]);
 });
 it('imports the fountain and animates bounded reusable ripples without spawning geometry',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine),living=new LivingModels(scene),root=new TransformNode('fountain',scene);
  try{
   const asset=await LoadAssetContainerAsync(readFileSync('public/models/furniture/pet-water-fountain.glb'),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});
   const instance=asset.instantiateModelsToScene(n=>'placed:'+n,false,{doNotInstantiate:true});instance.rootNodes.forEach(n=>n.parent=root);
   const nodes=root.getDescendants(false).filter(n=>motionData(n).motion_role==='fountain_ripple'&&!motionData(n.parent).motion_role) as TransformNode[];expect(nodes).toHaveLength(3);
   living.attach(root,'pet-water-fountain',.26,.26,.18);living.tick(0);const baseline=nodes.map(n=>n.scaling.clone()),count=scene.meshes.length;
   living.tick(1);expect(nodes.some((n,i)=>!n.scaling.equals(baseline[i]))).toBe(true);for(let t=0;t<200;t++)living.tick(t);expect(scene.meshes).toHaveLength(count);
   living.tick(0);nodes.forEach((n,i)=>expect(n.scaling.equals(baseline[i])).toBe(true));root.dispose();living.tick(2);
  }finally{living.dispose();scene.dispose();engine.dispose();}
 });
});
