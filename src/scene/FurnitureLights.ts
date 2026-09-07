import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { catalog, isCeilingMounted } from '../catalog';
import type { PlanDocumentV1 } from '../types';

/** Four warm pools nearest the camera; cached shadows include walls, not the bulb. */
export class FurnitureLights {
  private lights=new Map<string,{light:SpotLight;shadow:ShadowGenerator}>();
  private nextUpdate=0;
  constructor(private scene:Scene,private allowsShadow:(mesh:AbstractMesh)=>boolean){}
  update(plan:PlanDocumentV1,floorId:string,nodes:Map<string,{node:TransformNode}>,camera:Vector3,neutral:boolean){
    const now=performance.now();if(now<this.nextUpdate)return;this.nextUpdate=now+150;
    const candidates=plan.furniture.filter(p=>p.floorId===floorId&&catalog.find(c=>c.id===p.catalogId)?.category==='Lighting'&&nodes.has(p.id))
      .sort((a,b)=>Math.hypot(a.x/1000-camera.x,a.z/1000-camera.z)-Math.hypot(b.x/1000-camera.x,b.z/1000-camera.z)).slice(0,4);
    const ids=new Set(candidates.map(p=>p.id));
    for(const [id,entry] of this.lights)if(!ids.has(id)){entry.shadow.dispose();entry.light.dispose();this.lights.delete(id);}
    for(const item of candidates){
      let entry=this.lights.get(item.id);
      if(!entry){
        const light=new SpotLight('fixture:'+item.id,Vector3.Zero(),new Vector3(0,-1,0),Math.PI*.84,1.3,this.scene);
        light.diffuse=new Color3(1,.78,.52);light.specular=new Color3(.35,.24,.12);light.range=4.5;
        const shadow=new ShadowGenerator(256,light);shadow.usePercentageCloserFiltering=true;shadow.bias=.002;shadow.normalBias=.025;
        shadow.customAllowRendering=sub=>this.allowsShadow(sub.getMesh());
        entry={light,shadow};this.lights.set(item.id,entry);
      }
      const node=nodes.get(item.id)!.node;
      const ceiling=isCeilingMounted(item.catalogId);
      entry.light.position.copyFrom(node.position).addInPlace(new Vector3(0,ceiling?.015:item.heightMm*.00078,0));
      entry.light.intensity=plan.camera.darkMode?2.1:neutral?.65:1.1;
      const own=new Set(node.getChildMeshes());
      entry.light.excludedMeshes=[...own];
      const meshes=this.scene.meshes.filter(m=>m.isEnabled()&&!own.has(m)&&!m.name.startsWith('rotation-')&&m.name!=='draft-footprint'&&(m.name.startsWith('wall:')||m.name.startsWith('item:')));
      entry.shadow.getShadowMap()!.renderList=meshes;
    }
    for(const material of this.scene.materials)if('maxSimultaneousLights' in material)material.maxSimultaneousLights=6;
  }
  dispose(){for(const {light,shadow} of this.lights.values()){shadow.dispose();light.dispose();}this.lights.clear();}
}
