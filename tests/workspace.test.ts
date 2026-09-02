import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { catalog, hasModelPreview, isSurfaceMounted, workspaceModelIds } from "../src/catalog";
import { createSamplePlan, furnitureOverlaps, serializePlan, parsePlan, encodeShare, decodeShare } from "../src/domain";
import { tabletopPoint, supportsDesktop } from "../src/tabletop";
import { usePlanner } from "../src/store";
import type { FurniturePlacement } from "../src/types";

const piece=(id:string,patch:Partial<FurniturePlacement>={}):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id,catalogId:id,floorId:"floor",x:1500,z:1500,rotation:0,widthMm:c.widthMm,heightMm:c.heightMm,depthMm:c.depthMm,variant:"sage",...patch};};
const plan=()=>{const p=createSamplePlan();p.floors=[{...p.floors[0],id:"floor"}];p.furniture=[piece("gaming-desk")];return p;};

describe("computer and coffee collection",()=>{
  it("adds 16 distinct originals with previews, editable sources and correct scaled GLB dimensions",()=>{
    expect(workspaceModelIds.size).toBe(16);
    for(const id of workspaceModelIds){
      expect(hasModelPreview(id)).toBe(true);expect(existsSync(`public/models/previews/${id}.png`)).toBe(true);expect(existsSync(`assets-source/blender/${id}.blend`)).toBe(true);
      const c=catalog.find(c=>c.id===id)!;
      const data=readFileSync(`public/models/furniture/${id}.glb`);const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
      const bounds=json.meshes.flatMap((mesh:{primitives:{attributes:{POSITION:number}}[]})=>mesh.primitives.map(p=>json.accessors[p.attributes.POSITION]));
      const expected=[c.widthMm,c.heightMm,c.depthMm];
      for(let axis=0;axis<3;axis++){const low=Math.min(...bounds.map((b:{min:number[]})=>b.min[axis])),high=Math.max(...bounds.map((b:{max:number[]})=>b.max[axis]));expect((high-low)*1000).toBeCloseTo(expected[axis],1);expect((axis===1?low:(low+high)/2)*1000).toBeCloseTo(0,1);}
      expect(json.materials.some((m:{name:string})=>/variant-surface|upholstery-textured/.test(m.name))).toBe(true);
      expect(json.accessors.filter((a:{type:string})=>a.type==="SCALAR").reduce((sum:number,a:{count:number})=>sum+a.count/3,0)).toBeLessThan(25000);
    }
  });
  it("marks computer accessories for tabletop placement without attaching desks or chairs",()=>{
    for(const id of ["desktop-monitor","wide-monitor","pc-tower","mini-pc","laptop"])expect(isSurfaceMounted(id)).toBe(true);
    expect(isSurfaceMounted("gaming-chair")).toBe(false);expect(isSurfaceMounted("gaming-desk")).toBe(false);
  });
  it("snaps to the desktop in physical millimetres",()=>{
    const p=plan();expect(tabletopPoint(p,piece("desktop-monitor"),{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})).toEqual({x:1500,z:1500,elevationMm:760});
  });
  it("handles a rotated desktop, raised desk and upstairs floor",()=>{
    const p=plan();p.floors[0].elevationMm=2800;p.furniture[0].rotation=90;p.furniture[0].elevationMm=100;
    expect(tabletopPoint(p,piece("laptop",{rotation:90}),{x:1.5,y:5,z:1.5},{x:0,y:-1,z:0})?.elevationMm).toBe(860);
  });
  it("rejects overhang, other floors, upward rays, and empty L-desk corners",()=>{
    const p=plan();expect(tabletopPoint(p,piece("wide-monitor"),{x:2.2,y:3,z:1.5},{x:0,y:-1,z:0})).toBeUndefined();
    expect(tabletopPoint(p,piece("laptop",{floorId:"other"}),{x:1.5,y:3,z:1.5},{x:0,y:-1,z:0})).toBeUndefined();
    expect(tabletopPoint(p,piece("laptop"),{x:1.5,y:3,z:1.5},{x:0,y:1,z:0})).toBeUndefined();expect(supportsDesktop(piece("corner-desk"))).toBe(false);
  });
  it("does not mistake a monitor resting on a desk for a collision",()=>{
    const p=plan(),monitor=piece("desktop-monitor",{elevationMm:760});expect(furnitureOverlaps(p.furniture,monitor)).toBe(false);
    expect(furnitureOverlaps([...p.furniture,piece("mini-pc",{elevationMm:760})],monitor)).toBe(true);
  });
  it("retains height, colors and dimensions through edits, undo, redo, backup and share",()=>{
    usePlanner.getState().replacePlan(plan());const state=()=>usePlanner.getState();state().confirmFurniture(piece("laptop",{elevationMm:760}));
    state().updateFurniture("laptop",{variant:"navy",elevationMm:900,widthMm:400});state().undo();expect(state().plan.furniture[1].elevationMm).toBe(760);state().redo();
    const saved=state().plan;expect(parsePlan(serializePlan(saved)).furniture).toEqual(saved.furniture);expect(decodeShare(encodeShare(saved)).furniture).toEqual(saved.furniture);
    expect(saved.furniture[1]).toMatchObject({variant:"navy",elevationMm:900,widthMm:400});
  });
});
