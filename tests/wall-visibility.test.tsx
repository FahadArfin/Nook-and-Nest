// @vitest-environment jsdom
import React from "react";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createSamplePlan, decodeShare, encodeShare, parsePlan, serializePlan } from "../src/domain";
import { usePlanner, savePlan, loadPlan } from "../src/store";
import { cameraUpdatePolicy } from "../src/cameraPolicy";
import { WallVisibilityControl } from "../src/WallVisibilityControl";
import { getWallVisibility, isWallHidden, nextWallVisibility, openingHostWall, WallVisibilityController, type WallGeometry } from "../src/wallVisibility";
import { SceneController } from "../src/scene/SceneController";
import { catalog } from "../src/catalog";
import type { FurniturePlacement } from "../src/types";
import { snapWallStart,snapWallEnd,wallBetween,wallPlateIds,paintWallPlate } from "../src/wallEditing";
import { rectangleCells } from "../src/domain";
import { floorBoundaryWalls,addMeasuredRegion,measuredRegion } from "../src/floorGeometry";

const north: WallGeometry = {ax:0,az:0,bx:4,bz:0,boundary:true};
const east: WallGeometry = {ax:4,az:0,bx:4,bz:4,boundary:true};
const south: WallGeometry = {ax:4,az:4,bx:0,bz:4,boundary:true};
const west: WallGeometry = {ax:0,az:4,bx:0,bz:0,boundary:true};
const target = {x:2,z:2};
const state=()=>usePlanner.getState();
beforeEach(()=>state().replacePlan(createSamplePlan()));
afterEach(cleanup);

