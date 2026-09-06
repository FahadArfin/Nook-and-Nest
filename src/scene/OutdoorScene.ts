import {useGoogleScenery} from '../googleScenery';
import type {GoogleTorontoScene} from './GoogleTorontoScene';
import {applyTorontoAerialRoofs} from './torontoAerial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {floorRects} from '../floorGeometry';
import {preserveCatalogCoordinates} from './planCoordinates';
import {modelAssetPath} from "../modelAssetPath";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { grassPoints,groundY,landscapeBounds } from '../outdoors';
import type { PlanDocumentV1 } from '../types';
/** Cached background assets; decorations never participate in editor picking. */
export class OutdoorScene {
  private assets=new Map<string,AssetContainer>();private pending=new Set<string>();private failed=new Set<string>();private root?:TransformNode;private key='';private plan?:PlanDocumentV1;private disposed=false;
  private google?:GoogleTorontoScene;private googleLoading=false;private googleFailed=false;
  constructor(private scene:Scene){}
  private load(id:string){if(this.assets.has(id)||this.pending.has(id)||this.failed.has(id))return;this.pending.add(id);LoadAssetContainerAsync(modelAssetPath(id),this.scene).then(c=>{if(this.disposed)c.dispose();else {if(id!=='backdrop-city')preserveCatalogCoordinates(c);else applyTorontoAerialRoofs(c,this.scene,()=>!!this.plan?.camera.darkMode);this.assets.set(id,c)}}).catch(()=>this.failed.add(id)).finally(()=>{this.pending.delete(id);if(!this.disposed&&this.plan){this.key='';this.update(this.plan)}});}
  update(plan:PlanDocumentV1){
    this.plan=plan;
    if(plan.environment?.background==='city'&&plan.environment.citySource==='google'&&!this.google&&!this.googleLoading&&!this.googleFailed){this.googleLoading=true;import('./GoogleTorontoScene').then(({GoogleTorontoScene})=>{if(!this.disposed){this.google=new GoogleTorontoScene(this.scene);this.google.update(this.plan!);}}).catch(()=>{this.googleFailed=true;useGoogleScenery.setState({status:'The Google viewer could not load. Reload the app to retry.'});}).finally(()=>{this.googleLoading=false;});}
    this.google?.update(plan);
    const env=plan.environment??{background:'plain',grass:'off'};
    for(const material of this.assets.get('backdrop-city')?.materials??[])if(material instanceof PBRMaterial){const night=!!plan.camera.darkMode;material.emissiveColor=(material.name==='city-window-lights'||material.emissiveTexture?.name==='Toronto window lights')?(night?new Color3(1,.66,.27):Color3.Black()):Color3.Black();material.environmentIntensity=night?.25:1;}
    const key=JSON.stringify([env,plan.floors.map(f=>[f.cells,f.cellRects]),plan.gridSizeMm,plan.furniture.map(f=>[f.x,f.z,f.widthMm,f.depthMm,f.rotation])]);if(key===this.key)return;this.key=key;
    this.root?.dispose(false,false);this.root=new TransformNode('outdoor-scenery',this.scene);const bounds=landscapeBounds(plan);
    if(env.background!=='plain'&&!(env.background==='city'&&env.citySource==='google')){
      const id=`backdrop-${env.background}`,asset=this.assets.get(id);if(!asset)this.load(id);else{
        const group=new TransformNode('distant-surroundings',this.scene);group.parent=this.root;group.rotation.y=(env.backdropRotation??0)*Math.PI/180;group.position.set(bounds.x,groundY,bounds.z);if(env.background==='city')group.scaling.setAll(1);else group.scaling.set(bounds.radius/20,1,bounds.radius/20);
        const copy=asset.instantiateModelsToScene(n=>`scenery:${n}`,false,{doNotInstantiate:true});for(const n of copy.rootNodes){n.parent=group;for(const m of n.getChildMeshes())m.isPickable=false;}
      }
    }
    if(env.background==='city'){
      const id='backdrop-apartment-base',asset=this.assets.get(id),rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
      if(!asset)this.load(id);else if(rects.length){const x0=Math.min(...rects.map(r=>r.x))/1000,x1=Math.max(...rects.map(r=>r.x+r.width))/1000,z0=Math.min(...rects.map(r=>r.z))/1000,z1=Math.max(...rects.map(r=>r.z+r.depth))/1000;
        const shell=new TransformNode('apartment-building-below',this.scene);shell.parent=this.root;shell.position.set((x0+x1)/2,-.12,(z0+z1)/2);shell.scaling.set((x1-x0)/10,80/30,(z1-z0)/10);const copy=asset.instantiateModelsToScene(n=>`scenery:${n}`,false,{doNotInstantiate:true});for(const n of copy.rootNodes){n.parent=shell;for(const m of n.getChildMeshes())m.isPickable=false;}
      }
    }
    if(env.grass!=='off'){
      const asset=this.assets.get('grass-clump');if(!asset)this.load('grass-clump');else{
        const points=grassPoints(plan);if(!points.length)return;
        const buffer=new Float32Array(points.length*16);points.forEach((p,i)=>Matrix.Compose(new Vector3(p.scale,p.scale,p.scale),Quaternion.RotationAxis(Vector3.Up(),p.angle),new Vector3(p.x,p.y,p.z)).copyToArray(buffer,i*16));
        for(const source of asset.meshes){if(!(source instanceof Mesh)||!source.getTotalVertices())continue;source.computeWorldMatrix(true);const mesh=source.clone('instanced-grass',null,true);if(!mesh)continue;mesh.makeGeometryUnique();mesh.bakeTransformIntoVertices(source.getWorldMatrix());mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.setAll(1);mesh.parent=this.root;mesh.isVisible=true;mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;mesh.thinInstanceSetBuffer('matrix',buffer,16,true);mesh.receiveShadows=false;if(mesh.material instanceof PBRMaterial)mesh.material.backFaceCulling=false;}
      }
    }
  }
  dispose(){this.disposed=true;this.google?.dispose();this.root?.dispose(false,false);for(const asset of this.assets.values())asset.dispose();}
}



