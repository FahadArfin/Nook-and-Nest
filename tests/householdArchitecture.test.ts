import {describe,it,expect} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {Ray} from '@babylonjs/core/Culling/ray';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {createSamplePlan,rectangleCells,serializePlan,parsePlan} from '../src/domain';
import {shapeArea} from '../src/polygonGeometry';
import {floorRects,addMeasuredRegion,measuredRegion} from '../src/floorGeometry';
import {stairHoles,visibleFloorRects,fitStair,stairWarnings} from '../src/building';
import {canWalkAt,createWalkBounds} from '../src/walkthrough';
import {snapWindow,windowProblem,windowWallPieces,windowRotation} from '../src/windows';
import {usePlanner} from '../src/store';
import {architectureKey} from '../src/sceneUpdate';
import {createHouseholdArchitectureReview} from '../src/householdArchitectureReview';
import {createFlatRoof,setFlatRoofPresentation} from '../src/scene/HouseholdRoof';
import {PlacementController,type PlacementControllerHost} from '../src/scene/PlacementController';
import {WallVisibilityController} from '../src/wallVisibility';
import {architectureWallAnchor,placementFromWallAnchor,garageDoorProblem,garageDoorAperture,fitRoofSkylight,flatRoofRects,roofHostFloor,roofSkylightProblem,roofPlacementPoint,snapStormDoor,stormDoorProblem,syncStormDoors,spiralStairHole} from '../src/householdArchitecture';
import type {FurniturePlacement} from '../src/types';

function home(){
  const p=createSamplePlan('Architecture studies','metric');p.gridSizeMm=1000;
  p.floors=[{...p.floors[0],id:'ground',elevationMm:0,heightMm:2600,cells:rectangleCells(7,7),walls:[],openings:[]}];
  p.furniture=[];p.environment={background:'plain',grass:'off'};return p;
}
const piece=(catalogId:string,dimensions:[number,number,number],patch:Partial<FurniturePlacement>={}):FurniturePlacement=>({id:catalogId,catalogId,floorId:'ground',x:3500,z:3500,rotation:0,widthMm:dimensions[0],depthMm:dimensions[1],heightMm:dimensions[2],variant:'sage',...patch});
const skylight=()=>piece('roof-skylight',[900,1200,260]);
const storm=()=>piece('secondary-storm-screen-door',[950,165,2130],{x:3000,z:150});
const garage=()=>piece('sectional-garage-door',[2850,2700,2400],{x:3500,z:0,rotation:180});
const spiral=()=>piece('spiral-staircase',[2200,2200,3700],{toFloorId:'upper',stairRiseMm:2800});
const area=(parts:Parameters<typeof shapeArea>[0][])=>parts.reduce((n,p)=>n+shapeArea(p),0);

