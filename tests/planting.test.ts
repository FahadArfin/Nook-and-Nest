import {describe,it,expect,vi} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {PointerEventTypes} from '@babylonjs/core/Events/pointerEvents';
import {SceneController} from '../src/scene/SceneController';
import {scatterPlants} from '../src/planting';
import {createSamplePlan,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {usePlanner} from '../src/store';
import {terrainSampler} from '../src/terrain';
const brush={catalogId:'grass-clump',radius:2,spacing:.5};
describe('garden planting brush',()=>{
 it('turns a Babylon pointer stroke into a visible uncommitted preview',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),s=usePlanner.getState();s.replacePlan(createSamplePlan());s.cancelPlanting();s.setPlantingBrush(brush);
  const controller:any=Object.create(SceneController.prototype);controller.plantingNodes=new Map();controller.plantingItems=[];controller.activePlan=usePlanner.getState().plan;controller.furnitureModels={build:vi.fn(()=>false)};controller.furnitureFactory={build:(node:any)=>{const m=MeshBuilder.CreateBox('plant',{},scene);m.parent=node}};controller.shadow={removeShadowCaster:vi.fn()};controller.scene=scene;controller.tool='planting';controller.canvas={setPointerCapture:vi.fn()};controller.camera={detachControl:vi.fn(),attachControl:vi.fn()};
  vi.spyOn(scene,'createPickingRay').mockReturnValue({origin:new Vector3(-5,10,-5),direction:new Vector3(0,-1,0)} as any);
  try{controller.bindPointers();const fire=(type:number)=>scene.onPointerObservable.notifyObservers({type,event:{button:0,pointerId:1},pickInfo:null} as any);
   fire(PointerEventTypes.POINTERDOWN);expect(controller.plantingNodes.size).toBeGreaterThan(0);for(const {node} of controller.plantingNodes.values())expect(node.getChildMeshes()[0].isPickable).toBe(false);expect(usePlanner.getState().plan.furniture).toHaveLength(0);
   fire(PointerEventTypes.POINTERUP);expect(controller.camera.attachControl).toHaveBeenCalled();expect(usePlanner.getState().plantingDraft?.items.length).toBeGreaterThan(0);expect(usePlanner.getState().plan.furniture).toHaveLength(0);s.confirmPlanting();expect(usePlanner.getState().plan.furniture.length).toBeGreaterThan(0);
  }finally{scene.dispose();engine.dispose();s.cancelPlanting();}
 });
 it('previews deterministic bounded nonduplicate drifts and respects spacing',()=>{
  const p=createSamplePlan(),points=[{x:-5,z:-5},{x:-5,z:-5},{x:-4,z:-5}];
  const a=scatterPlants(p,points,brush);expect(a.length).toBeGreaterThan(20);expect(a.length).toBeLessThanOrEqual(64);expect(new Set(a.map(p=>p.id)).size).toBe(a.length);expect(scatterPlants(p,points,brush)).toEqual(a);
  expect(scatterPlants(p,points,{...brush,spacing:1.5}).length).toBeLessThan(a.length);
 });
 it('protects buildings, existing furniture and water, and rests on terrain',()=>{
  const p=createSamplePlan();p.environment={background:'plain',grass:'off',terrain:[{kind:'raise',radius:3,strength:1,points:[{x:-5,z:-5}]}]};
  const a=scatterPlants(p,[{x:-5,z:-5}],brush),sample=terrainSampler(p);expect(a.length).toBeGreaterThan(0);
  for(const item of a)expect(item.elevationMm!+p.floors[0].elevationMm+50).toBeCloseTo(sample(item.x/1000,item.z/1000).height*1000,-1);
  p.furniture=a;expect(scatterPlants(p,[{x:-5,z:-5}],brush)).toHaveLength(0);
  p.furniture=[];p.environment.terrain=[{kind:'river',radius:8,strength:1,points:[{x:-5,z:-5}]}];expect(scatterPlants(p,[{x:-5,z:-5}],brush)).toHaveLength(0);
  expect(scatterPlants(p,[{x:1,z:1}],{...brush,radius:.5})).toHaveLength(0);
 });
 it('confirms once, supports cancel and one-step undo, and roundtrips through saves',()=>{
  const s=usePlanner.getState();s.replacePlan(createSamplePlan());s.setPlantingBrush(brush);const before=usePlanner.getState().plan;
  s.previewPlanting([{x:-5,z:-5}]);expect(usePlanner.getState().plan).toBe(before);s.cancelPlanting();expect(usePlanner.getState().plan).toBe(before);
  s.previewPlanting([{x:-5,z:-5}]);s.confirmPlanting();const after=usePlanner.getState().plan;expect(after.furniture.length).toBeGreaterThan(20);expect(usePlanner.getState().past).toHaveLength(1);expect(parsePlan(serializePlan(after))).toEqual(after);expect(decodeShare(encodeShare(after)).furniture).toEqual(after.furniture);s.undo();expect(usePlanner.getState().plan.furniture).toHaveLength(0);s.redo();expect(usePlanner.getState().plan).toEqual(after);
 });
 it('rejects stale previews and stays within the saved furniture budget',()=>{
  const s=usePlanner.getState();s.replacePlan(createSamplePlan());s.previewPlanting([{x:-5,z:-5}]);s.rename('Changed');s.confirmPlanting();expect(usePlanner.getState().plan.furniture).toHaveLength(0);expect(usePlanner.getState().placementNotice).toContain('changed');
  const p=createSamplePlan(),one=scatterPlants(p,[{x:-20,z:-20}],brush)[0];p.furniture=Array.from({length:1998},(_,i)=>({...one,id:`old-${i}`,x:40000,z:40000}));expect(scatterPlants(p,[{x:-5,z:-5}],brush)).toHaveLength(2);
  expect(scatterPlants(p,[{x:NaN,z:0}],brush)).toHaveLength(0);expect(scatterPlants(p,[{x:-5,z:-5}],{...brush,catalogId:'sofa'})).toHaveLength(0);
 });
});
