import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { catalog, isWindow } from "../src/catalog";
import { createSamplePlan, rectangleCells, serializePlan, parsePlan, encodeShare, decodeShare } from "../src/domain";
import { snapWindow, windowProblem, wallRuns, windowRotation, windowWallPieces } from "../src/windows";
import { usePlanner } from "../src/store";
import type { FurniturePlacement } from "../src/types";

const plan=()=>{const p=createSamplePlan("Windows","metric");p.gridSizeMm=250;p.floors=[{...p.floors[0],id:"floor",heightMm:2500,cells:rectangleCells(20,16),walls:[],openings:[]}];p.furniture=[];return p;};
const item=(patch:Partial<FurniturePlacement>={}):FurniturePlacement=>({id:"window",catalogId:"window-casement",floorId:"floor",x:2300,z:0,widthMm:1200,depthMm:220,heightMm:1250,rotation:0,elevationMm:850,variant:"cream",...patch});

describe("wall-mounted window planning",()=>{
  beforeEach(()=>usePlanner.getState().replacePlan(plan()));
  it("merges tile edges without bridging gaps",()=>{
    const p=plan();expect(wallRuns(p.floors[0],250)).toHaveLength(4);
    p.floors[0].cells=[];p.floors[0].walls=[{id:"a",ax:0,az:0,bx:4,bz:0},{id:"b",ax:5,az:0,bx:9,bz:0}];
    expect(wallRuns(p.floors[0],250)).toHaveLength(2);
    expect(windowProblem(p,snapWindow(p,item()))).toMatch(/No wall/);
  });
  it.each([[2400,20,0,0],[2400,3980,0,4000],[20,2400,90,0],[4980,2400,90,5000]])("snaps to wall from %s,%s",(x,z,rotation,line)=>{
    const p=plan(),w=snapWindow(p,item({x,z}));expect(w.rotation).toBe(rotation);expect(rotation===0?w.z:w.x).toBe(line);expect(windowProblem(p,w)).toBeUndefined();
  });
  it("supports internal walls and upstairs heights",()=>{
    const p=plan();p.floors[0].elevationMm=2800;p.floors[0].walls=[{id:"room",ax:2,az:8,bx:18,bz:8}];
    const w=snapWindow(p,item({x:2500,z:2020,elevationMm:2000}));expect(w.z).toBe(2000);expect(w.elevationMm).toBe(1150);expect(windowProblem(p,w)).toBeUndefined();
  });
  it("rejects missing walls, oversized heights and overlapping windows",()=>{
    const p=plan();expect(windowProblem(p,item({heightMm:3000}))).toMatch(/taller/);
    p.furniture=[item()];expect(windowProblem(p,item({id:"other",x:2400}))).toMatch(/overlaps/);
    p.floors[0].cells=[];expect(windowProblem(p,item())).toMatch(/No wall/);
  });
  it("keeps flips wall aligned",()=>{expect(windowRotation(item(),15)).toBe(180);expect(windowRotation(item({rotation:90}),-15)).toBe(270);expect(windowRotation(item({catalogId:"sofa"}),15)).toBe(15);});
  it("cuts apertures across multiple tile segments and restores the wall on removal",()=>{
    const wall={id:"edge",ax:0,az:0,bx:20,bz:0};const pieces=windowWallPieces(wall,250,2500,[item()]);
    const area=pieces.reduce((sum,p)=>sum+(p.end-p.start)*(p.top-p.bottom),0);
    expect(area).toBe(5000*2500-1150*1200);
    const segment=windowWallPieces({id:"tile",ax:8,az:0,bx:9,bz:0},250,2500,[item()]);expect(segment).toHaveLength(2);
    expect(windowWallPieces(wall,250,2500,[])).toEqual([{start:0,end:5000,bottom:0,top:2500}]);
    const reversed=windowWallPieces({...wall,ax:20,bx:0},250,2500,[item()]);expect(reversed).toEqual(pieces);
  });
  it("commits, recolors, resizes, moves, removes and undoes windows",()=>{
    const state=()=>usePlanner.getState();state().confirmFurniture(item());expect(state().selectedId).toBeUndefined();expect(state().past).toHaveLength(1);
    state().select("window");state().updateFurniture("window",{variant:"clay",widthMm:1400,elevationMm:600});
    state().moveFurniture("window",4980,2200);expect(state().plan.furniture[0]).toMatchObject({x:5000,rotation:90,variant:"clay",widthMm:1400,elevationMm:600});
    state().deleteSelected();expect(state().plan.furniture).toHaveLength(0);state().undo();expect(state().plan.furniture).toHaveLength(1);state().redo();expect(state().plan.furniture).toHaveLength(0);
  });
  it("does not commit invalid windows or dimension edits",()=>{
    const state=()=>usePlanner.getState();state().confirmFurniture(item({widthMm:9000}));expect(state().past).toHaveLength(0);expect(state().placementNotice).toBeTruthy();
    state().confirmFurniture(item());state().updateFurniture("window",{heightMm:4000});expect(state().plan.furniture[0].heightMm).toBe(1250);expect(state().past).toHaveLength(1);
  });
  it("round-trips all ten styles exactly through backup and sharing",()=>{
    const p=plan();p.furniture=catalog.filter(c=>isWindow(c.id)).map((c,i)=>item({id:`w-${i}`,catalogId:c.id,widthMm:c.widthMm,heightMm:c.heightMm,depthMm:c.depthMm,rotation:180,elevationMm:700,variant:"navy"}));
    expect(p.furniture).toHaveLength(10);expect(parsePlan(serializePlan(p)).furniture).toEqual(p.furniture);expect(decodeShare(encodeShare(p)).furniture).toEqual(p.furniture);
  });
  it("exports translucent glazing and recolorable joinery for every Blender window",()=>{
    for(const c of catalog.filter(c=>isWindow(c.id))){const glb=readFileSync(`public/models/furniture/${c.id}.glb`);const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
      expect(json.materials.some((m:{name:string})=>m.name.includes("variant-surface"))).toBe(true);
      expect(json.materials.some((m:{name:string;alphaMode:string})=>m.name==="window-glazing"&&m.alphaMode==="BLEND")).toBe(true);
      const bounds=json.meshes.flatMap((mesh:{primitives:{attributes:{POSITION:number}}[]})=>mesh.primitives.map(p=>json.accessors[p.attributes.POSITION]));
      const expected=[c.widthMm,c.heightMm,c.depthMm];
      for(let axis=0;axis<3;axis++){const size=Math.max(...bounds.map((b:{max:number[]})=>b.max[axis]))-Math.min(...bounds.map((b:{min:number[]})=>b.min[axis]));expect(size*1000).toBeCloseTo(expected[axis],1);}
    }
  });
});

it('preserves doorless entrances through save/share and cuts a floor-level aperture',()=>{
 const p=plan(),entrance=snapWindow(p,item({catalogId:'door-flush',doorless:true,elevationMm:0,heightMm:2100,widthMm:1000}));p.furniture=[entrance];
 const restored=parsePlan(serializePlan(p));expect(restored.furniture[0].doorless).toBe(true);expect(decodeShare(encodeShare(p)).furniture[0].doorless).toBe(true);
 const pieces=windowWallPieces({id:'wall',ax:0,az:0,bx:20,bz:0},250,2500,[entrance]);
 expect(pieces.some(piece=>piece.start<entrance.x&&piece.end>entrance.x&&piece.bottom===0)).toBe(false);
 expect(windowProblem(p,entrance)).toBeUndefined();
});
