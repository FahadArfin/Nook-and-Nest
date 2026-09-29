import {describe,expect,it} from 'vitest';
import {catalog} from '../src/catalog';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {buildKitPlacement,cozyStarterKits,initialKitPosition,kitBounds,kitFloorFit,recipeSelectionNotes,replaceKitPiece,roomRecipeDetails,selectKitPieces} from '../src/furnitureKits';

const room=()=>{const plan=createSamplePlan('Recipe fit','metric');plan.gridSizeMm=1000;plan.floors=plan.floors.map(f=>({...f,cells:rectangleCells(8,8)}));return plan;};
const single=(widthMm:number,depthMm:number)=>({...cozyStarterKits[0],pieces:[{...cozyStarterKits[0].pieces[0],x:0,z:0,rotation:0,widthMm,depthMm}]});

describe('editable room recipes',()=>{
  it('covers the five requested starts using current independent pieces and honest footprints',()=>{
    expect(cozyStarterKits.map(k=>k.id)).toEqual(expect.arrayContaining(['starter-reading','starter-first-apartment','starter-office','starter-hobby','starter-guest']));
    const plan=room(),floor=plan.floors[0].id;
    for(const kit of cozyStarterKits){
      expect(roomRecipeDetails[kit.id].description.length).toBeGreaterThan(10);
      for(const piece of kit.pieces)expect(catalog.some(c=>c.id===piece.catalogId)).toBe(true);
      const result=buildKitPlacement(plan,floor,kit,initialKitPosition(plan,floor,kit));
      expect(result.warnings).toEqual([]);expect(result.addedIds).toHaveLength(kit.pieces.length);
      expect(result.plan.floors).toBe(plan.floors);expect(plan.furniture).toEqual([]);
      const bounds=kitBounds(kit);expect(bounds.width).toBeGreaterThan(500);expect(bounds.depth).toBeGreaterThan(500);
    }
  });
  it('keeps explicit choices and their transforms without changing saved kits or silently dropping unknown pieces',()=>{
    const original=structuredClone(cozyStarterKits[0]);original.pieces[1].catalogId='retired-table';
    const before=structuredClone(original),plan=room(),floor=plan.floors[0].id;
    expect(()=>buildKitPlacement(plan,floor,selectKitPieces(original,[0,1,2]),{x:3000,z:3000,rotation:0})).toThrow('retired-table');
    const selected=selectKitPieces(original,[0,2]);expect(selected.pieces).toEqual([original.pieces[0],original.pieces[2]]);
    expect(buildKitPlacement(plan,floor,selected,{x:3000,z:3000,rotation:0}).addedIds).toHaveLength(2);
    selected.pieces[0].x=999;expect(original).toEqual(before);
    for(const indices of [[],[-1],[1,1],[9],[.5]])expect(()=>selectKitPieces(original,indices)).toThrow();
  });
  it('replaces retired pieces explicitly without retaining incompatible colors, dimensions or private identity',()=>{
    const original=structuredClone(cozyStarterKits[0]);original.pieces[1].catalogId='retired-table';original.pieces[1].materialColors={old:'#abcdef'};
    const before=structuredClone(original),replacement=catalog.find(c=>c.id==='desk')!;
    const revised=replaceKitPiece(original,1,replacement.id);
    expect(original).toEqual(before);expect(revised.pieces[1]).toMatchObject({catalogId:replacement.id,x:original.pieces[1].x,z:original.pieces[1].z,rotation:original.pieces[1].rotation,widthMm:replacement.widthMm,depthMm:replacement.depthMm});
    expect(revised.pieces[1].materialColors).toBeUndefined();
    const plan=room();expect(buildKitPlacement(plan,plan.floors[0].id,revised,{x:3000,z:3000,rotation:0}).addedIds).toHaveLength(3);
    expect(()=>replaceKitPiece(original,1,'door-flush')).toThrow();expect(()=>replaceKitPiece(original,-1,'desk')).toThrow();
  });
  it('detects a floor hole inside a footprint even when all four corners are supported',()=>{
    const plan=room(),floor=plan.floors[0];floor.cells=rectangleCells(3,3).filter(c=>c.x!==1||c.z!==1);
    const kit=single(2400,2400),position={x:1500,z:1500,rotation:0};
    expect(kitFloorFit(plan,floor.id,kit,position).outside).toEqual([0]);
    expect(buildKitPlacement(plan,floor.id,kit,position).warnings.some(w=>w.kind==='floor_edge')).toBe(true);
  });
  it('respects diagonal boundaries and the actual rotated footprint rather than its bounding box',()=>{
    const plan=room(),floor=plan.floors[0];floor.cells=[{x:0,z:0}];
    floor.cellRects={'0,0':[{x:0,z:0,width:1000,depth:1000,polygon:[{x:0,z:0},{x:1000,z:0},{x:0,z:1000}]}]};
    expect(kitFloorFit(plan,floor.id,single(200,200),{x:800,z:800,rotation:0}).fits).toBe(false);
    expect(kitFloorFit(plan,floor.id,single(200,200),{x:250,z:250,rotation:45}).fits).toBe(true);
    floor.cellRects=undefined;
    expect(kitFloorFit(plan,floor.id,single(400,900),{x:500,z:500,rotation:45}).fits).toBe(true);
  });
  it('checks existing stair openings and gracefully reports an empty or too-small floor',()=>{
    const plan=room(),[lower,upper]=plan.floors;
    const stair=catalog.find(c=>c.category==='Stairs')!;
    plan.furniture=[{id:'stairs',catalogId:stair.id,floorId:lower.id,toFloorId:upper.id,x:3000,z:3000,rotation:0,widthMm:1000,depthMm:2000,heightMm:2800,variant:'oat'}];
    expect(kitFloorFit(plan,upper.id,single(300,300),{x:3000,z:3000,rotation:0}).fits).toBe(false);
    lower.cells=[];expect(kitFloorFit(plan,lower.id,single(300,300),{x:500,z:500,rotation:0}).fits).toBe(false);
    expect(()=>initialKitPosition(plan,lower.id,cozyStarterKits[0])).toThrow('Draw a floor');
  });
  it('warns when the user keeps elevated recipe accessories but removes their support',()=>{
    const office=cozyStarterKits.find(k=>k.id==='starter-office')!;
    expect(recipeSelectionNotes(office,[1,2,3]).join(' ')).toContain('keeps its saved height');
    expect(recipeSelectionNotes(office,[0,1,2,3])).toEqual([]);
    expect(selectKitPieces(office,[2]).pieces[0].elevationMm).toBe(760);
  });
});
