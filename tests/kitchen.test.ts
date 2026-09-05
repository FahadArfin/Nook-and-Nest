import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { catalog,defaultMountHeight,isKitchenWall,isCeilingMounted,isSurfaceMounted } from '../src/catalog';
import { kitchenRows,kitchenTopIds,kitchenWallIds,kitchenSurfaceIds,kitchenCeilingIds } from '../src/kitchenCatalog';
import { createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare } from '../src/domain';
import { snapWindow,windowProblem,windowRotation,windowWallPieces } from '../src/windows';
import { tabletopPoint,supportsDesktop } from '../src/tabletop';
import { supportsCountertopFinish } from '../src/surfaces';
import { usePlanner } from '../src/store';
import materials from '../src/modelMaterials.json';
import type { FurniturePlacement } from '../src/types';
const make=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:crypto.randomUUID(),catalogId:id,floorId,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,x:1800,z:0,rotation:0,variant:'cream',elevationMm:defaultMountHeight(id)};};
describe('kitchen and storage collection',()=>{
  it('ships 28 editable originals with dimensioned GLBs, material slots and previews',()=>{
    expect(kitchenRows).toHaveLength(28);
    for(const [id,,,_w,_d,_h] of kitchenRows){
      expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
      const data=readFileSync(`public/models/furniture/${id}.glb`),glb=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
      const bounds=glb.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>glb.accessors[p.attributes.POSITION]));
      for(let axis=0;axis<3;axis++){const low=Math.min(...bounds.map((b:any)=>b.min[axis])),high=Math.max(...bounds.map((b:any)=>b.max[axis]));expect((high-low)*1000,id).toBeCloseTo([_w,_h,_d][axis],1);}
      expect(glb.accessors.filter((a:any)=>a.type==='SCALAR').reduce((sum:number,a:any)=>sum+a.count/3,0),id).toBeLessThan(40000);
      expect((materials as Record<string,unknown[]>)[id]?.length,id).toBeGreaterThan(1);
    }
  });
  it('provides worktops, wall pieces, tabletop pieces and ceiling pieces without changing old IDs',()=>{
    for(const id of kitchenTopIds){expect(supportsCountertopFinish(id)).toBe(true);expect(supportsDesktop(make(id,'floor'))).toBe(true);}
    expect(supportsCountertopFinish('backsplash-slab')).toBe(true);expect(supportsDesktop(make('closet-corner-module','floor'))).toBe(false);
    for(const id of kitchenWallIds)expect(isKitchenWall(id)).toBe(true);
    for(const id of kitchenSurfaceIds)expect(isSurfaceMounted(id)).toBe(true);
    for(const id of kitchenCeilingIds)expect(isCeilingMounted(id)).toBe(true);
  });
});
describe('wall cabinets and backsplash placement',()=>{
  it('keeps every wall accessory just outside the solid wall and below the ceiling',()=>{
    const plan=createSamplePlan();
    for(const id of kitchenWallIds){const item=snapWindow(plan,make(id,plan.floors[0].id));expect(item.z).toBeCloseTo(item.depthMm/2+51);expect(windowProblem(plan,item),id).toBeUndefined();
      expect((item.elevationMm??0)+item.heightMm+50).toBeLessThanOrEqual(plan.floors[0].heightMm);
      const flipped=snapWindow(plan,{...item,rotation:windowRotation(item,15)});expect(flipped.rotation).toBe(180);expect(flipped.z).toBeCloseTo(-item.depthMm/2-51);expect(windowProblem(plan,flipped)).toBeUndefined();}
  });
  it('aligns to perpendicular walls and rejects an unavailable wall or oversized panel',()=>{
    const p=createSamplePlan(),item=snapWindow(p,{...make('backsplash-subway',p.floors[0].id),x:0,z:1500,rotation:90});
    expect(item.x).toBeCloseTo(item.depthMm/2+51);expect(item.rotation).toBe(90);expect(windowProblem(p,item)).toBeUndefined();
    expect(windowProblem(p,{...item,widthMm:100000})).toMatch(/No wall/);p.floors[0].cells=[];expect(windowProblem(p,item)).toMatch(/No wall/);
  });
  it('does not cut a wall and prevents covering an existing window',()=>{
    const p=createSamplePlan(),f=p.floors[0],panel=snapWindow(p,make('backsplash-subway',f.id));
    const wall={id:'test',ax:0,az:0,bx:12,bz:0};expect(windowWallPieces(wall,p.gridSizeMm,f.heightMm,[panel])).toEqual(windowWallPieces(wall,p.gridSizeMm,f.heightMm,[]));
    p.furniture=[snapWindow(p,make('window-casement',f.id))];expect(windowProblem(p,panel)).toMatch(/covers a door or window/);
  });
  it('retains colors, sizes and finishes through updates, history and shared copies',()=>{
    const p=createSamplePlan(),s=usePlanner.getState();s.replacePlan(p);const item=snapWindow(p,make('backsplash-slab',p.floors[0].id));
    s.confirmFurniture(item);s.updateFurniture(item.id,{surfaceVariant:'ivory-marble',widthMm:1500,heightMm:550,materialColors:{'countertop-surface':'#ccbb99','grout':'#665544'}});
    const after=structuredClone(usePlanner.getState().plan);s.undo();expect(usePlanner.getState().plan.furniture[0].widthMm).toBe(1200);s.redo();expect(usePlanner.getState().plan).toEqual(after);
    expect(parsePlan(serializePlan(after))).toEqual(after);expect(decodeShare(encodeShare(after)).furniture).toEqual(after.furniture);
    s.select(item.id);s.deleteSelected();expect(usePlanner.getState().plan.furniture).toEqual([]);s.undo();expect(usePlanner.getState().plan.furniture).toEqual(after.furniture);
  });
});
describe('countertop appliances and hanging lights',()=>{
  it('rests appliances on the counter and rejects overhanging its front',()=>{
    const p=createSamplePlan(),f=p.floors[0],table={...make('shaker-drawer-cabinet',f.id),x:1000,z:1000};p.furniture=[table];
    for(const id of kitchenSurfaceIds){const item=make(id,f.id),point=tabletopPoint(p,item,{x:1,y:4,z:.95},{x:0,y:-1,z:0});expect(point?.elevationMm,id).toBe(910);}
    const toaster=make('two-slot-toaster',f.id);expect(tabletopPoint(p,toaster,{x:1,y:4,z:1.29},{x:0,y:-1,z:0})).toBeUndefined();
    table.rotation=90;expect(tabletopPoint(p,{...toaster,rotation:90},{x:.95,y:4,z:1},{x:0,y:-1,z:0})?.elevationMm).toBe(910);
  });
  it('keeps ceiling canopies under the ceiling and rejects impossible fixture heights',()=>{
    const p=createSamplePlan();for(const id of kitchenCeilingIds){const item=snapWindow(p,{...make(id,p.floors[0].id),elevationMm:undefined});expect((item.elevationMm??0)+item.heightMm+50).toBe(p.floors[0].heightMm);expect(windowProblem(p,item)).toBeUndefined();
      expect(windowProblem(p,snapWindow(p,{...item,heightMm:4000}))).toMatch(/taller/);}
  });
  it('keeps closet modules independent when duplicating or changing a finish',()=>{
    const p=createSamplePlan(),s=usePlanner.getState();s.replacePlan(p);s.confirmFurniture(make('closet-hanging-module',p.floors[0].id));s.select(usePlanner.getState().plan.furniture[0].id);s.duplicateSelected();
    const [first,second]=usePlanner.getState().plan.furniture;expect(first.id).not.toBe(second.id);s.updateFurniture(second.id,{variant:'navy',widthMm:800});expect(usePlanner.getState().plan.furniture[0]).toEqual(first);
  });
});
