// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {PointerEventTypes} from '@babylonjs/core/Events/pointerEvents';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {SceneController} from '../src/scene/SceneController';
import {WallVisibilityController} from '../src/wallVisibility';
import {createBlankPlan,rectangleCells,serializePlan,parsePlan} from '../src/domain';
import {catalog,defaultMountHeight,isKitchenWall} from '../src/catalog';
import {matchesFurniture} from '../src/library';
import {extendFurniture,moduleSegments} from '../src/modularFurniture';
import {snapWindow,windowProblem,fitToWall,snapEdgeFurniture} from '../src/windows';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';
const setup=()=>{const p=createBlankPlan();p.gridSizeMm=250;p.floors[0].cells=rectangleCells(20,16);p.camera.wallVisibility='all-visible';return p;};
const piece=(p:ReturnType<typeof setup>,id:string,patch:Partial<FurniturePlacement>={}):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:'item-'+id,catalogId:id,floorId:p.floors[0].id,x:2000,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'cream',elevationMm:defaultMountHeight(id),...patch};};
function renderer(){
 const engine=new NullEngine(),scene=new Scene(engine),camera=new ArcRotateCamera('camera',1,.6,10,new Vector3(2,0,2),scene);
 const r:any=Object.create(SceneController.prototype);
 Object.assign(r,{scene,camera,engine,canvas:{dataset:{},clientWidth:800,clientHeight:600},root:new TransformNode('root',scene),tool:'select',architectureStamp:'',refreshModels:new Set(),furnitureNodes:new Map(),solidMaterials:new Map(),surfaceMaterials:new Map(),floorWallGeometry:new Map(),selectedWallIds:new Set(),wallVisibility:new WallVisibilityController(),terrain:{update:vi.fn()},outdoors:{update:vi.fn()},shadow:{addShadowCaster:vi.fn()},surfaceMaterial:()=>new StandardMaterial('surface',scene),furnitureFactory:{resetMaterials:vi.fn()},furnitureModels:{build:vi.fn((node:TransformNode,_def:unknown,_item:unknown,w:number,d:number,h:number)=>{const m=MeshBuilder.CreateBox('model',{width:w,depth:d,height:h},scene);m.parent=node;return true})}});
 return {r,scene,dispose:()=>{scene.dispose();engine.dispose()}};
}
describe('modular placement regression',()=>{
 it('door intent returns every door including sliding patio, never outdoor pieces or fridges',()=>{
   for(const c of catalog)expect(matchesFurniture(c,'doors'),c.id).toBe(c.category==='Doors');
   expect(catalog.filter(c=>matchesFurniture(c,'sliding patio door')).length).toBeGreaterThan(0);
   expect(matchesFurniture(catalog.find(c=>c.id==='refrigerator')!,'fridges')).toBe(true);
 });
 it('fits the 2400 mm solarium in the default 2438 mm room and spans the wall',()=>{
   const p=setup(),w=snapWindow(p,piece(p,'window-solarium'));
   expect(w.elevationMm).toBe(0);expect(windowProblem(p,w)).toBeUndefined();
   const legacy=snapWindow(p,{...w,elevationMm:25});expect(legacy.elevationMm).toBe(13);expect(windowProblem(p,legacy)).toBeUndefined();
   const full=fitToWall(p,w);expect(full.widthMm).toBe(4960);expect(full.x).toBe(2500);expect(windowProblem(p,full)).toBeUndefined();
 });
 it('registers the original upper cabinet for wall mounting and follows pointer height',()=>{
   const p=setup(),c=snapWindow(p,piece(p,'wall-cabinet'));
   for(const model of catalog.filter(c=>c.category==='Kitchen'&&c.mount==='wall'))expect(isKitchenWall(model.id),model.id).toBe(true);
   expect(isKitchenWall(c.catalogId)).toBe(true);expect(c.elevationMm).toBe(1500);expect(c.z).toBe(c.depthMm/2+51);expect(windowProblem(p,c)).toBeUndefined();
   const {r,dispose}=renderer();try{r.activePlan=p;r.activeFloorId=p.floors[0].id;r.wallVisibility={allowsInteraction:()=>true};r.scene.createPickingRay=()=>({origin:new Vector3(2,2,3),direction:new Vector3(0,0,-1)});
     const hit=r.positionForItem(0,0,c);expect(hit.elevationMm).toBe(1570);expect(hit.rotation).toBe(0);expect(windowProblem(p,hit)).toBeUndefined();
   }finally{dispose()}
 });
 it('snaps cabinets flush to the same wall and neighbors, railings to cut-away balcony edges',()=>{
   const p=setup(),base=snapEdgeFurniture(p,piece(p,'base-cabinet',{z:300,rotation:8}));
   expect(base.rotation).toBe(0);expect(base.z).toBe(361);p.furniture=[base];
   const neighbor=snapEdgeFurniture(p,piece(p,'base-cabinet',{id:'second',x:2890,z:380,rotation:3}));expect(neighbor.x-base.x).toBe(base.widthMm);expect(neighbor.z).toBe(base.z);
   p.floors[0].wallCuts=[{id:'cut',ax:0,az:0,bx:20,bz:0}];
   const rail=snapEdgeFurniture(p,piece(p,'balcony-rail-glass',{z:80,rotation:5}));expect(rail.z).toBe(60);expect(rail.rotation).toBe(0);
 });
 it('anchors the opposite end at every angle and bounds repeated sections',()=>{
   const p=setup();for(const rotation of [0,90,180,270,37])for(const side of [-1,1] as const){const base=piece(p,'base-cabinet',{rotation}),next=extendFurniture(base,2400,side),a=rotation*Math.PI/180;
     expect(next.x-side*next.widthMm/2*Math.cos(a)).toBeCloseTo(base.x-side*base.widthMm/2*Math.cos(a));
     expect(next.z+side*next.widthMm/2*Math.sin(a)).toBeCloseTo(base.z+side*base.widthMm/2*Math.sin(a));
     const parts=moduleSegments(next);expect(parts.reduce((sum,p)=>sum+p.width,0)).toBeCloseTo(2400);expect(parts.every(p=>p.width<=base.widthMm)).toBe(true);
   }
 });
 it('saves an extension as one editable piece and one undo, preserving colors and old finishes',()=>{
   const p=setup(),base=snapWindow(p,piece(p,'wall-cabinet',{materialColors:{'variant-surface':'#abcdef'}}));p.furniture=[base];p.floors[0].wallFinishId='sage-plaster';usePlanner.getState().replacePlan(p);
   const next=extendFurniture(base,1600,1);usePlanner.getState().updateFurniture(base.id,next);
   const saved=usePlanner.getState().plan;expect(saved.furniture).toHaveLength(1);expect(parsePlan(serializePlan(saved)).furniture[0]).toMatchObject({id:base.id,moduleRun:true,widthMm:1600,materialColors:base.materialColors});expect(saved.floors[0].wallFinishId).toBe('sage-plaster');expect(usePlanner.getState().past).toHaveLength(1);usePlanner.getState().undo();expect(usePlanner.getState().plan.furniture[0].widthMm).toBe(800);
 });
 it('retains furniture and floor mesh identities when confirming an opening or changing a draft',()=>{
   const {r,scene,dispose}=renderer();try{
     const p=setup();p.furniture=[piece(p,'base-cabinet',{z:1000})];r.update(p,p.floors[0].id);
     const floor=scene.meshes.find(m=>m.name.startsWith('cell:'))!,cabinet=r.furnitureNodes.get(p.furniture[0].id).node,mesh=cabinet.getChildMeshes()[0];
     const window=snapWindow(p,piece(p,'window-solarium'));
     const next={...p,furniture:[...p.furniture,window]};r.update(next,p.floors[0].id);
     expect(floor.isDisposed()).toBe(false);expect(mesh.isDisposed()).toBe(false);expect(r.furnitureNodes.get(p.furniture[0].id).node).toBe(cabinet);
     r.update(next,p.floors[0].id,undefined,{...window,id:'draft'});const preview=r.previewNode,builds=r.furnitureModels.build.mock.calls.length;r.outdoors.update.mockClear();r.terrain.update.mockClear();
     for(let i=0;i<30;i++)r.update({...next,camera:{...next.camera}},p.floors[0].id,undefined,{...window,id:'draft',x:2000+i*5});
     expect(r.previewNode).toBe(preview);expect(r.furnitureModels.build.mock.calls).toHaveLength(builds);expect(r.outdoors.update).not.toHaveBeenCalled();expect(r.terrain.update).not.toHaveBeenCalled();expect(floor.isDisposed()).toBe(false);
   }finally{dispose()}
 });
 it('free mouse rotation keeps exact angles for base cabinets near a wall',()=>{const p=setup(),base=snapEdgeFurniture(p,piece(p,'base-cabinet',{z:300}));p.furniture=[base];usePlanner.getState().replacePlan(p);usePlanner.getState().updateFurniture(base.id,{rotation:37.5});expect(usePlanner.getState().plan.furniture[0].rotation).toBe(37.5);expect(usePlanner.getState().past).toHaveLength(1)});
 it('right-drag previews rotation without plan mutation and commits once on release',()=>{
   const {r,scene,dispose}=renderer();try{
     const p=setup(),base=piece(p,'base-cabinet',{z:1000});p.furniture=[base];r.update(p,p.floors[0].id,base.id);
     const onRotate=vi.fn();r.callbacks={onRotate};r.camera.attachControl=vi.fn();r.camera.detachControl=vi.fn();r.bindPointers();
     const send=(type:number,x:number,shift=false)=>scene.onPointerObservable.notifyObservers({type,event:{button:2,clientX:x,shiftKey:shift,preventDefault:()=>{}},pickInfo:null} as any);
     send(PointerEventTypes.POINTERDOWN,100);send(PointerEventTypes.POINTERMOVE,175);expect(r.selectedNode.rotation.y*180/Math.PI).toBeCloseTo(37.5);expect(onRotate).not.toHaveBeenCalled();
     send(PointerEventTypes.POINTERMOVE,180,true);expect(r.selectedNode.rotation.y*180/Math.PI).toBeCloseTo(45);
     send(PointerEventTypes.POINTERUP,180,true);expect(onRotate).toHaveBeenCalledExactlyOnceWith(base.id,45);expect(p.furniture[0].rotation).toBe(0);
   }finally{dispose()}
 });
 it('loading a different model retains all existing model nodes',()=>{
   const {r,dispose}=renderer();try{const p=setup();p.furniture=[piece(p,'base-cabinet',{z:1000})];r.update(p,p.floors[0].id);const node=r.furnitureNodes.get(p.furniture[0].id).node;r.refreshModels.add('window-solarium');r.update(p,p.floors[0].id);expect(r.furnitureNodes.get(p.furniture[0].id).node).toBe(node);expect(node.isDisposed()).toBe(false);}finally{dispose()}
 });

});