describe("three wall visibility modes",()=>{
  it("fades meshes smoothly, disables picking/shadows immediately and reverses without a jump",()=>{
    const mesh={visibility:.8,isPickable:true,setEnabled:vi.fn()},v=new WallVisibilityController();v.add(mesh,north);
    v.update("all-visible",{x:2,z:-6},target);
    v.update("near-hidden",{x:2,z:-6},target,325);
    expect(mesh.visibility).toBeCloseTo(.4);expect(mesh.isPickable).toBe(false);expect(v.allowsShadow(mesh)).toBe(false);expect(v.allowsInteraction(north)).toBe(false);
    v.update("near-hidden",{x:2,z:8},target,162.5);expect(mesh.visibility).toBeCloseTo(.6);expect(mesh.isPickable).toBe(false);
    v.update("near-hidden",{x:2,z:8},target,162.5);expect(mesh.visibility).toBeCloseTo(.8);expect(mesh.isPickable).toBe(true);
    v.update("near-hidden",{x:2,z:-6},target,650);expect(mesh.visibility).toBe(0);expect(mesh.setEnabled).toHaveBeenLastCalledWith(false);
  });
  it("retains a fade through scene rebuilds and respects reduced motion",()=>{
    const v=new WallVisibilityController(),mesh=()=>({visibility:1,isPickable:true,setEnabled:vi.fn()});v.add(mesh(),north);v.update("all-visible",{x:2,z:-6},target);
    v.update("near-hidden",{x:2,z:-6},target,325);v.clear(true);const rebuilt=mesh();v.add(rebuilt,north);
    v.update("near-hidden",{x:2,z:-6},target,0);expect(rebuilt.visibility).toBe(.5);
    v.update("near-hidden",{x:2,z:-6},target,0,true);expect(rebuilt.visibility).toBe(0);
  });
  it("places a window on the opposite visible wall, never the hidden front wall or floor fallback",()=>{
    const p=createSamplePlan();p.gridSizeMm=1000;p.floors[0].cells=rectangleCells(4,4);p.floors[0].walls=[];p.camera.wallVisibility="near-hidden";
    const def=catalog.find(c=>c.id==="window-picture")!,item: FurniturePlacement={...def,id:"test",catalogId:def.id,floorId:p.floors[0].id,x:2000,z:0,rotation:0,variant:"sage"};
    const renderer=Object.create(SceneController.prototype) as any;
    Object.assign(renderer,{activePlan:p,activeFloorId:p.floors[0].id,wallVisibility:new WallVisibilityController(),camera:{position:new Vector3(2,1.4,-6),target:new Vector3(2,1.4,2)},scene:{createPickingRay:()=>new Ray(new Vector3(2,1.4,-6),new Vector3(0,0,1))}});
    const result=renderer.positionForItem(0,0,item);expect(result.z).toBe(4000);expect(result.x).toBe(2000);
    p.camera.wallVisibility="all-visible";expect(renderer.positionForItem(0,0,item).z).toBe(0);
    p.camera.wallVisibility="all-hidden";expect(renderer.positionForItem(0,0,item)).toBeUndefined();
  });
  it("snaps inside walls to endpoints and perpendicular junctions without adding an extra tile",()=>{
    const f={...createSamplePlan().floors[0],cells:[],walls:[{id:"a",ax:1,az:1,bx:1,bz:4},{id:"b",ax:4,az:0,bx:4,bz:5}]};
    const start=snapWallStart(f,250,{x:1.15,z:1.12});expect(start).toEqual({x:1,z:1});
    const result=snapWallEnd(f,250,start,{x:3.8,z:1.05});expect(result).toEqual({end:{x:4,z:1},connected:true});
    expect(wallBetween(start,result.end)).toEqual({ax:1,az:1,bx:4,bz:1});expect(wallBetween(start,start)).toBeUndefined();
    expect(snapWallEnd(f,250,{x:4,z:1},{x:1.15,z:1.08}).end).toEqual(start);
  });
  it("connects to exact measured edges and preserves the new partitions through save and undo",()=>{
    const p=createSamplePlan();p.gridSizeMm=250;const f=addMeasuredRegion({...p.floors[0],cells:[],walls:[]},250,measuredRegion(250,{x:0,z:0},3810,3050));p.floors=[f];
    const start=snapWallStart(f,250,{x:.1,z:4}),end=snapWallEnd(f,250,start,{x:15.1,z:4.1});expect(end.end.x*250).toBeCloseTo(3810);expect(end.connected).toBe(true);
    state().replacePlan(p);state().addWall(wallBetween(start,end.end)!);const after=state().plan;expect(parsePlan(serializePlan(after))).toEqual(after);state().undo();expect(state().plan).toEqual(p);state().redo();expect(state().plan).toEqual(after);
  });
  it("recolors a whole straight outside plate but not its corners or separate walls",()=>{
    const p=createSamplePlan();p.gridSizeMm=250;const f={...p.floors[0],cells:rectangleCells(8,6),walls:[],wallFinishes:{}};
    const walls=floorBoundaryWalls(f,250),top=walls.filter(w=>w.az===0&&w.bz===0),side=walls.find(w=>w.ax===0&&w.bx===0)!;
    const ids=wallPlateIds(f,250,top[0].id);expect(ids).toHaveLength(8);expect(ids).not.toContain(side.id);
    const painted=paintWallPlate({...f,wallFinishes:{[top[0].id+"|0"]:"cream-plaster"}},250,top[0].id,"sage-plaster");expect(Object.values(painted.wallFinishes!)).toEqual(Array(8).fill("sage-plaster"));
    p.floors=[f];state().replacePlan(p);state().selectWall(top[0].id);expect(state().selectedWallId).toBe(top[0].id);expect(state().past).toHaveLength(0);
    state().finishWall(top[0].id,"sage-plaster");expect(state().past).toHaveLength(1);state().undo();expect(state().plan).toEqual(p);
  });
  it("defaults to solid walls and maps legacy transparency without mutating a save",()=>{
    const camera=createSamplePlan().camera;
    expect(getWallVisibility(camera)).toBe("all-visible");
    expect(getWallVisibility({...camera,transparentWalls:false})).toBe("all-visible");
    expect(getWallVisibility({...camera,transparentWalls:true})).toBe("near-hidden");
    expect(getWallVisibility({...camera,transparentWalls:true,wallVisibility:"all-visible"})).toBe("all-visible");
    expect(camera.wallVisibility).toBeUndefined();
  });
  it("cycles near hidden, all hidden, all visible in the requested order",()=>{
    expect(nextWallVisibility("all-visible")).toBe("near-hidden");
    expect(nextWallVisibility("near-hidden")).toBe("all-hidden");
    expect(nextWallVisibility("all-hidden")).toBe("all-visible");
  });
  it("follows the live camera around all four sides and diagonal views",()=>{
    const walls=[north,east,south,west];
    for(const [camera,hidden] of [
      [{x:2,z:-6},[true,false,false,false]],
      [{x:8,z:2},[false,true,false,false]],
      [{x:2,z:8},[false,false,true,false]],
      [{x:-6,z:2},[false,false,false,true]],
      [{x:8,z:-6},[true,true,false,false]],
      [{x:-6,z:8},[false,false,true,true]],
    ] as const) expect(walls.map(w=>isWallHidden("near-hidden",w,camera,target))).toEqual(hidden);
  });
  it("keeps explicit show/hide independent of camera and handles an overhead view",()=>{
    for(const w of [north,east,south,west]) {
      expect(isWallHidden("all-hidden",w,target,target)).toBe(true);
      expect(isWallHidden("all-visible",w,{x:8,z:-6},target)).toBe(false);
      expect(isWallHidden("near-hidden",w,target,target)).toBe(false);
    }
  });
  it("hides near interior partitions independent of draw direction and follows panning",()=>{
    const inside={ax:1,az:1,bx:3,bz:1,boundary:false};
    expect(isWallHidden("near-hidden",inside,{x:2,z:-6},target)).toBe(true);
    expect(isWallHidden("near-hidden",{...inside,ax:3,bx:1},{x:2,z:-6},target)).toBe(true);
    expect(isWallHidden("near-hidden",inside,{x:2,z:8},target)).toBe(false);
    expect(isWallHidden("near-hidden",inside,{x:2,z:-6},{x:2,z:0})).toBe(false);
  });
  it("matches doors/windows to the correct host orientation, not nearby parallel walls",()=>{
    expect(openingHostWall([north,east,south,west],{x:2,z:0},180)).toBe(north);
    expect(openingHostWall([north,east,south,west],{x:4,z:2},90)).toBe(east);
    expect(openingHostWall([north,east],{x:2,z:2},0)).toBeUndefined();
    expect(openingHostWall([north],{x:5,z:0},0)).toBeUndefined();
  });
  it("only changes nodes when visibility changes and drops disposed registrations",()=>{
    const node={setEnabled:vi.fn()},visibility=new WallVisibilityController();visibility.add(node,north);
    visibility.update("near-hidden",{x:2,z:-6},target);visibility.update("near-hidden",{x:2,z:-5},target);
    expect(node.setEnabled).toHaveBeenCalledTimes(1);expect(node.setEnabled).toHaveBeenLastCalledWith(false);
    visibility.update("near-hidden",{x:2,z:8},target);expect(node.setEnabled).toHaveBeenLastCalledWith(true);
    visibility.clear();visibility.update("all-hidden",target,target);expect(node.setEnabled).toHaveBeenCalledTimes(2);
  });
  it("restores the saved setting through undo/redo without reframing",()=>{
    const before=state().plan;state().cycleWallVisibility();const first=state().plan;
    expect(first.camera.wallVisibility).toBe("near-hidden");expect(first.camera.transparentWalls).toBe(true);
    expect(cameraUpdatePolicy(before,first,before.floors[0].id,first.floors[0].id)).toEqual({reframe:false,orient:false});
    state().cycleWallVisibility();expect(state().plan.camera.wallVisibility).toBe("all-hidden");
    state().cycleWallVisibility();expect(state().plan.camera.wallVisibility).toBe("all-visible");expect(state().plan.camera.transparentWalls).toBe(false);
    state().undo();expect(state().plan.camera.wallVisibility).toBe("all-hidden");
    state().redo();expect(state().plan.camera.wallVisibility).toBe("all-visible");
    expect(state().plan.floors).toEqual(before.floors);expect(state().plan.furniture).toEqual(before.furniture);
  });
  it("round-trips all modes through JSON, share links and IndexedDB",async()=>{
    for(const mode of ["near-hidden","all-hidden","all-visible"]) {
      state().cycleWallVisibility();const plan=state().plan;
      expect(plan.camera.wallVisibility).toBe(mode);
      expect(parsePlan(serializePlan(plan))).toEqual(plan);
      expect(decodeShare(encodeShare(plan)).camera).toEqual(plan.camera);
      await savePlan(plan);expect((await loadPlan())?.camera).toEqual(plan.camera);
    }
  });
  it("rejects invalid modes and keeps old boolean callers consistent",()=>{
    expect(()=>parsePlan(JSON.stringify({...state().plan,camera:{...state().plan.camera,wallVisibility:"invisible-ish"}}))).toThrow();
    state().cycleWallVisibility();state().cycleWallVisibility();state().toggleCameraSetting("transparentWalls");
    expect(getWallVisibility(state().plan.camera)).toBe("all-visible");
  });
  it("labels all three button states and announces the next action",()=>{
    render(<WallVisibilityControl/>);
    fireEvent.click(screen.getByRole("button",{name:"Walls: All walls visible. Hide near walls"}));
    expect(screen.getByRole("status").textContent).toBe("Near walls hidden");
    fireEvent.click(screen.getByRole("button",{name:"Walls: Near walls hidden. Hide all walls"}));
    expect(screen.getByRole("status").textContent).toBe("All walls hidden");
    fireEvent.click(screen.getByRole("button",{name:"Walls: All walls hidden. Show all walls"}));
    expect(screen.getByRole("status").textContent).toBe("All walls visible");
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
    expect(screen.getByRole("button").hasAttribute("aria-pressed")).toBe(false);
  });
});

