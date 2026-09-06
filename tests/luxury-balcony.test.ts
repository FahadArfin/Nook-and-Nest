import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import rows from '../src/luxuryBalconyExpansion.json';
import materials from '../src/modelMaterials.json';
import {catalog} from '../src/catalog';
import {furnitureType,filterLibrary} from '../src/library';
import {createSamplePlan,rectangleCells,serializePlan,parsePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {glbBounds} from './glbBounds';

describe('luxury balcony collection',()=>{
 it('ships exact ground-aligned, bounded original models and complete material controls',()=>{
  expect(new Set(catalog.map(c=>c.id)).size).toBe(catalog.length);
  for(const row of rows){
   const id=String(row[0]),c=catalog.find(c=>c.id===id)!;
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);
   expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
   const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(a=>a.max[axis]))-Math.min(...bounds.map(a=>a.min[axis])))*1000,id).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(a=>a.min[1])),id).toBeCloseTo(0,5);
   const primitives=g.meshes.flatMap((m:any)=>m.primitives);
   expect(primitives.reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0),id).toBeLessThan(25000);
   expect(primitives.length,id).toBeLessThanOrEqual(5);
   expect(b.length,id).toBeLessThan(2_000_000);
   expect((materials as Record<string,{id:string}[]>)[id].map(m=>m.id).sort()).toEqual(g.materials.map((m:any)=>m.name).sort());
   expect(furnitureType(c)).toBe('Balcony railings');
   if(id.endsWith('crystal'))expect(g.materials.find((m:any)=>m.name==='clear-laminated-glass').alphaMode).toBe('BLEND');
  }
 });
 it('keeps old IDs and dimensions and exposes all ten railing choices',()=>{
  for(const [id,depth] of [['balcony-rail-glass',120],['balcony-rail-concrete',160],['balcony-rail-hybrid',160]] as const){const c=catalog.find(c=>c.id===id)!;expect([c.widthMm,c.depthMm,c.heightMm]).toEqual([1200,depth,1100]);}
  expect(filterLibrary({search:'',category:'Outdoor',type:'Balcony railings',shelf:'browse',favorites:[],inPlan:[],sort:'name'}).items).toHaveLength(10);
 });
 it.each(rows.map(r=>String(r[0])))('replaces a wall with %s, preserves floor geometry, and round-trips independent colors through undo',id=>{
  const p=createSamplePlan();p.gridSizeMm=250;p.floors=[{...p.floors[0],cells:rectangleCells(20,20),walls:[],openings:[]}];p.furniture=[];
  const state=usePlanner.getState();state.replacePlan(p);state.cutWalls([{ax:4,az:0,bx:12,bz:0}],id);
  const result=usePlanner.getState().plan;
  expect(result.floors[0].cells).toEqual(p.floors[0].cells);
  expect(result.furniture).toHaveLength(2);expect(result.furniture.every(f=>f.catalogId===id)).toBe(true);
  expect(result.furniture.reduce((n,f)=>n+f.widthMm,0)).toBe(2000);
  const colored=structuredClone(result);colored.furniture[0].materialColors={[(materials as Record<string,{id:string}[]>)[id][0].id]:'#ac9072'};
  expect(parsePlan(serializePlan(colored)).furniture).toEqual(colored.furniture);
  expect(usePlanner.getState().past).toHaveLength(1);state.undo();expect(usePlanner.getState().plan).toEqual(p);state.redo();expect(usePlanner.getState().plan).toEqual(result);
 });
 it('loads every model in Babylon',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const row of rows){const asset=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${row[0]}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(asset.meshes.some(m=>m.getTotalVertices()>0)).toBe(true);asset.dispose();}}
  finally{scene.dispose();engine.dispose();}
 },30000);
});
