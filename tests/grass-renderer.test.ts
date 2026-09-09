// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine,Scene,ArcRotateCamera,Vector3,Ray,Matrix} from '@babylonjs/core';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import {FurnitureModelLibrary} from '../src/scene/FurnitureModelLibrary';
import {GrassRenderer} from '../src/scene/GrassRenderer';
import {preserveCatalogCoordinates} from '../src/scene/planCoordinates';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {catalog} from '../src/catalog';
import {validatePlan} from '../src/planValidation';
import '@babylonjs/loaders/glTF';
it('batches thousands of detailed grass placements, reuses untouched patches and switches LOD',async()=>{
 const engine=new NullEngine(),scene=new Scene(engine),shadow={addShadowCaster:vi.fn()} as any,library=new FurnitureModelLibrary(scene,shadow,()=>{}),view=new GrassRenderer(scene,library);const camera=new ArcRotateCamera('c',0,0,10,Vector3.Zero(),scene);
 try{const asset=await LoadAssetContainerAsync(readFileSync('public/models/furniture/grass-clump.glb'),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});preserveCatalogCoordinates(asset);(library as any).containers.set('grass-clump',asset);const p=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;p.furniture=Array.from({length:1923},(_,i)=>({id:'g'+i,catalogId:c.id,floorId:p.floors[0].id,x:(i%60)*350,z:Math.floor(i/60)*350,rotation:i%360,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,elevationMm:-200,variant:'sage'}));const before=serializePlan(p);view.update(p,p.floors[0].id);
 const near=scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled());expect(near.length).toBeLessThan(50);expect(near.reduce((s,m)=>s+(m as any).thinInstanceCount,0)).toBe(1923*2);expect(shadow.addShadowCaster).not.toHaveBeenCalled();expect(serializePlan(p)).toBe(before);
 view.update({...p,name:'Renamed'},p.floors[0].id);expect(scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled())).toEqual(near);
 camera.setPosition(new Vector3(100,30,100));scene.onBeforeRenderObservable.notifyObservers(scene);const far=scene.meshes.filter(m=>m.name==='grass-patch'&&m.isEnabled());expect(far.length).toBe(near.length);expect(far.reduce((s,m)=>s+m.getTotalIndices(),0)).toBeLessThan(near.reduce((s,m)=>s+m.getTotalIndices(),0));
 view.update(p,p.floors[0].id,'g0');expect(scene.meshes.filter(m=>m.name==='grass-patch').every(m=>!m.metadata.grassIds.includes('g0'))).toBe(true);view.update(p,p.floors[0].id);expect(scene.meshes.some(m=>m.metadata?.grassIds?.includes('g0'))).toBe(true);
 const first=scene.meshes.find(m=>m.metadata?.grassIds?.includes('g0')) as any;const matrix=Matrix.FromArray(first.thinInstanceGetWorldMatrices()[0].asArray());expect(matrix.getTranslation().y).toBeCloseTo(-.15+p.floors[0].elevationMm/1000);
 view.clear();expect(scene.meshes.some(m=>m.name==='grass-patch')).toBe(false);
 }finally{view.dispose();library.dispose();scene.dispose();engine.dispose()}
});
it('gives grass its own budget while preserving IDs in backups',()=>{const p=createSamplePlan(),c=catalog.find(c=>c.id==='grass-clump')!;p.furniture=Array.from({length:2100},(_,i)=>({id:'g'+i,catalogId:c.id,floorId:p.floors[0].id,x:i,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'}));expect(parsePlan(serializePlan(p))).toEqual(p);p.furniture=p.furniture.map(f=>({...f,catalogId:'small-plant'}));expect(()=>validatePlan(p)).toThrow()});
