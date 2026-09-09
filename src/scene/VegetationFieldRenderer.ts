import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {terrainSampler} from '../terrain';
import {floorRects} from '../floorGeometry';
import {furnitureGrassMask} from '../grassCoverage';
import {visibleField} from '../vegetationVisibility';
import type {Ray} from '@babylonjs/core/Culling/ray';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Camera} from '@babylonjs/core/Cameras/camera';
import {RenderTargetTexture} from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {PlanDocumentV1} from '../types';
import {catalog} from '../catalog';
import {fieldCount,fieldResolver,type VegetationField,fieldId} from '../vegetationField';
import type {FieldCandidate} from '../vegetationVisibility';
import type {FurnitureModelLibrary} from './FurnitureModelLibrary';
import {GrassRenderer} from './GrassRenderer';

/** Persistent millions of plants, bounded camera-local geometry and proxy batches. */
export class VegetationFieldRenderer{
 private ground=new Map<string,{mesh:Mesh;signature:string}>();private groundArchitecture='';
 private plan?:PlanDocumentV1;private field?:VegetationField;private worker?:Worker;private revision=0;private busy=false;private dirty=true;private viewKey='';private disposed=false;
 private detail:GrassRenderer;private proxies=new Map<string,Mesh>();
 private images=new Map<string,{material:ShaderMaterial;texture:RenderTargetTexture;camera:FreeCamera;node:TransformNode;releaseCapture:()=>void}>();
 private budget=18000;private budgetAt=0;private frameAverage=16;
 private observer;private candidates:FieldCandidate[]=[];private floor='';
 constructor(private scene:Scene,private library:FurnitureModelLibrary,private fallback:Pick<FurnitureModelLibrary,'build'>){
  this.detail=new GrassRenderer(scene,library,fallback,true);
  try{this.worker=new Worker(new URL('../vegetationVisibility.worker.ts',import.meta.url),{type:'module'});}catch{this.worker=undefined;}
  if(this.worker){this.worker.onmessage=({data})=>{this.busy=false;if(this.disposed||data.revision!==this.revision)return;this.candidates=data.candidates;this.apply();};
  this.worker.onerror=()=>{this.busy=false;this.worker?.terminate();this.worker=undefined;this.viewKey='';};}
  this.observer=scene.onBeforeRenderObservable.add(()=>this.tick());
 }
 update(plan:PlanDocumentV1){if(this.plan===plan)return;const changed=this.plan?.environment!==plan.environment||this.plan?.floors!==plan.floors||this.plan?.furniture!==plan.furniture;this.plan=plan;if(changed){this.field=plan.environment?.vegetationField;this.floor=[...plan.floors].sort((a,b)=>a.elevationMm-b.elevationMm)[0]?.id??'';this.revision++;this.dirty=true;this.updateGround();this.viewKey='';if(!this.field){this.detail.clear();for(const m of this.proxies.values())m.dispose();this.proxies.clear();}}}
 invalidate(ids:string[]){this.detail.invalidate(ids);for(const [key,image] of this.images)if(ids.includes(key.split('|')[0])){this.disposeImage(image);this.images.delete(key);}this.viewKey='';}
 private tick(){
  const camera=this.scene.activeCamera as any;if(!camera||!this.plan||!this.field)return;
  const now=performance.now();this.frameAverage=this.frameAverage*.98+Math.min(100,this.scene.getEngine().getDeltaTime())*.02;if(now-this.budgetAt>3000){const next=this.frameAverage>25?Math.max(6000,this.budget-3000):this.frameAverage<17?Math.min(18000,this.budget+1500):this.budget;this.budgetAt=now;if(next!==this.budget){this.budget=next;this.viewKey='';}}
  const target=camera.target??camera.position,span=camera.mode===Camera.ORTHOGRAPHIC_CAMERA?Math.abs(camera.orthoTop-camera.orthoBottom):Math.max(8,camera.radius??40);
  for(const image of this.images.values()){image.material.setVector3('cameraRight',camera.getDirection(Vector3.Right()));image.material.setVector3('cameraUp',camera.getDirection(Vector3.Up()));}
  const key=[Math.floor(target.x/2),Math.floor(target.z/2),Math.round(span/4),Math.round((camera.alpha??0)/(Math.PI/2)),(camera.beta??1)<.3?1:0].join(':');
  if(this.busy||key===this.viewKey)return;this.viewKey=key;this.busy=true;
  const view={x:target.x,z:target.z,span,budget:this.budget};if(this.worker)this.worker.postMessage({revision:this.revision,field:this.dirty?this.field:undefined,view});else{this.busy=false;this.candidates=visibleField(this.field,view);this.apply();}this.dirty=false;
 }
 private updateGround(){
  if(!this.plan)return;
  const architecture=JSON.stringify([this.plan.environment?.terrain,this.plan.floors,this.plan.furniture.filter(p=>!p.terrainAnchored)]),reset=architecture!==this.groundArchitecture;this.groundArchitecture=architecture;
  const groups=new Map<string,Array<[string,number]>>();for(const entry of Object.entries(this.field?.cells??{})){if(!entry[0].startsWith('grass-clump|'))continue;const [,x,z]=entry[0].split('|'),key=Math.floor(+x/4)+':'+Math.floor(+z/4);const list=groups.get(key)??[];list.push(entry);groups.set(key,list);}
  for(const [key,g] of this.ground)if(!groups.has(key)){g.mesh.dispose(false,true);this.ground.delete(key);}
  for(const [chunk,entries] of groups){const signature=JSON.stringify(entries);const old=this.ground.get(chunk);if(!reset&&old?.signature===signature)continue;old?.mesh.dispose(false,true);this.ground.delete(chunk);
  const positions:number[]=[],indices:number[]=[],colors:number[]=[],sample=terrainSampler(this.plan),mask=furnitureGrassMask(this.plan),rects=this.plan.floors.flatMap(f=>floorRects(f,this.plan!.gridSizeMm));
  for(const [key,count] of entries){
   const [species,sx,sz]=key.split('|');if(species!=='grass-clump')continue;const x=+sx*4,z=+sz*4;
   for(let dx=0;dx<4;dx++)for(let dz=0;dz<4;dz++){const px=x+dx,pz=z+dz;if(sample(px+.5,pz+.5).water||mask(px+.5,pz+.5,.7)||rects.some(r=>(px+1)*1000>r.x&&px*1000<r.x+r.width&&(pz+1)*1000>r.z&&pz*1000<r.z+r.depth))continue;
    const base=positions.length/3,tint=.9+((Math.imul(px,73856093)^Math.imul(pz,19349663))>>>0)%11/100;
    for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]]){positions.push(px+a,sample(px+a,pz+b).height+.01,pz+b);colors.push(tint,tint,tint,Math.min(1,count/200));}indices.push(base,base+1,base+2,base+1,base+3,base+2);
   }
  }
  if(!indices.length)continue;const data=new VertexData();data.positions=positions;data.indices=indices;data.colors=colors;const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;
  const mesh=new Mesh('field-ground',this.scene);data.applyToMesh(mesh);mesh.isPickable=false;mesh.receiveShadows=true;const material=new StandardMaterial('field-ground',this.scene);material.diffuseColor=Color3.FromHexString('#729653');material.specularColor=Color3.Black();mesh.material=material;this.ground.set(chunk,{mesh,signature});
  }
 }
 private image(species:string,angle:number){
  const key=species+'|'+angle;let entry=this.images.get(key);if(entry)return entry.material;
  const c=catalog.find(c=>c.id===species)!;const node=new TransformNode('field-capture',this.scene),item={id:'capture',catalogId:species,floorId:this.floor,x:0,z:0,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};
  if(!this.library.build(node,c,item,c.widthMm/1000,c.depthMm/1000,c.heightMm/1000,false))this.fallback.build(node,c,item,c.widthMm/1000,c.depthMm/1000,c.heightMm/1000,false);
  const meshes=node.getChildMeshes();const captureMaterials=meshes.map(m=>{const material=m.material?.clone('field-capture-material');if(material){m.material=material;material.unfreeze();}return material;});for(const m of meshes){m.layerMask=0x10000000;m.isPickable=false;for(const light of this.scene.lights)(light as any).getShadowGenerator?.()?.removeShadowCaster(m);}if(this.scene.activeCamera)this.scene.activeCamera.layerMask&=~0x10000000;
  const size=Math.max(c.widthMm,c.depthMm,c.heightMm)/1000*1.15,center=new Vector3(0,c.heightMm/2000,0),a=angle*Math.PI/2;
  const camera=new FreeCamera('field-capture-camera',center.add(angle===4?new Vector3(0,size*3,.001):new Vector3(Math.cos(a)*size*3,size*1.5,Math.sin(a)*size*3)),this.scene);camera.setTarget(center);camera.mode=Camera.ORTHOGRAPHIC_CAMERA;camera.orthoLeft=camera.orthoBottom=-size/2;camera.orthoRight=camera.orthoTop=size/2;camera.minZ=.001;camera.layerMask=0x10000000;
  const texture=new RenderTargetTexture('field-view:'+key,128,this.scene,false,true);texture.activeCamera=camera;texture.renderList=meshes;texture.clearColor=new Color4(0,0,0,0);texture.hasAlpha=true;texture.updateSamplingMode(2);texture.refreshRate=1;this.scene.customRenderTargets.push(texture);
  const material=new ShaderMaterial('field-proxy:'+key,this.scene,{vertexSource:`precision highp float;
+attribute vec3 position;attribute vec2 uv;varying vec2 vUV;uniform mat4 viewProjection;uniform vec3 cameraRight;uniform vec3 cameraUp;
+#include<instancesDeclaration>
+void main(){
+#include<instancesVertex>
+vUV=uv;vec3 center=finalWorld[3].xyz;float size=length(finalWorld[0].xyz);gl_Position=viewProjection*vec4(center+size*(cameraRight*position.x+cameraUp*position.y),1.0);}`.replaceAll('\n+','\n'),fragmentSource:`precision highp float;varying vec2 vUV;uniform sampler2D image;void main(){vec4 c=texture2D(image,vUV);if(c.a<.35)discard;gl_FragColor=vec4(c.rgb,1.0);}`},{attributes:['position','uv'],uniforms:['world','viewProjection','cameraRight','cameraUp'],samplers:['image'],needAlphaTesting:true});
  material.setTexture('image',texture);material.setVector3('cameraRight',this.scene.activeCamera!.getDirection(Vector3.Right()));material.setVector3('cameraUp',this.scene.activeCamera!.getDirection(Vector3.Up()));material.backFaceCulling=false;
  let released=false;const releaseCapture=()=>{if(released)return;released=true;node.dispose(false,false);for(const material of captureMaterials)material?.dispose(false,false);};let readyFrames=0;const capture=texture.onAfterRenderObservable.add(()=>{if(!meshes.every(m=>m.isReady(true))){readyFrames=0;return;}if(++readyFrames<2)return;texture.refreshRate=0;const targetIndex=this.scene.customRenderTargets.indexOf(texture);if(targetIndex>=0)this.scene.customRenderTargets.splice(targetIndex,1);texture.onAfterRenderObservable.remove(capture);texture.renderList=[];releaseCapture();});
  entry={material,texture,camera,node,releaseCapture};this.images.set(key,entry);return material;
 }
 private apply(){
  if(!this.plan||!this.field)return;const camera=this.scene.activeCamera as any;
  const angle=(camera.beta??1)<.3?4:((Math.round((camera.alpha??0)/(Math.PI/2))%4)+4)%4;
  const resolve=fieldResolver(this.plan);
  const detailed=[];const groups=new Map<string,{matrices:number[];ids:string[]}>();
  for(const c of this.candidates){const p=resolve(fieldId(c.key,c.index));if(!p)continue;
   if(c.distance<12&&c.weight<=2&&detailed.length<Math.floor((p.catalogId==='grass-clump'?1024:128)*this.budget/18000)){detailed.push(p);continue;}
   const species=p.catalogId,key=species+'|'+c.key.split('|').slice(1).map(v=>Math.floor(+v/4)).join('|'),group=groups.get(key)??{matrices:[],ids:[]};
   // Aggregated distant samples cover the same area rather than leaving empty rings.
   const size=Math.max(p.widthMm,p.depthMm,p.heightMm)/1000*1.15*Math.min(2.5,Math.sqrt(c.weight));
   const rotation=Quaternion.FromEulerAngles((Math.PI/2)-(camera.beta??1),-(camera.alpha??0)-Math.PI/2,0);
   const matrix=Matrix.Compose(new Vector3(size,size,1),rotation,new Vector3(p.x/1000,((p.elevationMm??0)+(this.plan.floors.find(f=>f.id===this.floor)?.elevationMm??0))/1000+size*.4,p.z/1000));group.matrices.push(...matrix.asArray());group.ids.push(p.id);groups.set(key,group);
  }
  this.detail.update({...this.plan,furniture:detailed},this.floor);
  for(const [key,m] of this.proxies)if(!groups.has(key)){m.dispose();this.proxies.delete(key);}
  for(const [key,group] of groups){let mesh=this.proxies.get(key);if(!mesh){mesh=MeshBuilder.CreatePlane('field-proxy',{size:1},this.scene);this.proxies.set(key,mesh);}mesh.material=this.image(key.split('|')[0],angle);mesh.metadata={grassIds:group.ids,grassBatch:true,fieldMatrices:group.matrices};mesh.isPickable=false;mesh.thinInstanceEnablePicking=false;mesh.thinInstanceSetBuffer('matrix',new Float32Array(group.matrices),16,true);mesh.thinInstanceRefreshBoundingInfo();}
  const canvas=this.scene.getEngine().getRenderingCanvas();if(canvas){canvas.dataset.fieldBudget=String(this.budget);canvas.dataset.fieldPlants=String(fieldCount(this.field));canvas.dataset.fieldDetailed=String(detailed.length);canvas.dataset.fieldProxies=String([...groups.values()].reduce((a,b)=>a+b.ids.length,0));}
 }
 pick(ray:Ray,maxDistance=Infinity){let selected:string|undefined,best=maxDistance;
  for(const mesh of this.proxies.values()){
   if(!ray.intersectsSphere(mesh.getBoundingInfo().boundingSphere))continue;
   const values=mesh.metadata.fieldMatrices as number[],ids=mesh.metadata.grassIds as string[];
   for(let i=0;i<ids.length;i++){const o=i*16,dx=values[o+12]-ray.origin.x,dy=values[o+13]-ray.origin.y,dz=values[o+14]-ray.origin.z;
    const t=dx*ray.direction.x+dy*ray.direction.y+dz*ray.direction.z;if(t<0||t>best)continue;
    const radius=Math.hypot(values[o],values[o+1],values[o+2])*.38;
    if(dx*dx+dy*dy+dz*dz-t*t<radius*radius){selected=ids[i];best=t;}
   }
  }return selected;
 }
 private disposeImage(i:{material:ShaderMaterial;texture:RenderTargetTexture;camera:FreeCamera;node:TransformNode;releaseCapture:()=>void}){const index=this.scene.customRenderTargets.indexOf(i.texture);if(index>=0)this.scene.customRenderTargets.splice(index,1);i.texture.dispose();i.material.dispose();i.releaseCapture();i.camera.dispose();}
 dispose(){this.disposed=true;this.worker?.terminate();for(const g of this.ground.values())g.mesh.dispose(false,true);this.ground.clear();this.scene.onBeforeRenderObservable.remove(this.observer);this.detail.dispose();for(const m of this.proxies.values())m.dispose();this.proxies.clear();for(const i of this.images.values())this.disposeImage(i);this.images.clear();}
}
