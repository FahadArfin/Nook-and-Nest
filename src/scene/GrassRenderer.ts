import {isVegetation} from '../vegetation';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import type {Scene} from '@babylonjs/core/scene';
import type {FurniturePlacement,PlanDocumentV1} from '../types';
import {catalog} from '../catalog';
import type {FurnitureModelLibrary} from './FurnitureModelLibrary';
import '@babylonjs/core/Meshes/thinInstanceMesh';

/** Keep whole disconnected blades for distant LOD, rather than dropping arbitrary triangles. */
export function grassLodIndices(indices:ArrayLike<number>,vertices:number){
 const parent=Array.from({length:vertices},(_,i)=>i);const root=(i:number):number=>parent[i]===i?i:(parent[i]=root(parent[i]));
 for(let i=0;i<indices.length;i+=3){const a=root(indices[i]);parent[root(indices[i+1])]=a;parent[root(indices[i+2])]=a}
 const groups=new Map<number,number[]>();for(let i=0;i<indices.length;i+=3){const key=root(indices[i]),list=groups.get(key)??[];list.push(indices[i],indices[i+1],indices[i+2]);groups.set(key,list)}
 return [...groups.values()].filter((_,i)=>i%3===0).flat();
}
export class GrassRenderer{
 private patches=new Map<string,{meshes:Mesh[];far:Mesh[];signature:string;center:Vector3}>();
 private prototypes=new Map<string,Mesh[]>();private stamp='';private last?:{items:PlanDocumentV1['furniture'];floors:PlanDocumentV1['floors'];floor:string;selected?:string;draft?:string;mode:string};
 constructor(private scene:Scene,private library:FurnitureModelLibrary,private fallback?:Pick<FurnitureModelLibrary,'build'>,private pickable=true,private shadow?:{addShadowCaster:(m:Mesh)=>unknown}){scene.onDisposeObservable.add(()=>this.dispose());scene.onBeforeRenderObservable.add(()=>{const camera=scene.activeCamera;if(!camera)return;for(const p of this.patches.values()){const distant=Vector3.Distance(camera.position,p.center)>22;for(const m of p.meshes)m.setEnabled(!distant);for(const m of p.far)m.setEnabled(distant)}})}
 private prototype(item:FurniturePlacement,ghost:boolean){
  const key=JSON.stringify([item.catalogId,item.variant,item.materialColors,ghost]);if(this.prototypes.has(key))return this.prototypes.get(key)!;
  const def=catalog.find(c=>c.id===item.catalogId)!,node=new TransformNode('grass-source',this.scene);
  if(!this.library.build(node,def,{...item,id:'grass-source'},def.widthMm/1000,def.depthMm/1000,def.heightMm/1000,ghost)){if(this.fallback)this.fallback.build(node,def,item,def.widthMm/1000,def.depthMm/1000,def.heightMm/1000,ghost);else {node.dispose();return}}
  const meshes:Mesh[]=[];
  for(const source of node.getChildMeshes()){if(!(source instanceof Mesh)||!source.getTotalVertices())continue;source.computeWorldMatrix(true);const mesh=source.clone('grass-template',null,true)!;mesh.makeGeometryUnique();mesh.bakeTransformIntoVertices(source.getWorldMatrix());mesh.parent=null;mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.setAll(1);mesh.setEnabled(false);mesh.isPickable=false;meshes.push(mesh)}
  node.dispose(false,false);this.prototypes.set(key,meshes);return meshes;
 }
 update(plan:PlanDocumentV1,floorId:string,selected?:string,draft?:string){
  const mode=plan.camera.mode+':'+plan.camera.ghostBelow;if(this.last?.items===plan.furniture&&this.last.floors===plan.floors&&this.last.floor===floorId&&this.last.selected===selected&&this.last.draft===draft&&this.last.mode===mode)return;this.last={items:plan.furniture,floors:plan.floors,floor:floorId,selected,draft,mode};
  const active=plan.floors.findIndex(f=>f.id===floorId),below=plan.camera.ghostBelow?plan.floors[active-1]?.id:undefined;
  const items=plan.furniture.filter(p=>isVegetation(p.catalogId)&&p.id!==selected&&p.id!==draft&&(p.floorId===floorId||p.floorId===below||plan.camera.mode==='dollhouse'));
  const stamp=JSON.stringify([items,plan.floors.map(f=>[f.id,f.elevationMm]),floorId]);if(stamp===this.stamp)return;this.stamp=stamp;
  const groups=new Map<string,FurniturePlacement[]>();for(const item of items){const key=JSON.stringify([item.catalogId,item.floorId,item.floorId!==floorId,Math.floor(item.x/6000),Math.floor(item.z/6000),item.variant,item.materialColors]);const list=groups.get(key)??[];list.push(item);groups.set(key,list)}
  for(const [key,p] of this.patches)if(!groups.has(key)){[...p.meshes,...p.far].forEach(m=>m.dispose(false,false));this.patches.delete(key)}
  for(const [key,list] of groups){const elevation=plan.floors.find(f=>f.id===list[0].floorId)!.elevationMm,signature=JSON.stringify([list,elevation]);if(this.patches.get(key)?.signature===signature)continue;
   const ghost=list[0].floorId!==floorId;const source=this.prototype(list[0],ghost);if(!source){this.stamp='';this.last=undefined;continue}const old=this.patches.get(key);if(old)[...old.meshes,...old.far].forEach(m=>m.dispose(false,false));
   const def=catalog.find(c=>c.id===list[0].catalogId)!,buffer=new Float32Array(list.length*16);list.forEach((p,i)=>Matrix.Compose(new Vector3(p.widthMm/def.widthMm,p.heightMm/def.heightMm,p.depthMm/def.depthMm),Quaternion.RotationAxis(Vector3.Up(),p.rotation*Math.PI/180),new Vector3(p.x/1000,(elevation+(p.elevationMm??0)+50)/1000,p.z/1000)).copyToArray(buffer,i*16));
   const make=(lod:boolean)=>source.map(s=>{const m=s.clone('grass-patch',null,true)!;m.makeGeometryUnique();if(lod&&list[0].catalogId==='grass-clump')m.setIndices(grassLodIndices(m.getIndices()!,m.getTotalVertices()));m.metadata={grassIds:list.map(p=>p.id),grassBatch:true};m.isPickable=this.pickable&&!ghost;m.thinInstanceEnablePicking=this.pickable&&!ghost;m.receiveShadows=true;m.thinInstanceSetBuffer('matrix',buffer,16,true);m.thinInstanceRefreshBoundingInfo();m.setEnabled(!lod);return m});
   const meshes=make(false);if(this.pickable)for(const m of meshes)this.shadow?.addShadowCaster(m);this.patches.set(key,{meshes,far:make(true),signature,center:new Vector3(list.reduce((s,p)=>s+p.x,0)/list.length/1000,elevation/1000,list.reduce((s,p)=>s+p.z,0)/list.length/1000)});
  }
 }
 clear(){for(const p of this.patches.values())[...p.meshes,...p.far].forEach(m=>m.dispose(false,false));this.patches.clear();this.stamp='';this.last=undefined}
 invalidate(){this.dispose();this.stamp='';this.last=undefined}
 dispose(){for(const p of this.patches.values())[...p.meshes,...p.far].forEach(m=>m.dispose(false,false));for(const p of this.prototypes.values())p.forEach(m=>m.dispose(false,false));this.patches.clear();this.prototypes.clear()}
}
