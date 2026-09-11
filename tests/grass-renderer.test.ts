// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine,Scene,ArcRotateCamera,Vector3,Ray,Matrix,MeshBuilder,StandardMaterial} from '@babylonjs/core';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import {FurnitureModelLibrary} from '../src/scene/FurnitureModelLibrary';
import {FurnitureFactory} from '../src/scene/FurnitureFactory';
import {performanceScene} from '../qa/performanceScenes';
import {GrassRenderer} from '../src/scene/GrassRenderer';
import {preserveCatalogCoordinates} from '../src/scene/planCoordinates';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {catalog} from '../src/catalog';
import {validatePlan} from '../src/planValidation';
import '@babylonjs/loaders/glTF';
it('batches thousands of detailed grass placements, reuses untouched patches and switches LOD',async()=>{
 const engine=new NullEngine(),scene=new Scene(engine),shadow={addShadowCaster:vi.fn()} as any,library=new FurnitureModelLibrary(scene,shadow,()=>{}),view=new GrassRenderer(scene,library);const camera=new ArcRotateCamera('c',0,0,10,Vector3.Zero(),scene);
 try{const asset=await LoadAssetContainerAsync(readFileSync('public/models/furniture/grass-clump.glb'),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});preserveCatalogCoordinates(asset);(library as any).containers.set('grass-clump',asset);const p=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;p.furniture=Array.from({length:1923},(_,i)=>({id:'g'+i,catalogId:c.id,floorId:p.floors[0].id,x:(i%60)*350,z:Math.floor(i/60)*350,rotation:i%360,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,elevationMm:-200,variant:'sage'}));const before=serializePlan(p);view.update(p,p.floors[0].id);
 const near=scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled());expect(near.length).toBeLessThan(50);expect(new Set(near.flatMap(m=>m.metadata.grassIds)).size).toBe(1923);expect(near.reduce((s,m)=>s+m.getTotalIndices()*(m as any).thinInstanceCount,0)).toBe(asset.meshes.reduce((s,m)=>s+m.getTotalIndices(),0)*1923);expect(shadow.addShadowCaster).not.toHaveBeenCalled();expect(serializePlan(p)).toBe(before);
 view.update({...p,name:'Renamed'},p.floors[0].id);expect(scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled())).toEqual(near);
 camera.setPosition(new Vector3(100,30,100));scene.onBeforeRenderObservable.notifyObservers(scene);const far=scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled());expect(far.length).toBe(near.length);expect(far.reduce((s,m)=>s+m.getTotalIndices(),0)).toBeLessThan(near.reduce((s,m)=>s+m.getTotalIndices(),0));
 view.update(p,p.floors[0].id,'g0');expect(scene.meshes.filter(m=>m.name==='grass-patch').every(m=>!m.metadata.grassIds.includes('g0'))).toBe(true);view.update(p,p.floors[0].id);expect(scene.meshes.some(m=>m.metadata?.grassIds?.includes('g0'))).toBe(true);
 const first=scene.meshes.find(m=>m.metadata?.grassIds?.includes('g0')) as any;const matrix=Matrix.FromArray(first.thinInstanceGetWorldMatrices()[0].asArray());expect(matrix.getTranslation().y).toBeCloseTo(-.15+p.floors[0].elevationMm/1000);
 view.clear();expect(scene.meshes.some(m=>m.name==='grass-patch')).toBe(false);
 }finally{view.dispose();library.dispose();scene.dispose();engine.dispose()}
});
it('gives grass its own budget while preserving IDs in backups',()=>{const p=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;p.furniture=Array.from({length:2100},(_,i)=>({id:'g'+i,catalogId:c.id,floorId:p.floors[0].id,x:i,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}));expect(parsePlan(serializePlan(p))).toEqual(p);p.furniture=p.furniture.map(f=>({...f,catalogId:'small-plant'}));expect(()=>validatePlan(p)).toThrow()});

