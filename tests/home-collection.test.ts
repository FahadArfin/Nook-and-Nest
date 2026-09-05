import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import {positionSlidingLeaves} from '../src/scene/SlidingDoors';
import {motionData} from '../src/scene/LivingModels';
import {catalog,isWindow,isWallOpening,isSurfaceMounted,isCeilingMounted} from '../src/catalog';
import {homeIds,slidingDoorIds,windowTreatmentIds,doorAperture} from '../src/homeCollection';
import {createSamplePlan,rectangleCells,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {snapWindow,windowProblem,windowWallPieces} from '../src/windows';
import {architectureKey} from '../src/sceneUpdate';
import {validatePlan} from '../src/planValidation';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';
const plan=()=>{const p=createSamplePlan();p.gridSizeMm=250;p.furniture=[];p.floors=[{...p.floors[0],id:'floor',heightMm:2700,cells:rectangleCells(24,20),walls:[],openings:[]}];return p;};
const item=(id:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId:'floor',x:2500,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};};
describe('detailed interior collection',()=>{
 it('provides distinct mount rules for all 31 new models',()=>{
  expect(homeIds).toHaveLength(31);expect(new Set(homeIds).size).toBe(31);
  for(const id of windowTreatmentIds){expect(isWindow(id)).toBe(false);expect(isWallOpening(id)).toBe(false);}
  expect(isSurfaceMounted('food-processor')).toBe(true);expect(isCeilingMounted('ring-chandelier')).toBe(true);
 });
 it('places curtains over windows without cutting additional wall holes',()=>{
  const p=plan(),window=snapWindow(p,item('window-glider'));p.furniture=[window];const curtain=snapWindow(p,item('curtain-linen-pair'));
  expect(windowProblem(p,curtain)).toBeUndefined();const wall={id:'edge',ax:0,az:0,bx:24,bz:0};expect(windowWallPieces(wall,250,2700,[window,curtain])).toEqual(windowWallPieces(wall,250,2700,[window]));
 });
 it('cuts the barn doorway beneath the closed leaf and keeps the exposed track on solid wall',()=>{
  const door=item('door-barn-brace'),a=doorAperture(door,true);expect(a.width).toBe(912);expect(a.offset).toBe(475);expect(doorAperture({...door,rotation:180},true).offset).toBe(-475);expect(doorAperture({...door,rotation:90},false).offset).toBe(-475);
  const wall={id:'edge',ax:0,az:0,bx:24,bz:0};const parts=windowWallPieces(wall,250,2700,[door]);expect(parts.reduce((sum,p)=>sum+(p.end-p.start)*(p.top-p.bottom),0)).toBeCloseTo(6000*2700-(a.width-50)*(a.height-25));
 });
 it('preserves open position through history and sharing without rebuilding architecture',()=>{
  const p=plan();p.furniture=[snapWindow(p,item('door-pocket-shaker'))];usePlanner.getState().replacePlan(p);const key=architectureKey(p,'floor','select');usePlanner.getState().updateFurniture(p.furniture[0].id,{openFraction:.65});const saved=usePlanner.getState().plan;
  expect(saved.furniture[0].openFraction).toBe(.65);expect(architectureKey(saved,'floor','select')).toBe(key);expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);expect(decodeShare(encodeShare(saved)).furniture).toEqual(saved.furniture);usePlanner.getState().undo();expect(usePlanner.getState().plan.furniture[0].openFraction).toBeUndefined();usePlanner.getState().redo();expect(usePlanner.getState().plan.furniture[0].openFraction).toBe(.65);
  for(const openFraction of [-1,1.1,NaN])expect(()=>validatePlan({...p,furniture:[{...p.furniture[0],openFraction}]})).toThrow();
 });
 it('imports sliding leaves independently and moves cloned leaves without moving the fixed casing',async()=>{
  for(const id of slidingDoorIds){const engine=new NullEngine(),scene=new Scene(engine);try{
   const asset=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});const root=new TransformNode('placed',scene);const instance=asset.instantiateModelsToScene(n=>'placed:'+n,false,{doNotInstantiate:true});instance.rootNodes.forEach(n=>n.parent=root);const leaves=root.getDescendants(false).filter(n=>motionData(n).motion_role==='sliding_leaf'&&!motionData(n.parent).motion_role) as TransformNode[];expect(leaves.length,id).toBeGreaterThan(0);const before=leaves.map(n=>n.position.clone());const fixed=root.getChildMeshes().find(n=>!motionData(n).motion_role&&!motionData(n.parent).motion_role)!;const fixedPosition=fixed.position.clone();positionSlidingLeaves(root,1);
   leaves.forEach((leaf,i)=>expect(leaf.position.x-before[i].x,id).toBeCloseTo(motionData(leaf).slide_travel));expect(fixed.position.equals(fixedPosition)).toBe(true);expect(leaves.some((n,i)=>!n.position.equals(before[i])),id).toBe(true);
  }finally{scene.dispose();engine.dispose();}}
 });
});
