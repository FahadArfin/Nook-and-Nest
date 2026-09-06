import {describe,it,expect} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {SceneController} from '../src/scene/SceneController';
import {createSamplePlan,rectangleCells,parsePlan,serializePlan} from '../src/domain';
import {blueprintPlan,draftFromFloor,autoFurnish,footprint,type BlueprintRoom} from '../src/blueprint';
import {floorBoundaryWalls} from '../src/floorGeometry';
import {removeWallSections} from '../src/wallConstruction';
import {wallRuns,snapWindow,windowProblem,windowWallPieces} from '../src/windows';
import {usePlanner} from '../src/store';
import {floorFinishes} from '../src/surfaces';
import {catalog} from '../src/catalog';
import type {FurniturePlacement} from '../src/types';
const setup=()=>{const p=createSamplePlan();p.gridSizeMm=250;p.floors=[{...p.floors[0],cells:rectangleCells(20,20),walls:[],openings:[],heightMm:2500}];p.furniture=[];return p};
const piece=(p:ReturnType<typeof setup>,id:string,x=2500,z=0):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:'test-'+id,catalogId:id,floorId:p.floors[0].id,x,z,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}};
describe('construction and furnishing improvements',()=>{
 it('cuts only the selected outside span, keeps the floor, and survives Studio and JSON round trips',()=>{
  const p=setup(),id=p.floors[0].id,rooms:BlueprintRoom[]=[{id:'balcony',name:'Balcony',kind:'Outdoor',enclosed:true,x:0,z:0,width:5000,depth:5000}];
  const original=blueprintPlan(p,id,{rooms,fixtures:[],walls:[],omittedWalls:[]});const result=removeWallSections(original,id,[{ax:4,az:0,bx:12,bz:0}],'balcony-rail-glass');
  expect(result.floors[0].cells).toEqual(original.floors[0].cells);expect(result.furniture).toHaveLength(2);expect(result.furniture.reduce((s,f)=>s+f.widthMm,0)).toBe(2000);
  const runs=wallRuns(result.floors[0],250).filter(r=>r.horizontal&&r.line===0);expect(runs.map(r=>[r.start,r.end])).toEqual([[0,1000],[3000,5000]]);
  const restored=parsePlan(serializePlan(result));const rebuilt=blueprintPlan(restored,id,draftFromFloor(restored,id));expect(wallRuns(rebuilt.floors[0],250)).toEqual(wallRuns(result.floors[0],250));
  usePlanner.getState().replacePlan(original);usePlanner.getState().cutWalls([{ax:4,az:0,bx:12,bz:0}],'balcony-rail-glass');expect(usePlanner.getState().past).toHaveLength(1);usePlanner.getState().undo();expect(usePlanner.getState().plan).toEqual(original);
  usePlanner.getState().redo();usePlanner.getState().addWall({ax:4,az:0,bx:12,bz:0});const closed=usePlanner.getState().plan;expect(closed.floors[0].wallCuts).toEqual([]);expect(blueprintPlan(closed,id,draftFromFloor(closed,id)).floors[0].walls.some(w=>w.az===0&&w.bz===0&&w.ax===4&&w.bx===12)).toBe(true);
 });
 it('removes a kitchen partition and its door without changing other furniture; ignores off-wall gestures',()=>{
  const p=setup(),id=p.floors[0].id;p.floors[0].walls=[{id:'kitchen-wall',ax:4,az:8,bx:16,bz:8}];p.furniture=[piece(p,'door-slim',2500,2000),piece(p,'refrigerator',1000,1000)];
  const result=removeWallSections(p,id,[{ax:7,az:8,bx:13,bz:8}]);expect(result.floors[0].walls).toHaveLength(2);expect(result.furniture.map(f=>f.catalogId)).toEqual(['refrigerator']);expect(p.furniture).toHaveLength(2);
  expect(removeWallSections(p,id,[{ax:0,az:3,bx:5,bz:3}],'balcony-rail-glass')).toBe(p);expect(()=>removeWallSections(p,id,[{ax:0,az:0,bx:1,bz:1}])).toThrow();
 });
 it('places a narrow closet door and cuts a real aperture in a 650 mm wall',()=>{
  const p=setup();p.floors[0].cells=[];p.floors[0].walls=[{id:'closet-front',ax:0,az:0,bx:2.6,bz:0}];
  expect(windowProblem(p,piece(p,'door-flush',325,0))).toMatch(/No wall/);const door=snapWindow(p,piece(p,'door-closet-single',325,20));expect(door.z).toBe(0);expect(windowProblem(p,door)).toBeUndefined();
  const parts=windowWallPieces(p.floors[0].walls[0],250,2500,[door]);expect(parts.some(w=>w.bottom===0&&w.start<325&&w.end>325)).toBe(false);
 });
 it('keeps solarium glazing close to floor and ceiling',()=>{const p=setup();p.floors[0].heightMm=2450;const w=snapWindow(p,piece(p,'window-solarium'));expect(w.elevationMm).toBe(25);expect(windowProblem(p,w)).toBeUndefined()});
 it('paints exactly 63 tiles and gives the old floor a different renderer material',()=>{
  const p=setup(),s=usePlanner.getState();s.replacePlan(p);const chosen=floorFinishes.find(f=>f.id!==p.floors[0].floorFinishId)!;s.finishCells(rectangleCells(9,7),chosen.id);const painted=usePlanner.getState().plan;expect(Object.keys(painted.floors[0].cellFinishes!)).toHaveLength(63);expect(painted.floors[0].floorFinishId).toBe(p.floors[0].floorFinishId);s.undo();expect(usePlanner.getState().plan).toEqual(p);
  const engine=new NullEngine(),scene=new Scene(engine);try{const renderer:any=Object.create(SceneController.prototype);Object.assign(renderer,{scene,solidMaterials:new Map(),surfaceMaterials:new Map()});const a=renderer.surfaceMaterial('same-floor',floorFinishes[0]),b=renderer.surfaceMaterial('same-floor',floorFinishes[1]);expect(a).not.toBe(b);expect(a.diffuseTexture.url).toBe(floorFinishes[0].texture);expect(b.diffuseTexture.url).toBe(floorFinishes[1].texture);expect(renderer.surfaceMaterial('same-floor',floorFinishes[0])).toBe(a)}finally{scene.dispose();engine.dispose()}
 });
 it.each(['Kitchen','Bathroom','Laundry','Living','Bedroom'] as const)('uses the %s room category and keeps saved fixtures',kind=>{
  const p=setup(),id=p.floors[0].id,rooms:BlueprintRoom[]=[{id:'room',name:kind,kind,enclosed:true,x:0,z:0,width:5000,depth:5000}],plan=blueprintPlan(p,id,{rooms,fixtures:[],walls:[],omittedWalls:[]}),result=autoFurnish(plan,id,rooms);
  const expected={Kitchen:['refrigerator','sink-cabinet','range-oven'],Bathroom:['alcove-bathtub','two-piece-toilet','pedestal-sink'],Laundry:['stacked-laundry'],Living:['sofa','tv-stand','tv-55'],Bedroom:['queen-bed']}[kind];for(const item of expected)expect(result.added.map(f=>f.catalogId)).toContain(item);
  expect(autoFurnish(result.plan,id,rooms).added).toHaveLength(0);
 });
});
