import { NullEngine,Scene,TransformNode,ShadowGenerator,DirectionalLight,Vector3 } from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { FurnitureFactory } from '../src/scene/FurnitureFactory';
import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { catalog,isWallMounted,isSurfaceMounted,defaultMountHeight } from '../src/catalog';
import { interiorRows,interiorArtIds,collectibleIds } from '../src/interiorCatalog';
import { shelfSurfaces,shelfChoices,restsOnShelf } from '../src/shelfSurfaces';
import { tabletopPoint } from '../src/tabletop';
import { createSamplePlan,furnitureOverlaps,parsePlan,serializePlan,encodeShare,decodeShare } from '../src/domain';
import { usePlanner } from '../src/store';
import { furnitureType,matchesFurniture } from '../src/library';
import type { FurniturePlacement } from '../src/types';
import materials from '../src/modelMaterials.json';
const make=(id:string,floorId:string):FurniturePlacement=>{const c=catalog.find(c=>c.id===id)!;return {id:crypto.randomUUID(),catalogId:id,floorId,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,x:0,z:0,rotation:0,variant:'sage',elevationMm:defaultMountHeight(id)};};
describe('indoor originals',()=>{
  it('loads all 27 GLBs through the actual Babylon importer',async()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try{for(const [id] of interiorRows){const container=await LoadAssetContainerAsync(readFileSync(`public/models/furniture/${id}.glb`),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});expect(container.meshes.some(m=>m.getTotalVertices()>0),id).toBe(true);container.dispose();}}finally{scene.dispose();engine.dispose()}
  });
  it('provides bounded pickable fallback geometry for every new piece',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),light=new DirectionalLight('sun',new Vector3(0,-1,0),scene),shadow=new ShadowGenerator(128,light),factory=new FurnitureFactory(scene,shadow);
    try{for(const [id] of interiorRows){const item=make(id,'floor'),def=catalog.find(c=>c.id===id)!,root=new TransformNode(id,scene);factory.build(root,def,item,def.widthMm/1000,def.depthMm/1000,def.heightMm/1000,false);const meshes=root.getChildMeshes();expect(meshes.length,id).toBeGreaterThan(0);expect(meshes.every(m=>m.isPickable),id).toBe(true);root.dispose();}}finally{factory.resetMaterials();scene.dispose();engine.dispose()}
  });
  it('ships 27 editable Blender models, GLBs, thumbnails and independent material colors',()=>{
    expect(interiorRows).toHaveLength(27);
    for(const [id,,category,w,d,h] of interiorRows){
      expect(existsSync(`assets-source/blender/${id}.blend`),id).toBe(true);expect(existsSync(`public/models/previews/${id}.webp`),id).toBe(true);
      const data=readFileSync(`public/models/furniture/${id}.glb`),glb=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
      const bounds=glb.meshes.flatMap((m:any)=>m.primitives.map((p:any)=>glb.accessors[p.attributes.POSITION]));
      for(let axis=0;axis<3;axis++)expect((Math.max(...bounds.map((b:any)=>b.max[axis]))-Math.min(...bounds.map((b:any)=>b.min[axis])))*1000,id).toBeCloseTo([w,h,d][axis],1);
      expect(glb.accessors.filter((a:any)=>a.type==='SCALAR').reduce((sum:number,a:any)=>sum+a.count/3,0),id).toBeLessThan(40000);
      expect((materials as Record<string,unknown[]>)[id]?.length,id).toBeGreaterThan(1);
      expect(data.length,id).toBeLessThan(4_000_000);expect(furnitureType(catalog.find(c=>c.id===id)!)).not.toBe('Other pieces');
      expect(catalog.find(c=>c.id===id)?.category).toBe(category);
    }
  });
  it('embeds original single-UV artwork, not a link to an external poster',()=>{
    for(const id of interiorArtIds){const data=readFileSync(`public/models/furniture/${id}.glb`),g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
      const material=g.materials.findIndex((m:any)=>m.name==='original-printed-art'),p=g.meshes.flatMap((m:any)=>m.primitives).find((p:any)=>p.material===material);
      expect(g.materials[material].pbrMetallicRoughness.baseColorTexture).toBeTruthy();expect(p.attributes.TEXCOORD_0).toBeDefined();
      expect(g.images.every((i:any)=>i.bufferView!==undefined)).toBe(true);expect(existsSync(`assets-source/art/${id}.png`)).toBe(true);expect(isWallMounted(id)).toBe(true);
    }
  });
  it('allows existing books/plants and new collectibles on surfaces without migrating saved heights',()=>{
    for(const id of [...collectibleIds,'books-upright','books-stacked','small-plant']){expect(isSurfaceMounted(id)).toBe(true);expect(defaultMountHeight(id)).toBeUndefined();}
    expect(isWallMounted('books-upright')).toBe(false);expect(defaultMountHeight('floating-nightstand')).toBe(350);
    const p=createSamplePlan();p.furniture=[{...make('books-upright',p.floors[0].id),elevationMm:1100}];expect(parsePlan(serializePlan(p)).furniture[0].elevationMm).toBe(1100);
  });
  it('makes types discoverable through search',()=>{
    for(const [id,query] of [['boneless-loveseat','boneless'],['twin-full-bunk','bunk'],['adventurer-figurine','anime'],['model-sailboat','ship'],['wide-check-rug','rug']])expect(matchesFurniture(catalog.find(c=>c.id===id)!,query)).toBe(true);
  });
});
describe('usable shelf surfaces',()=>{
  it('rests a plant on a tall shelf and rejects insufficient depth/height',()=>{
    const p=createSamplePlan(),f=p.floors[0],owner=make('display-bookcase',f.id),plant=make('small-plant',f.id);p.furniture=[owner];
    expect(shelfChoices(p,plant)).toHaveLength(3);
    expect(tabletopPoint(p,plant,{x:0,y:1.85,z:.02},{x:0,y:-1,z:0})).toEqual({x:0,z:20,elevationMm:1330});
    expect(shelfChoices(p,{...plant,heightMm:900})).toHaveLength(0);expect(shelfChoices(p,{...plant,depthMm:500})).toHaveLength(0);
  });
  it('snaps to the nearest lower shelf from a ray, never into the back or side panels',()=>{
    const p=createSamplePlan(),owner=make('display-bookcase',p.floors[0].id),item=make('adventurer-figurine',owner.floorId);p.furniture=[owner];
    expect(tabletopPoint(p,item,{x:0,y:1.2,z:0},{x:0,y:-1,z:0})?.elevationMm).toBe(740);
    expect(tabletopPoint(p,item,{x:.58,y:3,z:0},{x:0,y:-1,z:0})).toBeUndefined();
    expect(tabletopPoint(p,item,{x:0,y:3,z:-.2},{x:0,y:-1,z:0})).toBeUndefined();
    expect(tabletopPoint(p,item,{x:0,y:3,z:0},{x:1,y:0,z:0})).toBeUndefined();
  });
  it('treats each cubby as its own bay and never bridges dividers',()=>{
    const p=createSamplePlan(),owner=make('cube-display-shelf',p.floors[0].id),figure=make('mecha-figurine',owner.floorId);p.furniture=[owner];
    expect(shelfChoices(p,figure)).toHaveLength(9);expect(shelfChoices(p,make('books-upright',owner.floorId))).toHaveLength(0);
    expect(tabletopPoint(p,figure,{x:.21,y:3,z:0},{x:0,y:-1,z:0})).toBeUndefined();
    expect(tabletopPoint(p,figure,{x:.43,y:3,z:0},{x:0,y:-1,z:0})?.elevationMm).toBe(893);
  });
  it('has graduated ladder depths instead of one impossible full-depth rectangle',()=>{
    const p=createSamplePlan(),owner=make('ladder-display-shelf',p.floors[0].id);p.furniture=[owner];
    expect(shelfSurfaces(owner).map(s=>s.depth)).toEqual([370,300,230,160]);
    expect(shelfChoices(p,make('books-stacked',owner.floorId))).toHaveLength(2);
    expect(shelfChoices(p,make('adventurer-figurine',owner.floorId))).toHaveLength(4);
  });
  it('scales usable space and respects rotation, floor alignment and mounting elevation',()=>{
    const p=createSamplePlan(),owner={...make('display-bookcase',p.floors[1].id),x:1000,z:2000,rotation:90,elevationMm:120,widthMm:600,heightMm:950};p.furniture=[owner];
    const item={...make('brick-roadster',owner.floorId),rotation:90},choice=shelfChoices(p,item)[1];
    expect(choice.placement).toEqual({x:1020,z:2000,rotation:90,elevationMm:490});
    expect(restsOnShelf({...item,...choice.placement},owner)).toBe(true);
    const y=(p.floors[1].elevationMm+50+610)/1000;
    expect(tabletopPoint(p,item,{x:1.02,y,z:2},{x:0,y:-1,z:0})?.elevationMm).toBe(490);
    expect(shelfChoices(p,{...item,floorId:p.floors[0].id})).toEqual([]);
  });
  it('exempts the supporting shelf from overlap warnings, but not a second collectible',()=>{
    const p=createSamplePlan(),owner=make('display-bookcase',p.floors[0].id),item=make('adventurer-figurine',owner.floorId);p.furniture=[owner];
    const placed={...item,...shelfChoices(p,item)[1].placement};expect(furnitureOverlaps([owner],placed)).toBe(false);
    expect(furnitureOverlaps([owner,{...placed,id:'other'}],placed)).toBe(true);
    expect(furnitureOverlaps([owner],{...placed,elevationMm:800})).toBe(true);
  });
  it('keeps shelf placement reversible and preserves exact transforms/colors in backups and shares',()=>{
    const p=createSamplePlan(),owner=make('display-bookcase',p.floors[0].id),item=make('adventurer-figurine',owner.floorId);p.furniture=[owner,item];const s=usePlanner.getState();s.replacePlan(p);
    const chosen=shelfChoices(p,item)[1].placement;s.updateFurniture(item.id,{...chosen,materialColors:{'variant-surface':'#335577','warm-porcelain':'#bb9977'}});
    const after=structuredClone(usePlanner.getState().plan);s.undo();expect(usePlanner.getState().plan).toEqual(p);s.redo();expect(usePlanner.getState().plan).toEqual(after);
    expect(parsePlan(serializePlan(after))).toEqual(after);expect(decodeShare(encodeShare(after)).furniture).toEqual(after.furniture);
    s.updateFurniture(owner.id,{x:2000});expect(usePlanner.getState().plan.furniture[1]).toEqual(after.furniture[1]);
  });
});
