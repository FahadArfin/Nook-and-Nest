import {describe,it,expect} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {Matrix,Vector3,Quaternion} from '@babylonjs/core/Maths/math.vector';
import {AssetContainer} from '@babylonjs/core/assetContainer';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Culling/ray';
import {configurePlanCoordinates,planViewAngles,preserveCatalogCoordinates,applyPlanView,updatePlanProjection} from '../src/scene/planCoordinates';

describe('studio to 3D orientation',()=>{
  for(const mode of ['top','isometric','dollhouse'] as const)it(`${mode} preserves drawing handedness and picking`,()=>{
    const engine=new NullEngine({renderWidth:1000,renderHeight:1000,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4});
    const scene=new Scene(engine);configurePlanCoordinates(scene);
    const angles=planViewAngles(mode),camera=new ArcRotateCamera('test',angles.alpha,angles.beta,25,new Vector3(5,0,5),scene);
    applyPlanView(camera,mode);updatePlanProjection(camera,1);
    camera.getViewMatrix(true);camera.getProjectionMatrix(true);
    const project=(x:number,z:number)=>Vector3.Project(new Vector3(x,0,z),Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(1000,1000));
    scene.updateTransformMatrix(true);
    const balcony=project(2,1),master=project(8,1),kitchen=project(2,9),living=project(8,9);
    expect(balcony.x).toBeLessThan(master.x);expect(kitchen.x).toBeLessThan(living.x);
    expect(balcony.y).toBeLessThan(kitchen.y);expect(master.y).toBeLessThan(living.y);
    for(const [x,z] of [[2,1],[8,1],[2,9],[8,9]]){
      const p=project(x,z),ray=scene.createPickingRay(p.x,p.y,Matrix.Identity(),camera);
      const hit=ray.origin.add(ray.direction.scale(-ray.origin.y/ray.direction.y));
      expect(hit.x).toBeCloseTo(x,3);expect(hit.z).toBeCloseTo(z,3);
    }
    scene.dispose();engine.dispose();
  });
  it('retains legacy catalog geometry and rotations in the new scene',()=>{
    const engine=new NullEngine(),scene=new Scene(engine);configurePlanCoordinates(scene);
    const container=new AssetContainer(scene),root=new TransformNode('__root__',scene);container.rootNodes=[root];
    preserveCatalogCoordinates(container);
    const expected=Matrix.Compose(new Vector3(1,1,-1),new Quaternion(0,1,0,0),Vector3.Zero());
    const point=new Vector3(.7,.4,-.2);
    expect(Vector3.TransformCoordinates(point,root.computeWorldMatrix(true)).equalsWithEpsilon(Vector3.TransformCoordinates(point,expected))).toBe(true);
    preserveCatalogCoordinates(container);
    expect(root.scaling.z).toBe(-1);
    scene.dispose();engine.dispose();
  });
});
import {readFileSync} from 'node:fs';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

it('preserves world-space GLB surfaces for asymmetric doors, fixtures and stairs',async()=>{
  const engine=new NullEngine();
  for(const id of ['door-flush','window-picture','two-piece-toilet','stairs-l-turn']){
    const sceneOld=new Scene(engine),sceneNew=new Scene(engine);configurePlanCoordinates(sceneNew);
    const data=readFileSync(`public/models/furniture/${id}.glb`);
    const old=await LoadAssetContainerAsync(data,sceneOld,{pluginExtension:'.glb'});
    const next=await LoadAssetContainerAsync(data,sceneNew,{pluginExtension:'.glb'});preserveCatalogCoordinates(next);
    const matrices=(c:AssetContainer)=>c.meshes.filter(m=>m.getTotalVertices()).map(m=>Array.from(m.computeWorldMatrix(true).asArray()));
    const before=matrices(old),after=matrices(next);expect(after.length).toBeGreaterThan(0);expect(after).toEqual(before);
    sceneOld.dispose();sceneNew.dispose();
  }
  engine.dispose();
});