describe('roof and hosted architecture',()=>{
  it('provides a saved-compatible two-floor browser fixture with valid architectural hosts',()=>{
    const p=createHouseholdArchitectureReview();expect(p.floors).toHaveLength(2);expect(p.furniture).toHaveLength(5);
    expect(parsePlan(serializePlan(p))).toEqual(p);
    for(const item of p.furniture)expect(windowProblem(p,item),item.catalogId).toBeUndefined();
    const stair=p.furniture.find(p=>p.catalogId==='spiral-staircase')!;
    expect(stair.toFloorId).toBe(p.floors[1].id);expect(stairWarnings(p,stair).join(' ')).not.toMatch(/not fully supported/);
  });
  it('keeps legacy plans roof-free and cuts a real reversible roof aperture only after opt-in',()=>{
    const p=home(),before=serializePlan(p);expect(flatRoofRects(p,'ground')).toEqual([]);
    expect(roofSkylightProblem(p,skylight())).toMatch(/Enable Flat roof/);
    p.environment={...p.environment!,flatRoof:true};const item=fitRoofSkylight(p,skylight());p.furniture=[item];
    expect(item.elevationMm!+50+160).toBe(2700);
    expect(roofSkylightProblem(p,item)).toBeUndefined();
    expect(roofSkylightProblem(p,{...item,elevationMm:0})).toMatch(/mounting plane/);
    expect(flatRoofRects({...p,furniture:[{...item,elevationMm:0}]},'ground').reduce((n,r)=>n+shapeArea(r),0)).toBe(49_000_000);
    expect(area(flatRoofRects(p,'ground'))).toBeCloseTo(49_000_000-748*1048,2);
    expect(floorRects(p.floors[0],1000)).toHaveLength(49);
    expect(parsePlan(serializePlan(p))).toEqual(p);
    p.furniture=[];expect(area(flatRoofRects(p,'ground'))).toBe(49_000_000);
    expect(JSON.parse(before).environment?.flatRoof).toBeUndefined();
  });
  it('rejects unsupported curbs, overlapping skylights and non-roof floors; ray picking uses roof height',()=>{
    const p=home();p.environment={...p.environment!,flatRoof:true};
    p.floors.push({...p.floors[0],id:'upper',elevationMm:2800});
    expect(roofHostFloor(p)?.id).toBe('upper');expect(roofSkylightProblem(p,skylight())).toMatch(/highest/);
    const item=fitRoofSkylight(p,{...skylight(),floorId:'upper'});p.furniture=[item];
    expect(roofSkylightProblem(p,{...item,id:'overlap',x:item.x+400})).toMatch(/overlaps/);
    expect(roofSkylightProblem(p,{...item,id:'edge',x:200})).toMatch(/full skylight curb/);
    const hit=roofPlacementPoint(p,{...item,id:'draft'},{x:1.5,y:10,z:1.5},{x:0,y:-1,z:0});
    expect(hit).toMatchObject({x:1500,z:1500,elevationMm:2490});
    expect(roofPlacementPoint(p,item,{x:1.5,y:10,z:1.5},{x:0,y:0,z:1})).toBeUndefined();
  });
  it('renders an opt-in 100 mm roof with an empty skylight shaft and preserves dollhouse visibility',()=>{
    const p=home(),engine=new NullEngine(),scene=new Scene(engine);
    try{
      expect(createFlatRoof(scene,p,p.floors[0])).toBeUndefined();p.environment={...p.environment!,flatRoof:true};p.furniture=[fitRoofSkylight(p,skylight())];
      const roof=createFlatRoof(scene,p,p.floors[0])!;roof.computeWorldMatrix(true);
      expect(roof.getBoundingInfo().boundingBox.extendSizeWorld.y*2).toBeCloseTo(.1);
      expect(new Ray(new Vector3(3.5,10,3.5),new Vector3(0,-1,0)).intersectsMesh(roof).hit).toBe(false);
      expect(new Ray(new Vector3(1,10,1),new Vector3(0,-1,0)).intersectsMesh(roof).hit).toBe(true);
      expect(roof.material).toMatchObject({disableColorWrite:true,disableDepthWrite:true});
      setFlatRoofPresentation(roof,'review');expect(roof.material).toMatchObject({disableColorWrite:false,alpha:.26});
      setFlatRoofPresentation(roof,'walkthrough');expect(roof.material).toMatchObject({disableColorWrite:false,disableDepthWrite:false,alpha:1});
      const mat=roof.material!;roof.dispose();expect(scene.materials).not.toContain(mat);
    }finally{scene.dispose();engine.dispose();}
  });
  it('matches a secondary screen leaf to a real doorway and moves/removes it with its host',()=>{
    const p=home(),host=piece('door-shaker',[900,100,2100],{id:'entry',x:3000,z:0});p.furniture=[host];
    const leaf=snapStormDoor(p,storm());expect(leaf).toMatchObject({hostDoorId:'entry',widthMm:900,heightMm:2100,x:3000,z:147.5});
    expect(stormDoorProblem(p,leaf)).toBeUndefined();p.furniture.push(leaf);
    expect(stormDoorProblem(p,{...leaf,id:'duplicate'})).toMatch(/already/);
    const flipped=snapStormDoor(p,{...leaf,id:'back',rotation:180});expect(flipped.z).toBeCloseTo(-147.5);expect(stormDoorProblem(p,flipped)).toBeUndefined();
    p.furniture[0]={...host,x:4500};const moved=syncStormDoors(p);expect(moved.furniture[1].x).toBe(4500);
    expect(p.furniture[1].x).toBe(3000);expect(syncStormDoors(moved)).toBe(moved);
    expect(syncStormDoors({...moved,furniture:moved.furniture.slice(1)}).furniture).toEqual([]);
    expect(stormDoorProblem(home(),storm())).toMatch(/existing entry/);
  });
  it('rehosts a dragged screen only on a visible doorway and preserves the host through preview movement',()=>{
    const p=home();p.camera.wallVisibility='all-visible';
    p.furniture=[piece('door-shaker',[900,100,2100],{id:'first',x:1500,z:0}),piece('door-shaker',[900,100,2100],{id:'second',x:5000,z:0})];
    const leaf=snapStormDoor(p,{...storm(),x:1500}),origin=new Vector3(5,5,.2);
    const host={activePlan:p,activeFloorId:'ground',activeDraft:leaf,wallVisibility:new WallVisibilityController(),camera:{position:new Vector3(4,8,-8),target:new Vector3(3.5,0,3.5)},scene:{createPickingRay:()=>new Ray(origin.clone(),new Vector3(0,-1,0))},previewNode:{position:Vector3.Zero(),rotation:Vector3.Zero()}} as unknown as PlacementControllerHost;
    const controller=new PlacementController(host),hit=controller.positionForItem(0,0,leaf);
    expect(hit).toMatchObject({hostDoorId:'second',x:5000,z:147.5,elevationMm:0});
    controller.applyPreviewPosition(hit!);expect(host.draftPosition?.hostDoorId).toBe('second');expect(host.previewNode?.position.y).toBe(0);
    p.camera.wallVisibility='all-hidden';expect(controller.positionForItem(0,0,leaf)).toBeUndefined();
    p.camera.wallVisibility='all-visible';origin.set(3.5,5,3.5);expect(controller.positionForItem(0,0,leaf)).toBeUndefined();
    expect(host.draftPosition?.hostDoorId).toBe('second');
  });
  it('anchors the garage leaf independently from its overhead tracks and validates room clearance',()=>{
    const p=home(),anchor=garage(),item=placementFromWallAnchor(anchor);
    expect(item.z).toBeCloseTo(1259);expect(architectureWallAnchor(item).z).toBeCloseTo(0);
    expect(architectureWallAnchor(item).x).toBeCloseTo(anchor.x);
    expect(garageDoorAperture(item)).toEqual({width:2700,height:2130,offset:0});
    expect(garageDoorProblem(p,item)).toBeUndefined();
    expect(garageDoorProblem(p,placementFromWallAnchor({...anchor,rotation:0}))).toMatch(/tracks/);
    expect(garageDoorProblem(p,{...item,heightMm:2600})).toMatch(/wall height/);
    p.floors[0].walls=[{id:'track-obstruction',ax:0,az:1,bx:7,bz:1}];
    expect(garageDoorProblem(p,item)).toMatch(/inside wall/);
    p.floors[0].walls[0].heightMm=1400;expect(garageDoorProblem(p,item)).toBeUndefined();
    p.floors[0]=addMeasuredRegion({...p.floors[0],cells:[],walls:[],cellRects:undefined},1000,measuredRegion(1000,{x:0,z:0},7000,2550));
    expect(garageDoorProblem(p,item)).toMatch(/tracks must fit/);
    for(const rotation of [0,90,180,270]){
      const result=architectureWallAnchor(placementFromWallAnchor({...anchor,rotation}));expect(result.x).toBeCloseTo(anchor.x);expect(result.z).toBeCloseTo(anchor.z);
    }
  });
  it('cuts one doorway for a hosted screen and the correct garage opening at every facing',()=>{
    const p=home(),wall={id:'front',ax:0,az:0,bx:7,bz:0};
    const host=snapWindow(p,piece('door-shaker',[950,160,2150],{id:'entry',x:3000,z:3}));p.furniture=[host];
    const leaf=snapWindow(p,storm());expect(windowProblem(p,leaf)).toBeUndefined();
    expect(windowWallPieces(wall,1000,2600,[host,leaf])).toEqual(windowWallPieces(wall,1000,2600,[host]));
    expect(windowRotation(leaf,15)).toBe(180);
    p.furniture=[];
    const item=snapWindow(p,placementFromWallAnchor(garage()));expect(windowProblem(p,item)).toBeUndefined();
    const pieces=windowWallPieces(wall,1000,2600,[item]);
    expect(pieces.some(r=>r.start<3500&&r.end>3500&&r.bottom===0)).toBe(false);
    expect(pieces.find(r=>r.start<3500&&r.end>3500)?.bottom).toBe(2105);
    expect(pieces.find(r=>r.start<3500&&r.end>3500)?.start).toBe(2175);
    const side=snapWindow(p,placementFromWallAnchor({...garage(),rotation:270,x:0,z:3500}));
    expect(windowProblem(p,side)).toBeUndefined();expect(architectureWallAnchor(side).x).toBeCloseTo(0);
    expect(windowWallPieces({id:'side',ax:0,az:0,bx:0,bz:7},1000,2600,[side]).find(r=>r.start<3500&&r.end>3500)?.bottom).toBe(2105);
  });
  it('keeps host edits, screen flips and removals in one undo step and roundtrips their relationship',()=>{
    const s=usePlanner.getState(),p=home();s.replacePlan(p);
    const host=snapWindow(p,piece('door-shaker',[950,160,2150],{id:'entry',x:3000,z:0}));s.confirmFurniture(host);s.confirmFurniture(storm());
    expect(usePlanner.getState().plan.furniture).toHaveLength(2);const before=structuredClone(usePlanner.getState().plan),past=usePlanner.getState().past.length;
    s.updateFurniture(host.id,{x:4500});expect(usePlanner.getState().past).toHaveLength(past+1);
    expect(usePlanner.getState().plan.furniture[1].x).toBe(4500);s.undo();expect(usePlanner.getState().plan).toEqual(before);s.redo();
    const leaf=usePlanner.getState().plan.furniture[1];s.updateFurniture(leaf.id,{rotation:180});
    expect(usePlanner.getState().plan.furniture[1]).toMatchObject({rotation:180,hostDoorId:'entry'});
    expect(usePlanner.getState().plan.furniture[1].z).toBeLessThan(0);
    expect(parsePlan(serializePlan(usePlanner.getState().plan))).toEqual(usePlanner.getState().plan);
    s.select(host.id);s.deleteSelected();expect(usePlanner.getState().plan.furniture).toEqual([]);
    s.undo();expect(usePlanner.getState().plan.furniture).toHaveLength(2);
  });
  it('keeps held turns atomic and remaps both door IDs when duplicating a floor',()=>{
    const s=usePlanner.getState(),p=home();s.replacePlan(p);
    s.confirmFurniture(snapWindow(p,piece('door-shaker',[950,160,2150],{id:'entry',x:3000,z:0})));s.confirmFurniture(storm());
    const before=structuredClone(usePlanner.getState().plan),past=usePlanner.getState().past.length;
    s.beginTurn('secondary-storm-screen-door');s.turnFurniture('secondary-storm-screen-door',15);s.finishTurn();
    expect(usePlanner.getState().plan.furniture[1].rotation).toBe(180);expect(usePlanner.getState().past).toHaveLength(past+1);
    s.undo();expect(usePlanner.getState().plan).toEqual(before);
    s.duplicateFloor('ground');const after=usePlanner.getState().plan,copies=after.furniture.filter(p=>p.floorId!=='ground');
    expect(copies).toHaveLength(2);expect(copies[1].hostDoorId).toBe(copies[0].id);expect(copies[1].hostDoorId).not.toBe('entry');
    expect(parsePlan(serializePlan(after))).toEqual(after);s.undo();expect(usePlanner.getState().plan).toEqual(before);
    const invalid=structuredClone(before);invalid.furniture[0].catalogId='door-pocket';expect(()=>parsePlan(JSON.stringify(invalid))).toThrow(/valid/);
  });
  it('keeps confirmed skylights attached to the roof after ceiling edits, with reversible placement',()=>{
    const p=home(),s=usePlanner.getState();s.replacePlan(p);s.confirmFurniture(skylight());
    expect(usePlanner.getState().plan.furniture).toEqual([]);expect(usePlanner.getState().past).toHaveLength(0);
    s.setEnvironment({flatRoof:true});s.confirmFurniture(skylight());
    const placed=structuredClone(usePlanner.getState().plan);expect(windowProblem(placed,placed.furniture[0])).toBeUndefined();
    s.setWallHeight(3000);expect(usePlanner.getState().plan.furniture[0].elevationMm).toBe(2890);
    s.undo();expect(usePlanner.getState().plan).toEqual(placed);
    s.select('roof-skylight');s.deleteSelected();expect(area(flatRoofRects(usePlanner.getState().plan,'ground'))).toBe(49_000_000);
    s.undo();expect(area(flatRoofRects(usePlanner.getState().plan,'ground'))).toBeCloseTo(49_000_000-748*1048,2);
  });
  it('invalidates roof geometry when roof settings or openings change, while keeping ordinary furniture edits independent',()=>{
    const p=home(),key=architectureKey(p,'ground','select');
    p.environment={...p.environment!,flatRoof:true};expect(architectureKey(p,'ground','select')).not.toBe(key);
    const roofKey=architectureKey(p,'ground','select');p.furniture=[snapWindow(p,skylight())];expect(architectureKey(p,'ground','select')).not.toBe(roofKey);
    const holeKey=architectureKey(p,'ground','select');p.furniture[0]={...p.furniture[0],x:4500};expect(architectureKey(p,'ground','select')).not.toBe(holeKey);
  });
});

