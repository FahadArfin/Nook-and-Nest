import {glbBounds} from './glbBounds';
import { describe,expect,it } from "vitest";
import { readFileSync,existsSync } from "node:fs";
import { createSamplePlan,parsePlan,serializePlan,decodeShare,encodeShare,deriveBoundaryWalls } from "../src/domain";
import { addMeasuredRegion,measuredRegion,floorRects,floorBoundaryWalls,parseRoomLength,paintFloorCells,subtractRect } from "../src/floorGeometry";
import { fitStair,stairFootprint,stairHoles,stairLandings,stairWarnings,visibleFloorRects } from "../src/building";
import { splitWallSections } from "../src/wallSections";
import { catalog,isDoor,isStairs,isWallOpening } from "../src/catalog";
import { snapWindow,windowProblem,windowWallPieces,windowRotation } from "../src/windows";
import { usePlanner } from "../src/store";
import type { FurniturePlacement, FloorPlan } from "../src/types";
import { NullEngine,Scene,TransformNode,Vector3,VertexBuffer } from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
const piece=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:crypto.randomUUID(),catalogId:id,floorId,x:2000,z:2000,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"sage"};};
const empty=():FloorPlan=>({...createSamplePlan().floors[0],cells:[]});
const area=(f:FloorPlan,grid:number)=>floorRects(f,grid).reduce((sum,r)=>sum+r.width*r.depth,0);

