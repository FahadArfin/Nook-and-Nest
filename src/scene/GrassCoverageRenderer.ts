import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {PlanDocumentV1,FurniturePlacement} from '../types';
import {terrainSampler} from '../terrain';
import {floorRects} from '../floorGeometry';
import {GrassRenderer} from './GrassRenderer';
import type {FurnitureModelLibrary} from './FurnitureModelLibrary';
import {furnitureGrassMask} from '../grassCoverage';
import {catalog} from '../catalog';
/** Distant coverage remains visible; only camera-local blades become instances. */
export class GrassCoverageRenderer{
 private plan?:PlanDocumentV1;private chunks=new Map<string,{key:string;mesh:Mesh}>();private coverage?:PlanDocumentV1['environment'];private architecture='';private material:StandardMaterial;private grass:GrassRenderer;private key='';private cameraKey='';private observer;private revision=0;private hasCoverage=false;
 constructor(private scene:Scene,library:FurnitureModelLibrary,fallback:Pick<FurnitureModelLibrary,'build'>){this.material=new StandardMaterial('meadow-coverage',scene);this.material.diffuseColor=Color3.FromHexString('#729653');this.material.specularColor=Color3.Black();this.grass=new GrassRenderer(scene,library,fallback,false);this.observer=scene.onBeforeRenderObservable.add(()=>this.updateBlades());}
 invalidate(){this.grass.invalidate();this.cameraKey='';}
 update(plan:PlanDocumentV1){
 const old=this.plan;this.plan=plan;
 if(old&&old.environment?.grassCoverage===plan.environment?.grassCoverage&&old.environment?.terrain===plan.environment?.terrain&&old.floors===plan.floors&&old.furniture===plan.furniture)return;
 const architecture=JSON.stringify([plan.environment?.terrain,plan.floors,plan.furniture.filter(p=>!p.catalogId.includes('grass')).map(p=>[p.catalogId,p.x,p.z,p.widthMm,p.depthMm,p.rotation])]);
 const reset=architecture!==this.architecture;this.architecture=architecture;this.revision++;this.cameraKey='';
 const tiles=Object.keys(plan.environment?.grassCoverage??{});this.hasCoverage=tiles.length>0;
 const groups=new Map<string,string[]>();for(const tile of tiles){const [x,z]=tile.split(':').map(Number),key=Math.floor(x/8)+':'+Math.floor(z/8);const group=groups.get(key)??[];group.push(tile);groups.set(key,group)}
 for(const [key,chunk] of this.chunks)if(!groups.has(key)){chunk.mesh.dispose();this.chunks.delete(key)}
 if(!tiles.length){this.grass.clear();return;}
 const sample=terrainSampler(plan),mask=furnitureGrassMask(plan),rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
 for(const [key,group] of groups){const signature=group.sort().join(',');const previous=this.chunks.get(key);if(previous&&!reset&&previous.key===signature)continue;previous?.mesh.dispose();
 const p:number[]=[],indices:number[]=[],colors:number[]=[];
 for(const tile of group){const [x,z]=tile.split(':').map(Number);if(rects.some(r=>(x+1)*1000>r.x&&x*1000<r.x+r.width&&(z+1)*1000>r.z&&z*1000<r.z+r.depth)||sample(x+.5,z+.5).water||mask(x+.5,z+.5,.71))continue;const base=p.length/3;
 for(const [dx,dz] of [[0,0],[1,0],[0,1],[1,1]]){p.push(x+dx,sample(x+dx,z+dz).height+.012,z+dz);const tint=.88+((Math.imul(x+dx,13)^Math.imul(z+dz,31))>>>0)%17/100;colors.push(tint,tint,tint,1)}indices.push(base,base+2,base+1,base+1,base+2,base+3)}
 const data=new VertexData();data.positions=p;data.indices=indices;data.colors=colors;const normals:number[]=[];VertexData.ComputeNormals(p,indices,normals);data.normals=normals;
 const mesh=new Mesh('grass-coverage:'+key,this.scene);data.applyToMesh(mesh);mesh.material=this.material;mesh.isPickable=false;mesh.receiveShadows=true;this.chunks.set(key,{key:signature,mesh});
 }
 }
 private updateBlades(){const plan=this.plan,camera=this.scene.activeCamera;if(!plan||!camera)return;const coverage=plan.environment?.grassCoverage;if(!coverage||!this.hasCoverage||!plan.floors.length)return;const target=(camera as any).target as Vector3|undefined,center=target??camera.position;const cx=Math.floor(center.x/4)*4,cz=Math.floor(center.z/4)*4,key=cx+':'+cz+':'+this.revision;if(key===this.cameraKey)return;this.cameraKey=key;
 const floor=[...plan.floors].sort((a,b)=>a.elevationMm-b.elevationMm)[0],c=catalog.find(c=>c.id==='grass-clump')!,sample=terrainSampler(plan),mask=furnitureGrassMask(plan),rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm)),items:FurniturePlacement[]=[];
 for(let ring=0;ring<=20&&items.length<12000;ring++)for(let x=cx-ring;x<=cx+ring&&items.length<12000;x++)for(let z=cz-ring;z<=cz+ring&&items.length<12000;z++){if(Math.max(Math.abs(x-cx),Math.abs(z-cz))!==ring)continue;const density=coverage[x+':'+z];if(!density)continue;const count=Math.min(25,4+density*2);for(let i=0;i<count&&items.length<12000;i++){const px=x+((i*17+3)%29)/29,pz=z+((i*11+7)%31)/31;if(rects.some(r=>px*1000>=r.x&&px*1000<=r.x+r.width&&pz*1000>=r.z&&pz*1000<=r.z+r.depth))continue;const ground=sample(px,pz);if(ground.water||mask(px,pz,.1))continue;items.push({id:'coverage:'+x+':'+z+':'+i,catalogId:c.id,floorId:floor.id,x:px*1000,z:pz*1000,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,rotation:(i*137+x*23+z*11)%360,variant:'sage',elevationMm:ground.height*1000-floor.elevationMm-50})}}
 this.grass.update({...plan,furniture:items},floor.id);
 }
 dispose(){this.scene.onBeforeRenderObservable.remove(this.observer);this.grass.dispose();for(const {mesh} of this.chunks.values())mesh.dispose();this.chunks.clear();this.material.dispose();}
}