it('batches different outdoor species separately without losing detailed geometry or edit IDs',async()=>{
 const engine=new NullEngine(),scene=new Scene(engine),library=new FurnitureModelLibrary(scene,{addShadowCaster:vi.fn()} as any,()=>{}),view=new GrassRenderer(scene,library),plan=createSamplePlan();
 try{plan.furniture=[];for(const id of ['daisy-clump','spruce-tree']){const asset=await LoadAssetContainerAsync(readFileSync('public/models/furniture/'+id+'.glb'),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});preserveCatalogCoordinates(asset);(library as any).containers.set(id,asset);const c=catalog.find(c=>c.id===id)!;
 for(let i=0;i<400;i++)plan.furniture.push({id:id+i,catalogId:id,floorId:plan.floors[0].id,x:i%20*300,z:Math.floor(i/20)*300,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'});}
 view.update(plan,plan.floors[0].id);const batches=scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled());expect(batches.length).toBeLessThan(20);expect(new Set(batches.flatMap(m=>m.metadata.grassIds)).size).toBe(800);expect(batches.every(m=>m.getTotalVertices()>100)).toBe(true);
 view.update(plan,plan.floors[0].id,'spruce-tree0');expect(scene.meshes.filter(m=>m.name==='grass-patch').every(m=>!m.metadata.grassIds.includes('spruce-tree0'))).toBe(true);
 }finally{view.dispose();library.dispose();scene.dispose();engine.dispose()}
});

it('bounds cold-load mixed vegetation meshes and retains unchanged species on arrival',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),shadow={addShadowCaster:vi.fn()} as any;
 const factory=new FurnitureFactory(scene,shadow),library={build:()=>false} as unknown as FurnitureModelLibrary;
 const view=new GrassRenderer(scene,library,factory as any),plan=performanceScene('mixed-vegetation').plan;
 try{
 const before=serializePlan(plan);view.update(plan,plan.floors[0].id);
 const patches=()=>scene.meshes.filter(m=>m.name==='grass-patch');
 expect(patches().length).toBeLessThan(1500);
 expect(new Set(patches().flatMap(m=>m.metadata.grassIds)).size).toBe(2000);
 const spruce=patches().find(m=>m.metadata.grassIds.includes('perf-item-7'))!;
 view.invalidate(['lavender-clump']);view.update(plan,plan.floors[0].id);
 expect(patches()).toContain(spruce);expect(serializePlan(plan)).toBe(before);
 view.update(plan,plan.floors[0].id,'perf-item-7');expect(patches().every(m=>!m.metadata.grassIds.includes('perf-item-7'))).toBe(true);
 view.clear();expect(patches()).toHaveLength(0);view.update(plan,plan.floors[0].id);expect(new Set(patches().flatMap(m=>m.metadata.grassIds)).size).toBe(2000);
 }finally{view.dispose();scene.dispose();engine.dispose()}
});

it('preserves thin-instance picking and shared geometry after another patch is removed',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),material=new StandardMaterial('leaves',scene);
 const library={build:()=>false} as unknown as FurnitureModelLibrary;
 const fallback={build:(parent:any)=>{for(const x of [-.1,.1]){const m=MeshBuilder.CreateBox('leaf',{size:.15},scene);m.position.x=x;m.parent=parent;m.material=material;}return true;}};
 const view=new GrassRenderer(scene,library,fallback as any),p=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;
 p.furniture=[0,10000].map((x,i)=>({id:'pick-'+i,catalogId:c.id,floorId:p.floors[0].id,x,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}));
 const pick=()=>scene.pickWithRay(new Ray(new Vector3(10.1,2,0),new Vector3(0,-1,0)),m=>m.name==='grass-patch');
 try{view.update(p,p.floors[0].id);let hit=pick()!;expect(hit.hit).toBe(true);expect(hit.pickedMesh!.metadata.grassIds[hit.thinInstanceIndex]).toBe('pick-1');
 view.update({...p,furniture:p.furniture.slice(1)},p.floors[0].id);hit=pick()!;expect(hit.hit).toBe(true);expect(hit.pickedMesh!.metadata.grassIds[hit.thinInstanceIndex]).toBe('pick-1');
 }finally{view.dispose();scene.dispose();engine.dispose()}
});