describe("measured rooms",()=>{
  it("reads decimal feet, feet/inches and metres without silent grid rounding",()=>{
    expect(parseRoomLength("12' 6\"","ft")).toBe(3810);expect(parseRoomLength("12.5","ft")).toBe(3810);expect(parseRoomLength("3.81","m")).toBe(3810);
    for(const text of ["-2","NaN","12' 15\"",""])expect(()=>parseRoomLength(text,"ft")).toThrow();
  });
  it("creates exact clipped edges and boundary walls at a non-grid room size",()=>{
    const f=addMeasuredRegion(empty(),250,measuredRegion(250,{x:0,z:0},3810,3050));
    expect(area(f,250)).toBe(3810*3050);const walls=floorBoundaryWalls(f,250);
    expect(Math.max(...walls.flatMap(w=>[w.ax,w.bx]))*250).toBeCloseTo(3810,1);
    expect(Math.max(...walls.flatMap(w=>[w.az,w.bz]))*250).toBeCloseTo(3050,1);
    const p=createSamplePlan();p.gridSizeMm=250;p.floors=[f];expect(parsePlan(serializePlan(p))).toEqual(p);expect(decodeShare(encodeShare(p)).floors).toEqual(p.floors);
  });
  it("unions crossing partial cells without inventing floor in an L-shaped gap",()=>{
    let f=addMeasuredRegion(empty(),250,measuredRegion(250,{x:0,z:0},100,250));
    f=addMeasuredRegion(f,250,measuredRegion(250,{x:0,z:0},250,100));
    expect(area(f,250)).toBe(40000);expect(floorRects(f,250).some(r=>r.x<=200&&r.x+r.width>200&&r.z<=200&&r.z+r.depth>200)).toBe(false);
    expect(floorBoundaryWalls(f,250).reduce((s,w)=>s+Math.hypot(w.ax-w.bx,w.az-w.bz)*250,0)).toBeCloseTo(1000,1);
  });
  it("preserves legacy boundary IDs, supports negative origins and clears clipped tiles",()=>{
    const f=createSamplePlan().floors[0];expect(floorBoundaryWalls(f,304.8)).toEqual(deriveBoundaryWalls(f.cells));
    const measured=addMeasuredRegion(empty(),250,measuredRegion(250,{x:-2,z:-3},810,550));expect(area(measured,250)).toBe(810*550);
    const painted=paintFloorCells(measured,[{x:1,z:-1}],true);expect(painted.cellRects?.["1,-1"]).toBeUndefined();
    const erased=paintFloorCells(measured,measured.cells,false);expect(floorBoundaryWalls(erased,250)).toEqual([]);
  });
  it("commits a whole measured room as one undo step and unit changes do not resize it",()=>{
    const s=usePlanner.getState(),p=createSamplePlan();p.floors=[empty()];p.gridSizeMm=250;s.replacePlan(p);
    s.addMeasuredRoom(measuredRegion(250,{x:0,z:0},3301,2877));const after=structuredClone(usePlanner.getState().plan);
    expect(usePlanner.getState().past).toHaveLength(1);s.undo();expect(usePlanner.getState().plan).toEqual(p);s.redo();expect(usePlanner.getState().plan).toEqual(after);
    s.setUnits("imperial");expect(usePlanner.getState().plan.gridSizeMm).toBe(250);expect(usePlanner.getState().plan.floors).toEqual(after.floors);
    expect(()=>measuredRegion(10,{x:0,z:0},60000,60000)).toThrow(/many tiles/);
  });
  it("rejects imported clipped rectangles outside their owning tile",()=>{
    const p=createSamplePlan();p.gridSizeMm=250;p.floors=[addMeasuredRegion(empty(),250,measuredRegion(250,{x:0,z:0},330,410))];
    p.floors[0].cellRects!["1,0"][0].x=8000;expect(()=>parsePlan(JSON.stringify(p))).toThrow();
  });
});
describe("wall sections and door openings",()=>{
  it("reads legacy strip keys but repaints the entire selected wall plate",()=>{
    const sections=splitWallSections("inside",[{start:0,end:2000,bottom:0,top:2500}],250);expect(sections).toHaveLength(8);expect(new Set(sections.map(s=>s.paintKey)).size).toBe(8);
    const s=usePlanner.getState(),p=createSamplePlan();p.floors[0].walls=[{id:"inside",ax:1,az:2,bx:7,bz:2}];p.floors[0].wallFinishes={"inside|2":"sage-plaster","inside|4":"cream-plaster"};s.replacePlan(p);s.finishWall("inside","terracotta-plaster");
    expect(usePlanner.getState().plan.floors[0].wallFinishes).toEqual({inside:"terracotta-plaster"});s.undo();expect(usePlanner.getState().plan.floors[0].wallFinishes).toEqual(p.floors[0].wallFinishes);
  });
  it("snaps a floor-level door, flips it, and cuts a real aperture across tile walls",()=>{
    const p=createSamplePlan(),id=p.floors[0].id,item=snapWindow(p,{...piece("door-shaker",id),x:1200,z:5});
    expect(item.z).toBe(0);expect(item.elevationMm).toBe(0);expect(windowProblem(p,item)).toBeUndefined();expect(windowRotation(item,15)).toBe(180);
    const pieces=windowWallPieces({id:"long",ax:0,az:0,bx:10,bz:0},p.gridSizeMm,2500,[item]);
    expect(pieces.some(r=>r.start<item.x&&r.end>item.x&&r.bottom===0)).toBe(false);
    expect(pieces.some(r=>r.start<item.x&&r.end>item.x&&r.top===2500)).toBe(true);
    p.furniture=[item];expect(windowProblem(p,{...item,id:"another"})).toMatch(/overlaps/);
  });
  it("keeps door IDs, finishes and openings through edit, undo and serialization",()=>{
    const p=createSamplePlan(),s=usePlanner.getState();s.replacePlan(p);const door=snapWindow(p,{...piece("door-french",p.floors[0].id),x:1800,z:0,surfaceVariant:"oak-door"});
    s.confirmFurniture(door);s.updateFurniture(door.id,{materialColors:{"door-frame":"#abcdef"}});s.undo();s.redo();const after=usePlanner.getState().plan;
    expect(parsePlan(serializePlan(after))).toEqual(after);expect(decodeShare(encodeShare(after)).furniture).toEqual(after.furniture);
    expect(windowProblem(p,{...door,heightMm:5000})).toMatch(/taller/);
  });
});
describe("connected staircase library",()=>{
  it("matches the floor rise and reserves a reversible hole without destroying tiles",()=>{
    const p=createSamplePlan(),s=usePlanner.getState();s.replacePlan(p);
    const stair=fitStair(p,{...piece("stairs-floating",p.floors[0].id),toFloorId:p.floors[1].id,x:1800,z:1800});s.confirmFurniture(stair);
    expect(stair.stairRiseMm).toBe(p.floors[1].elevationMm);expect(stairHoles(usePlanner.getState().plan,p.floors[1].id)).toHaveLength(1);
    const upper=p.floors[1],before=area(upper,p.gridSizeMm),after=visibleFloorRects(usePlanner.getState().plan,upper.id).reduce((s,r)=>s+r.width*r.depth,0);expect(after).toBeLessThan(before);
    expect(usePlanner.getState().plan.floors[1].cells).toEqual(upper.cells);s.select(stair.id);s.deleteSelected();expect(stairHoles(usePlanner.getState().plan,upper.id)).toEqual([]);s.undo();expect(stairHoles(usePlanner.getState().plan,upper.id)).toHaveLength(1);
    s.deleteFloor(upper.id);expect(usePlanner.getState().plan.furniture[0].toFloorId).toBeUndefined();s.undo();expect(usePlanner.getState().plan.furniture[0].toFloorId).toBe(upper.id);
  });
  it("rotates stair footprints in right angles, and warns about missing connections and short runs",()=>{
    const p=createSamplePlan(),stair=fitStair(p,{...piece("stairs-cantilever",p.floors[0].id),rotation:74,depthMm:900});
    expect(stair.rotation).toBe(90);expect(stairFootprint(stair).width).toBe(900);expect(windowRotation(stair,15)).toBe(180);
    expect(stairWarnings(p,stair).join(" ")).toMatch(/Not connected/);expect(stairWarnings(p,stair).join(" ")).toMatch(/too steep/);
    expect(subtractRect({x:0,z:0,width:100,depth:100},{x:25,z:25,width:50,depth:50}).reduce((s,r)=>s+r.width*r.depth,0)).toBe(7500);
  });
  it("keeps the unused L corner and aligns landing checks with each flight exit",()=>{
    const p=createSamplePlan(),l={...piece("stairs-l-turn",p.floors[0].id),toFloorId:p.floors[1].id,x:0,z:0};p.furniture=[l];
    const holes=stairHoles(p,p.floors[1].id);expect(holes).toHaveLength(2);expect(holes.reduce((sum,r)=>sum+r.width*r.depth,0)).toBe(5_400_000);
    const [lower,upper]=stairLandings(l);expect(lower.x).toBeLessThan(0);expect(lower.z+lower.depth).toBe(-1600);expect(upper.x).toBe(1600);
    const rotated=stairLandings({...l,rotation:90});expect(rotated[1].z+rotated[1].depth).toBeCloseTo(-1600);
    const u={...piece("stairs-switchback",p.floors[0].id),x:0,z:0},[uLower,uUpper]=stairLandings(u);expect(uLower.x).toBeLessThan(0);expect(uUpper.x).toBeGreaterThan(0);expect(uUpper.z).toBe(uLower.z);
    expect(isStairs("stairs-unknown")).toBe(false);expect(isDoor("door-unknown")).toBe(false);
  });
});
describe("Blender building collection",()=>{
  it("loads the exported staircase into Babylon with its upper exit aligned to the planning footprint",async()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try{
      for(const id of ["stairs-floating","stairs-l-turn","stairs-switchback"]){
        const container=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:".glb",pluginOptions:{gltf:{skipMaterials:true}}});
        const wrapper=new TransformNode("stair-orientation",scene);wrapper.rotation.y=Math.PI;
        for(const root of container.rootNodes)root.parent=wrapper;
        const points:Vector3[]=[];
        for(const mesh of container.meshes){const positions=mesh.getVerticesData(VertexBuffer.PositionKind);if(!positions)continue;const matrix=mesh.computeWorldMatrix(true);for(let i=0;i<positions.length;i+=3){const p=Vector3.TransformCoordinates(Vector3.FromArray(positions,i),matrix);if(Math.abs(p.y-2.8)<.0001)points.push(p);}}
        expect(points.length).toBeGreaterThan(0);
        if(id==="stairs-l-turn"){expect(Math.min(...points.map(p=>p.x))).toBeGreaterThan(1.30);expect(Math.min(...points.map(p=>p.z))).toBeGreaterThan(.59);}
        else if(id==="stairs-switchback"){expect(Math.min(...points.map(p=>p.x))).toBeGreaterThan(.09);expect(Math.max(...points.map(p=>p.z))).toBeLessThan(-1.25);}
        else expect(Math.min(...points.map(p=>p.z))).toBeGreaterThan(1.8);
        container.dispose();wrapper.dispose();
      }
    }finally{scene.dispose();engine.dispose();}
  });
  it("ships twenty-two distinct editable originals with physical GLB envelopes and thumbnails",()=>{
    const items=catalog.filter(c=>isDoor(c.id)||isStairs(c.id));expect(items).toHaveLength(22);
    for(const c of items){expect(existsSync(`assets-source/blender/${c.id}.blend`)).toBe(true);expect(existsSync(`public/models/previews/${c.id}.webp`)).toBe(true);
      const b=readFileSync(`public/models/furniture/${c.id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());const bounds=glbBounds(g);
      for(let a=0;a<3;a++){const min=Math.min(...bounds.map((b:any)=>b.min[a])),max=Math.max(...bounds.map((b:any)=>b.max[a]));expect((max-min)*1000,c.id).toBeCloseTo([c.widthMm,c.heightMm,c.depthMm][a],1);}
      expect(g.accessors.filter((a:any)=>a.type==="SCALAR").reduce((sum:number,a:any)=>sum+a.count/3,0),c.id).toBeLessThan(35000);
      expect(isWallOpening(c.id)).toBe(isDoor(c.id));
    }
  });
});
