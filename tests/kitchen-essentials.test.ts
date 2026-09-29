import {describe,it,expect} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import rows from '../src/kitchenEssentialsExpansion.json';
import materials from '../src/modelMaterials.json';
import {catalog,defaultMountHeight,isSurfaceMounted,isWallMounted} from '../src/catalog';
import {createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare} from '../src/domain';
import {tabletopPoint} from '../src/tabletop';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';

function placement(id:string,floorId:string):FurniturePlacement {
 const c=catalog.find(c=>c.id===id)!;
 return {id:'test-'+id,catalogId:id,floorId,x:1000,z:1000,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'white',elevationMm:defaultMountHeight(id)};
}

describe('kitchen essentials collection',()=>{
 it('exports independent, floor-centred bounded models with editable sources and previews',()=>{
  for(const row of rows){
   const id=String(row[0]),buf=readFileSync(`public/models/furniture/${id}.glb`);
   const glb=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString());
   expect(catalog.filter(c=>c.id===id)).toHaveLength(1);
   expect(glb.scenes).toHaveLength(1);
   expect(glb.nodes.every((n:any)=>n.name!== 'Cube' && !n.camera)).toBe(true);
   const primitives=glb.meshes.flatMap((m:any)=>m.primitives);
   const bounds=primitives.map((p:any)=>glb.accessors[p.attributes.POSITION]);
   for(let axis=0;axis<3;axis++){
    const low=Math.min(...bounds.map((b:any)=>b.min[axis])),high=Math.max(...bounds.map((b:any)=>b.max[axis]));
    expect((high-low)*1000,id).toBeCloseTo(Number(row[[3,5,4][axis]]),1);
    expect(axis===1?low:low+high,id).toBeCloseTo(0,5);
   }
   expect(primitives.reduce((n:number,p:any)=>n+glb.accessors[p.indices].count/3,0),id).toBeLessThan(10000);
   expect(buf.length,id).toBeLessThan(450000);
   expect(glb.images??[]).toHaveLength(0);
   expect(glb.materials.map((m:any)=>m.name)).toEqual((materials as Record<string,{id:string}[]>)[id].map(m=>m.id));
   expect(statSync(`assets-source/blender/${id}.blend`).size).toBeGreaterThan(10000);
   expect(statSync(`public/models/previews/${id}.webp`).size).toBeGreaterThan(1000);
   expect(isSurfaceMounted(id),id).toBe(row[8]==='surface');
   expect(isWallMounted(id),id).toBe(row[8]==='wall');
  }
 });
 it('fits the countertop dishwasher on real counters, rejects narrow hosts, and keeps props independent through undo and saves',()=>{
  const plan=createSamplePlan(),floor=plan.floors[0].id;
  const counter=placement('shaker-drawer-cabinet',floor);plan.furniture=[counter];
  const dishwasher=placement('kitchen-counter-dishwasher',floor);
  expect(tabletopPoint(plan,{...dishwasher,rotation:90},{x:1,y:3,z:1},{x:0,y:-1,z:0})).toMatchObject({rotation:0,elevationMm:910});
  expect(tabletopPoint({...plan,furniture:[{...counter,widthMm:400}]},dishwasher,{x:1,y:3,z:1},{x:0,y:-1,z:0})).toBeUndefined();
  const mug={...placement('kitchen-everyday-mug',floor),elevationMm:910};
  const bowl={...placement('kitchen-cereal-bowl',floor),x:1250,elevationMm:910};
  const store=usePlanner.getState();store.replacePlan(plan);store.confirmFurniture(mug);store.confirmFurniture(bowl);
  store.updateFurniture(mug.id,{materialColors:{'terracotta-glaze':'#385c73'}});
  const colored=structuredClone(usePlanner.getState().plan);
  expect(colored.furniture.find(f=>f.id===bowl.id)?.materialColors).toBeUndefined();
  store.undo();expect(usePlanner.getState().plan.furniture.find(f=>f.id===mug.id)?.materialColors).toBeUndefined();
  store.redo();expect(usePlanner.getState().plan).toEqual(colored);
  expect(parsePlan(serializePlan(colored))).toEqual(colored);
  expect(decodeShare(encodeShare(colored)).furniture).toEqual(colored.furniture);
  expect(defaultMountHeight('kitchen-utensil-rail')).toBe(1500);
 });
});
