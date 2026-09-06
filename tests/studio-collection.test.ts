import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import rows from '../src/studioExpansion.json';
import audit from '../assets-source/studio-model-audit.json';
import previous from '../tools/blender/studio-previous-materials.json';
import materials from '../src/modelMaterials.json';
import {catalog,isSurfaceMounted,isCeilingMounted,isWallMounted,defaultMountHeight} from '../src/catalog';
import {studioBathroomIds} from '../src/studioCollection';
import {shelfSurfaces,shelfChoices,fitsShelf} from '../src/shelfSurfaces';
import {tabletopChoices} from '../src/tabletop';
import {desktopClockTime} from '../src/scene/LiveClocks';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {glbBounds} from './glbBounds';
import type {FurniturePlacement} from '../src/types';
const ids=Object.keys(audit);
const glb=(id:string)=>{const bytes=readFileSync(`public/models/furniture/${id}.glb`);return {bytes,g:JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())};};
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:2000,z:2000,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};};
describe('luxury studio collection',()=>{
 it('delivers 69 additions and 11 compatible refinements at exact dimensions',()=>{
  expect(rows).toHaveLength(69);expect(ids).toHaveLength(80);expect(new Set(catalog.map(c=>c.id)).size).toBe(catalog.length);
  for(const id of ids){
   const c=catalog.find(c=>c.id===id)!;expect(c,id).toBeDefined();const {bytes,g}=glb(id);const bounds=glbBounds(g);
   for(const [axis,size] of [c.widthMm,c.heightMm,c.depthMm].entries())expect((Math.max(...bounds.map(b=>b.max[axis]))-Math.min(...bounds.map(b=>b.min[axis])))*1000,id).toBeCloseTo(size,0);
   expect(Math.min(...bounds.map(b=>b.min[1])),id).toBeCloseTo(0,5);
   expect(g.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+g.accessors[p.indices].count/3,0),id).toBeLessThan(85000);
   expect(bytes.length,id).toBeLessThan(6_000_000);
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
  }
  for(const id of studioBathroomIds){const names=glb(id).g.materials.map((m:any)=>m.name);for(const m of (previous as any)[id]){expect(names,id).toContain(m.id);expect((materials as any)[id],id).toContainEqual(m);}}
 });
 it('uses fitting shelf bays and preserves independently placed books through saves',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id,book=piece('manga-pilot-row',floor);
  for(const row of rows.filter(r=>String(r[0]).startsWith('shelf-'))){
   const owner=piece(String(row[0]),floor);plan.furniture=[owner];const levels=shelfSurfaces(owner);expect(levels.length,owner.catalogId).toBeGreaterThan(0);
   for(const level of levels){expect(level.width).toBeGreaterThan(0);expect(level.depth).toBeGreaterThan(0);expect(level.height).toBeLessThanOrEqual(owner.heightMm+.1);}
   const choices=shelfChoices(plan,book);expect(choices.length,owner.catalogId).toBeGreaterThan(0);const choice=choices[0];expect(fitsShelf({...book,...choice.placement},owner,choice.surface)).toBe(true);
   expect(fitsShelf({...book,widthMm:owner.widthMm+100},owner,choice.surface)).toBe(false);
   const saved={...plan,furniture:[owner,{...book,...choice.placement,materialColors:{'cobalt-blue':'#335577'}}]};expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);
  }
 });
 it('supports desk accessories and separate AMS on the printer with correct mounting types',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;plan.furniture=[piece('bambu-p2s',floor)];
  expect(tabletopChoices(plan,piece('bambu-ams2',floor))[0]?.placement.elevationMm).toBe(478);
  for(const r of rows){const id=String(r[0]);if(r[8]==='surface')expect(isSurfaceMounted(id),id).toBe(true);if(r[8]==='ceiling')expect(isCeilingMounted(id),id).toBe(true);if(r[8]==='wall')expect(isWallMounted(id),id).toBe(true);}
  expect(defaultMountHeight('toilet-neorest-wall')).toBe(150);expect(defaultMountHeight('recessed-round')).toBe(2450);
 });
 it('exports replaceable local-time displays and handles midnight, noon and single digits',()=>{
  expect(desktopClockTime(new Date(2026,8,6,0,0,0))).toBe('00:00:00');expect(desktopClockTime(new Date(2026,8,6,12,3,9))).toBe('12:03:09');expect(desktopClockTime(new Date(2026,8,6,23,59,59))).toBe('23:59:59');
  for(const id of ['divergence-clock','digital-alarm-clock']){const {g}=glb(id);expect(g.materials.some((m:any)=>m.name==='live-clock-display')).toBe(true);expect(g.nodes.some((n:any)=>n.extras?.motion_role==='clock_preview')).toBe(true);}
 });
 it('loads every model in Babylon with bounded material primitives',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{for(const id of ids){const asset=await LoadAssetContainerAsync(glb(id).bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(asset.meshes.some(m=>m.getTotalVertices()>0),id).toBe(true);expect(asset.meshes.length,id).toBeLessThan(32);asset.dispose();}}
  finally{scene.dispose();engine.dispose();}
 },30000);
});
