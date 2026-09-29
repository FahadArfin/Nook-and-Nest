import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Ray} from '@babylonjs/core/Culling/ray';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import {preserveCatalogCoordinates,configurePlanCoordinates} from '../src/scene/planCoordinates';
import {garageWallOffsetMm} from '../src/householdArchitectureGeometry';
import {createHouseholdArchitectureReview} from '../src/householdArchitectureReview';

it('matches imported roof reveals, garage leaf anchor and spiral landing to their real host dimensions',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);configurePlanCoordinates(scene);
  const load=async(id:string,stair=false)=>{
    const container=await LoadAssetContainerAsync(new Uint8Array(readFileSync(`public/models/furniture/${id}.glb`)),scene,{pluginExtension:'.glb'});
    preserveCatalogCoordinates(container);container.addAllToScene();
    const wrapper=new TransformNode(id+'-review-orientation',scene);
    if(stair)wrapper.rotation.y=Math.PI;
    for(const node of container.rootNodes)node.parent=wrapper;
    for(const mesh of container.meshes)mesh.computeWorldMatrix(true);
    return {container,wrapper};
  };
  const pick=(origin:Vector3,direction:Vector3)=>scene.pickWithRay(new Ray(origin,direction));
  try{
    let model=await load('roof-skylight');
    const reveal=pick(new Vector3(0,.16,0),new Vector3(1,0,0));
    expect(reveal?.hit).toBe(true);expect(reveal!.pickedPoint!.x*1000).toBeCloseTo(362,0);
    model.container.dispose();model.wrapper.dispose();
    model=await load('sectional-garage-door');
    const garage=createHouseholdArchitectureReview().furniture.find(p=>p.catalogId==='sectional-garage-door')!;
    const leaf=pick(new Vector3(0,1.2,2),new Vector3(0,0,-1));
    expect(leaf?.hit).toBe(true);expect(leaf!.pickedPoint!.z*1000).toBeCloseTo(garageWallOffsetMm(garage)+22,0);
    model.container.dispose();model.wrapper.dispose();
    model=await load('spiral-staircase',true);
    for(const [x,z] of [[-.15,-.87],[1.04,0]]){
      const top=pick(new Vector3(x,4,z),new Vector3(0,-1,0));expect(top?.hit).toBe(true);
      expect(top!.pickedPoint!.y*1000).toBeCloseTo(2800,0);
    }
    expect(pick(new Vector3(.97,4,0),new Vector3(0,-1,0))?.hit).toBe(false);
    model.container.dispose();model.wrapper.dispose();
  }finally{scene.dispose();engine.dispose();}
});
