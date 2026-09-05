import detailedIds from "../src/detailedModelIds.json";
import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { NullEngine,Scene } from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { outdoorRows,sceneryOptions } from '../src/outdoorCatalog';
import { catalog } from '../src/catalog';
import { createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare } from '../src/domain';
import { usePlanner } from '../src/store';
import { grassPoints,outsidePlacementPoint,landscapeBounds } from '../src/outdoors';
import { closeZoomLimit,closeClipPlane,detailFocusRadius,precisionPanSensitivity,cameraUpdatePolicy } from '../src/cameraPolicy';
import { furnitureType } from '../src/library';
import { OutdoorScene } from '../src/scene/OutdoorScene';
import type { FurniturePlacement } from '../src/types';
const make=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:crypto.randomUUID(),catalogId:id,floorId,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,x:-4000,z:-4000,rotation:0,variant:'sage'};};
describe('outdoor collection',()=>{
 it('ships 27 original editable pieces with bounded dimensioned GLBs and previews',()=>{
  expect(outdoorRows).toHaveLength(27);
  for(const [id,,,w,d,h] of outdoorRows){expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.png`),id).toBe(true);
   const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),bounds=g.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>g.accessors[p.attributes.POSITION]));
   for(let axis=0;axis<3;axis++)expect((Math.max(...bounds.map((b:any)=>b.max[axis]))-Math.min(...bounds.map((b:any)=>b.min[axis])))*1000,id).toBeCloseTo([w,h,d][axis],1);
   expect(g.accessors.filter((a:any)=>a.type==='SCALAR').reduce((sum:number,a:any)=>sum+a.count/3,0),id).toBeLessThan(detailedIds.includes(id)?120000:60000);expect(b.length,id).toBeLessThan(detailedIds.includes(id)?8_000_000:5_000_000);
   expect(furnitureType(catalog.find(c=>c.id===id)!)).not.toBe('Other pieces');
  }
 });
 it('imports every outdoor and scenery GLB in Babylon',async()=>{const engine=new NullEngine(),scene=new Scene(engine);try{for(const id of [...outdoorRows.map(r=>r[0]),...sceneryOptions.filter(s=>s!=='plain').map(s=>`backdrop-${s}`)]){const c=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(c.meshes.some(m=>m.getTotalVertices()>0),id).toBe(true);c.dispose();}}finally{scene.dispose();engine.dispose()}});
});
describe('outside placement',()=>{
 it('rests normal furniture on the ground, floor, and patio using explicit saved heights',()=>{
  const p=createSamplePlan(),f=p.floors[0],item=make('patio-dining-chair',f.id);
  expect(outsidePlacementPoint(p,item,{x:-4,y:5,z:-4},{x:0,y:-1,z:0})).toEqual({x:-4000,z:-4000,elevationMm:-200});
  expect(outsidePlacementPoint(p,item,{x:1,y:5,z:1},{x:0,y:-1,z:0})?.elevationMm).toBe(0);
  p.furniture=[{...make('cobble-patio',f.id),elevationMm:-200}];
  expect(outsidePlacementPoint(p,item,{x:-4,y:5,z:-4},{x:0,y:-1,z:0})?.elevationMm).toBe(-130);
  expect(outsidePlacementPoint(p,{...item,widthMm:3000},{x:-4,y:5,z:-4},{x:0,y:-1,z:0})?.elevationMm).toBe(-200);
 });
 it('does not stack paving by accident or drop upper-floor furniture to ground level',()=>{
  const p=createSamplePlan(),f=p.floors[0],tile={...make('cobble-patio',f.id),elevationMm:-200};p.furniture=[tile];
  expect(outsidePlacementPoint(p,{...tile,id:'second'},{x:-4,y:5,z:-4},{x:0,y:-1,z:0})?.elevationMm).toBe(-200);
  expect(outsidePlacementPoint(p,make('patio-dining-chair',p.floors[1].id),{x:-4,y:10,z:-4},{x:0,y:-1,z:0})).toBeUndefined();
 });
 it('retains outdoor placements through undo, backup and sharing',()=>{
  const p=createSamplePlan(),s=usePlanner.getState();s.replacePlan(p);const item={...make('sakura-tree',p.floors[0].id),elevationMm:-200};s.confirmFurniture(item);s.undo();expect(usePlanner.getState().plan.furniture).toEqual([]);s.redo();const after=usePlanner.getState().plan;expect(parsePlan(serializePlan(after))).toEqual(after);expect(decodeShare(encodeShare(after)).furniture).toEqual(after.furniture);
 });
});
describe('optional scenery and efficient grass',()=>{
 it('uses bounded non-pickable thin instances and reuses them on unrelated edits',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine),view=new OutdoorScene(scene),p=createSamplePlan();
  try{view.update(p);expect(scene.meshes).toHaveLength(0);const c=await LoadAssetContainerAsync(readFileSync('public/models/furniture/grass-clump.glb'),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});(view as any).assets.set('grass-clump',c);p.environment={background:'plain',grass:'sparse'};view.update(p);
   const grass=scene.meshes.filter(m=>m.name==='instanced-grass');expect(grass.length).toBeGreaterThan(0);expect(grass.length).toBeLessThanOrEqual(2);for(const m of grass){expect(m.isPickable).toBe(false);expect((m as any).thinInstanceCount).toBeLessThanOrEqual(600);expect((m as any).thinInstanceCount).toBeGreaterThan(0);}
   view.update({...p,name:'Renamed'});expect(scene.meshes.filter(m=>m.name==='instanced-grass')).toEqual(grass);view.update({...p,environment:{background:'plain',grass:'off'}});expect(scene.meshes.filter(m=>m.name==='instanced-grass')).toEqual([]);
  }finally{view.dispose();scene.dispose();engine.dispose()}
 });
 it('keeps old projects plain, and makes each setting undoable and shareable',()=>{
  const p=createSamplePlan(),s=usePlanner.getState();expect(grassPoints(p)).toEqual([]);expect(parsePlan(serializePlan(p)).environment).toBeUndefined();s.replacePlan(p);s.setEnvironment({background:'farm'});s.setEnvironment({grass:'sparse'});const after=usePlanner.getState().plan;expect(decodeShare(encodeShare(after)).environment).toEqual({background:'farm',grass:'sparse'});s.undo();expect(usePlanner.getState().plan.environment?.grass).toBe('off');s.undo();expect(usePlanner.getState().plan.environment).toBeUndefined();
 });
 it('rejects corrupt scenery settings',()=>{for(const environment of [null,{background:'unknown',grass:'off'},{background:'plain',grass:100}])expect(()=>parsePlan(JSON.stringify({...createSamplePlan(),environment}))).toThrow()});
 it('bounds grass count, stays deterministic and avoids floors and furnishing footprints',()=>{
  const p=createSamplePlan();p.environment={background:'plain',grass:'lush'};p.furniture=[{...make('concrete-patio',p.floors[0].id),widthMm:4000,depthMm:4000}];
  const points=grassPoints(p);expect(points.length).toBeGreaterThan(1000);expect(points.length).toBeLessThanOrEqual(1800);expect(grassPoints(p)).toEqual(points);
  expect(points.some(q=>q.x>-6.2&&q.x<-1.8&&q.z>-6.2&&q.z<-1.8)).toBe(false);
  p.environment.grass='sparse';expect(grassPoints(p).length).toBeLessThanOrEqual(600);p.environment.grass='off';expect(grassPoints(p)).toEqual([]);
 });
 it('keeps the background outside expanded buildings and distant outdoor objects',()=>{const p=createSamplePlan(),before=landscapeBounds(p);p.furniture=[{...make('maple-tree',p.floors[0].id),x:40000,z:40000}];expect(landscapeBounds(p).radius).toBeGreaterThan(before.radius)});
});
describe('detail camera',()=>{
 it('zooms sixteen times closer than the old limit and keeps near clipping small',()=>{expect(closeZoomLimit).toBe(.25);expect(closeClipPlane).toBeLessThan(.01);expect(detailFocusRadius(150,140,270)).toBeLessThan(.6);expect(precisionPanSensitivity(.5)).toBeGreaterThan(precisionPanSensitivity(10));});
 it('does not refocus after selecting, coloring or changing scenery',()=>{const p=createSamplePlan();expect(cameraUpdatePolicy(p,{...p,environment:{background:'city',grass:'off'}},p.floors[0].id,p.floors[0].id)).toEqual({reframe:false,orient:false})});
});