describe('connected spiral layout',()=>{
  it('reserves a circular shaft, retains corner floor and blocks unsupported flat walkthrough routes',()=>{
    const p=home();p.floors.push({...p.floors[0],id:'upper',elevationMm:2800});const item=fitStair(p,spiral());p.furniture=[item];
    const hole=spiralStairHole(item);expect(hole.polygon).toHaveLength(64);
    expect(area(stairHoles(p,'upper'))).toBeCloseTo(shapeArea(hole),2);
    expect(area(visibleFloorRects(p,'upper'))).toBeCloseTo(49_000_000-shapeArea(hole),2);
    expect(shapeArea(hole)).toBeLessThan(hole.width*hole.depth);
    expect(canWalkAt(createWalkBounds(p,'ground')!,3.5,3.5)).toBe(false);
    expect(canWalkAt(createWalkBounds(p,'upper')!,3.5,3.5)).toBe(false);
    expect(canWalkAt(createWalkBounds(p,'upper')!,2.5,2.5)).toBe(true);
    expect(stairWarnings(p,item).join(' ')).toMatch(/ascent is not simulated/);
    expect(stairWarnings(p,item).join(' ')).not.toMatch(/too steep/);
    p.furniture=[];expect(area(visibleFloorRects(p,'upper'))).toBe(49_000_000);
  });
});
