import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Ray} from '@babylonjs/core/Culling/ray';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import {preserveCatalogCoordinates,configurePlanCoordinates} from '../src/scene/planCoordinates';
import supports from '../src/householdShelfSurfaces.json';

it('measured asymmetric worktop metadata meets the imported geometry in catalog coordinates',async()=>{
 const engine=new NullEngine();const scene=new Scene(engine);configurePlanCoordinates(scene);
 try{
  const bytes=new Uint8Array(readFileSync('public/models/furniture/dressing-table.glb'));
  const container=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb'});
  preserveCatalogCoordinates(container);container.addAllToScene();
  for(const mesh of container.meshes)mesh.computeWorldMatrix(true);
  const plane=supports['dressing-table'][0];
  const hit=scene.pickWithRay(new Ray(new Vector3(plane.x/1000,2,plane.z/1000),new Vector3(0,-1,0)));
  expect(hit?.hit).toBe(true);
  expect(hit!.pickedPoint!.y*1000).toBeCloseTo(plane.height,0);
 }finally{scene.dispose();engine.dispose();}
});

it.each(['manual-recliner','loft-bed','expanding-daybed','expanding-daybed-wide','wall-bed-open','chair-sleeper','chair-sleeper-open','dining-banquette','dining-banquette-corner'])('textile support planes meet actual flat upholstery on %s',async(id)=>{
 const engine=new NullEngine();const scene=new Scene(engine);configurePlanCoordinates(scene);
 try{
  const container=await LoadAssetContainerAsync(new Uint8Array(readFileSync(`public/models/furniture/${id}.glb`)),scene,{pluginExtension:'.glb'});
  preserveCatalogCoordinates(container);container.addAllToScene();
  for(const mesh of container.meshes)mesh.computeWorldMatrix(true);
  const planes=(supports as Record<string,typeof supports['dressing-table']>)[id];
  expect(planes.length).toBeGreaterThan(0);
  for(const plane of planes)for(const [u,v] of [[0,0],[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]){
   const origin=new Vector3((plane.x+u*plane.width)/1000,(plane.height+15)/1000,(plane.z+v*plane.depth)/1000);
   const hit=scene.pickWithRay(new Ray(origin,new Vector3(0,-1,0),.04));
   expect(hit?.hit,`${id}/${plane.id} at ${u},${v}`).toBe(true);
   expect(Math.abs(hit!.pickedPoint!.y*1000-plane.height),`${id}/${plane.id} supported height`).toBeLessThan(1);
  }
 }finally{scene.dispose();engine.dispose();}
});