describe("Babylon wall visibility integration",()=>{
  it("disables real nodes and descendants for rendering/picking, then restores them",()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try {
      const parent=new TransformNode("window",scene),mesh=MeshBuilder.CreateBox("window-frame",{},scene);mesh.parent=parent;mesh.computeWorldMatrix(true);
      const ray=new Ray(new Vector3(0,0,-4),new Vector3(0,0,1));
      const visibility=new WallVisibilityController();visibility.add(parent,north);
      visibility.update("all-visible",target,target);expect(scene.pickWithRay(ray)?.hit).toBe(true);
      visibility.update("all-hidden",target,target);expect(parent.isEnabled()).toBe(false);expect(mesh.isEnabled()).toBe(false);expect(scene.pickWithRay(ray)?.hit).toBe(false);
      visibility.update("all-visible",target,target);expect(mesh.isEnabled()).toBe(true);expect(mesh.isPickable).toBe(true);expect(scene.pickWithRay(ray)?.hit).toBe(true);
    } finally {scene.dispose();engine.dispose()}
  });
  it("registers real wall sections, inside walls, legacy openings and catalog openings but not decor",()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try {
      const plan=createSamplePlan(),floor=plan.floors[0];plan.gridSizeMm=1000;
      floor.cells=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
      floor.walls=[{id:"inside",ax:0,az:1,bx:2,bz:1}];
      floor.openings=[{id:"legacy-door",kind:"door",wallKey:"0:0:1:0",offset:.5,widthMm:800}];
      const piece=(catalogId:string,x:number,z:number):FurniturePlacement=>{const c=catalog.find(c=>c.id===catalogId)!;return {id:catalogId,catalogId,floorId:floor.id,x,z,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:"sage"}};
      plan.furniture=[piece("window-picture",1000,2000),piece("wall-shelf",1000,0)];
      // Exercise the production builders with a GPU-free engine. Only loading
      // external textures/GLBs is stubbed; visibility and scene nodes are real.
      const renderer:any=Object.create(SceneController.prototype);
      Object.assign(renderer,{furnitureNodes:new Map(),solidMaterials:new Map(),scene,root:new TransformNode("root",scene),activePlan:plan,tool:"wall-finish",wallVisibility:new WallVisibilityController(),floorWallGeometry:new Map(),shadow:{addShadowCaster:vi.fn()},furnitureModels:{build:(node:TransformNode)=>{const m=MeshBuilder.CreateBox("model",{},scene);m.parent=node;return true}},surfaceMaterial:()=>new StandardMaterial("mat",scene)});
      renderer.buildFloor(plan,floor,false);
      renderer.wallVisibility.update("all-hidden",{x:2,z:-6},target);
      const walls=scene.meshes.filter(m=>m.name.startsWith("wall:"));expect(walls.length).toBeGreaterThan(0);expect(walls.every(m=>!m.isEnabled())).toBe(true);
      expect(scene.getTransformNodeByName("door:legacy-door")?.isEnabled()).toBe(false);
      expect(scene.getTransformNodeByName("item:window-picture")?.isEnabled()).toBe(false);
      expect(scene.getTransformNodeByName("item:wall-shelf")?.isEnabled()).toBe(true);
      expect(scene.meshes.filter(m=>m.name.startsWith("cell:")).every(m=>m.isEnabled())).toBe(true);
      renderer.wallVisibility.update("all-visible",{x:2,z:-6},target);
      expect(walls.every(m=>m.isEnabled()&&m.material?.alpha===1)).toBe(true);
      expect(scene.getTransformNodeByName("door:legacy-door")?.isEnabled()).toBe(true);
      expect(scene.getTransformNodeByName("item:window-picture")?.isEnabled()).toBe(true);
      const ids=walls.map(m=>m.uniqueId);renderer.wallVisibility.update("near-hidden",{x:2,z:-6},{x:1,z:1.5});
      expect(walls.some(m=>!m.isEnabled())).toBe(true);expect(walls.some(m=>m.isEnabled())).toBe(true);
      renderer.wallVisibility.update("near-hidden",{x:2,z:6},{x:1,z:1.5});expect(walls.map(m=>m.uniqueId)).toEqual(ids);
    } finally {scene.dispose();engine.dispose()}
  });
});
