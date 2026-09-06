import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import {catalog,isSurfaceMounted,isWallMounted,defaultMountHeight} from '../src/catalog';
import {luxuryIds,luxurySinkIds} from '../src/luxuryCollection';
import {supportsCountertopFinish} from '../src/surfaces';
import {tabletopChoices,supportsDesktop} from '../src/tabletop';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {glbBounds} from './glbBounds';
import type {FurniturePlacement} from '../src/types';
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:2000,z:2000,rotation:90,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};};
describe('luxury kitchen and Skyline collection',()=>{
 it('ships distinct, bounded, dimensionally exact authored assets',()=>{
  expect(luxuryIds).toHaveLength(17);expect(new Set(catalog.map(c=>c.id)).size).toBe(catalog.length);
  for(const id of luxuryIds){
   const c=catalog.find(c=>c.id===id)!;
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);
   expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
   const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
   const bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(a=>a.max[axis]))-Math.min(...bounds.map(a=>a.min[axis])))*1000,id).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(a=>a.min[1])),id).toBeCloseTo(0,5);
   const triangles=g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0);
   expect(triangles,id).toBeLessThan(id==='skyline-gtr-brick'?120000:60000);
   expect(b.length,id).toBeLessThan(8_000_000);
   expect(g.materials.length,id).toBeGreaterThanOrEqual(2);
  }
 });
 it('places independent cooktops and the car on fitting counters with reversible saves',()=>{
  const p=createSamplePlan(),floor=p.floors[0].id;const counter={...piece('base-cabinet',floor),widthMm:1200,depthMm:650};p.furniture=[counter];
  for(const id of ['luxury-induction-cooktop-30','luxury-induction-cooktop-36','luxury-gas-cooktop-36','skyline-gtr-brick']){
   expect(isSurfaceMounted(id)).toBe(true);const item=piece(id,floor);const point=tabletopChoices(p,item)[0]?.placement;
   expect(point?.elevationMm,id).toBe(counter.heightMm);
   const saved={...p,furniture:[counter,{...item,...point,materialColors:{'brushed-stainless-steel':'#657589'}}]};
   expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);
  }
  usePlanner.getState().replacePlan(p);usePlanner.getState().placeFurniture('skyline-gtr-brick');expect(usePlanner.getState().plan.furniture).toHaveLength(2);usePlanner.getState().undo();expect(usePlanner.getState().plan.furniture).toEqual(p.furniture);
 });
 it('keeps wall ovens elevated and sink worktops independently finishable without false support planes',()=>{
  for(const [id,height] of [['luxury-wall-oven-single',750],['luxury-wall-oven-double',250],['luxury-steam-oven',1150]] as const){expect(isWallMounted(id)).toBe(true);expect(defaultMountHeight(id)).toBe(height);}
  for(const id of luxurySinkIds){expect(supportsCountertopFinish(id)).toBe(true);expect(supportsDesktop(piece(id,'floor'))).toBe(false);}
 });
 it('loads every exported mesh in the application engine',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const id of luxuryIds){const asset=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(asset.meshes.some(m=>m.getTotalVertices()>0),id).toBe(true);asset.dispose();}}
  finally{scene.dispose();engine.dispose();}
 },30000);
});
