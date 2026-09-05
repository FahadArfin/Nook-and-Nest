import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {catalog,isSurfaceMounted} from '../src/catalog';
import {cozyRows} from '../src/cozyCatalog';
import {createSamplePlan,serializePlan,parsePlan,encodeShare,decodeShare} from '../src/domain';
import {tabletopChoices} from '../src/tabletop';
import {terrainSampler,terrainRay} from '../src/terrain';
import {architectureKey} from '../src/sceneUpdate';
import {usePlanner} from '../src/store';
import {validatePlan} from '../src/planValidation';
import type {FurniturePlacement} from '../src/types';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {SceneController} from '../src/scene/SceneController';
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId,x:2000,z:2000,rotation:90,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};};
describe('cozy expansion and placement regressions',()=>{
 it('ships every addition as an editable, dimensioned model and rendered preview',()=>{
  expect(cozyRows).toHaveLength(52);
  for(const [id,,,w,d,h] of cozyRows){
   expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.png`),id).toBe(true);
   const b=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
   const bounds=g.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>g.accessors[p.attributes.POSITION]));
   for(const [axis,size] of [w,h,d].entries()){const low=Math.min(...bounds.map((a:any)=>a.min[axis])),high=Math.max(...bounds.map((a:any)=>a.max[axis]));expect((high-low)*1000,id).toBeCloseTo(size,0);}
   expect(g.accessors.filter((a:any)=>a.type==='SCALAR').reduce((n:number,a:any)=>n+a.count/3,0),id).toBeLessThan(60000);
  }
 });
 it('places every TV on a fitting rotated stand including the original TV',()=>{
   const p=createSamplePlan(),floor=p.floors[0].id;const stand=piece('open-media-bench',floor);stand.elevationMm=100;p.furniture=[stand];
   for(const id of ['slim-tv','tv-55','tv-65','tv-75']){expect(isSurfaceMounted(id)).toBe(true);expect(tabletopChoices(p,piece(id,floor))[0]?.placement).toEqual({x:2000,z:2000,rotation:90,elevationMm:480});}
   stand.widthMm=500;expect(tabletopChoices(p,piece('tv-75',floor))).toHaveLength(0);
 });
 it('keeps architecture stable during ordinary furniture movement, colors and selection',()=>{
   const p=createSamplePlan(),id=p.floors[0].id;p.furniture=[piece('tv-55',id)];const key=architectureKey(p,id,'select');
   p.furniture[0].x+=500;p.furniture[0].variant='navy';expect(architectureKey(p,id,'select')).toBe(key);
   p.floors[0].cells.push({x:99,z:99});expect(architectureKey(p,id,'select')).not.toBe(key);
 });
 it('retains real Babylon floor and furniture meshes over repeated movement and selection',()=>{
   const engine=new NullEngine(),scene=new Scene(engine);
   try{
     const p=createSamplePlan(),id=p.floors[0].id,item=piece('tv-55',id);p.furniture=[item];
     const floor=MeshBuilder.CreateBox('existing-floor',{},scene),node=new TransformNode('item:tv-55',scene),model=MeshBuilder.CreateBox('tv-model',{},scene);model.parent=node;
     const renderer=Object.create(SceneController.prototype) as any;
     Object.assign(renderer,{scene,tool:'select',architectureStamp:architectureKey(p,id,'select'),terrain:{update:()=>{}},outdoors:{update:()=>{}},furnitureNodes:new Map([[item.id,{node,signature:JSON.stringify({...item,x:0,z:0,rotation:0,elevationMm:0})}]])});
     for(let i=0;i<100;i++){const next={...p,furniture:[{...item,x:2000+i*10}]};renderer.update(next,id,i%2?item.id:undefined);}
     expect(scene.meshes).toHaveLength(2);expect(floor.isDisposed()).toBe(false);expect(model.isDisposed()).toBe(false);expect(node.position.x).toBeCloseTo(2.99);expect(model.isPickable).toBe(true);
   }finally{scene.dispose();engine.dispose();}
 });
 it('sculpts terrain, protects foundations, and places on actual terrain height',()=>{
   const p=createSamplePlan();p.environment={background:'plain',grass:'off',terrain:[{kind:'raise',radius:3,strength:1,points:[{x:-6,z:-6}]}]};
   expect(terrainSampler(p)(-6,-6).height).toBeCloseTo(.85);expect(terrainSampler(p)(-20,-20).height).toBe(-.15);
   expect(terrainRay(p,{x:-6,y:10,z:-6},{x:0,y:-1,z:0})?.y).toBeCloseTo(.85);
   const cell=p.floors[0].cells[0],x=(cell.x+.5)*p.gridSizeMm/1000,z=(cell.z+.5)*p.gridSizeMm/1000;p.environment.terrain![0].points=[{x,z}];expect(terrainSampler(p)(x,z).height).toBe(-.15);
 });
 it('saves rivers through undo, backup and sharing and rejects malformed strokes',()=>{
   const p=createSamplePlan();usePlanner.getState().replacePlan(p);usePlanner.getState().addTerrainStroke({kind:'river',radius:2,strength:.6,points:[{x:-8,z:-8},{x:-3,z:-8}]});
   const saved=usePlanner.getState().plan;expect(terrainSampler(saved)(-6,-8).water).toBe(true);expect(terrainSampler(saved)(-6,-8).height).toBeCloseTo(-.75);
   expect(parsePlan(serializePlan(saved)).environment).toEqual(saved.environment);expect(decodeShare(encodeShare(saved)).environment).toEqual(saved.environment);
   usePlanner.getState().undo();expect(usePlanner.getState().plan.environment?.terrain).toBeUndefined();usePlanner.getState().redo();expect(usePlanner.getState().plan.environment).toEqual(saved.environment);
   expect(()=>validatePlan({...saved,environment:{...saved.environment,terrain:[{kind:'river',radius:Infinity,strength:1,points:[]}]}})).toThrow();
 });
});
