import {artisticWater} from './ArtisticWater';
import type {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {basinWater} from '../basinWater';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Scene} from '@babylonjs/core/scene';
import type {PlanDocumentV1} from '../types';
import {landscapeBounds} from '../outdoors';
import {terrainSampler} from '../terrain';
export class TerrainScene{
  private positions:number[]=[];private target:number[]=[];private indices:number[]=[];private gridKey='';private ground?:Mesh;private water?:Mesh;private key='';private soil:StandardMaterial;private river:ShaderMaterial;private time=0;
  constructor(private scene:Scene){
    this.soil=new StandardMaterial('sculpted-ground',scene);this.soil.diffuseColor=Color3.FromHexString('#9cab77');this.soil.specularColor=Color3.Black();this.soil.backFaceCulling=false;
    this.river=artisticWater(scene);
    scene.onBeforeRenderObservable.add(()=>{
      if(this.ground&&this.target.length){let changed=false;const a=1;for(let i=1;i<this.positions.length;i+=3){const d=this.target[i]-this.positions[i];if(Math.abs(d)>.001){this.positions[i]+=d*a;changed=true}else this.positions[i]=this.target[i];}if(changed){const normals:number[]=[];VertexData.ComputeNormals(this.positions,this.indices,normals,{useRightHandedSystem:this.scene.useRightHandedSystem});this.ground.updateVerticesData(VertexBuffer.PositionKind,this.positions,true);this.ground.updateVerticesData(VertexBuffer.NormalKind,normals);}}if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){this.time+=Math.min(50,scene.getEngine().getDeltaTime())/1000;this.river.setFloat('time',this.time)};});
  }
  update(plan:PlanDocumentV1){
    const key=JSON.stringify([plan.environment?.terrain,plan.floors.map(f=>[f.cells,f.cellRects]),plan.gridSizeMm,plan.camera.darkMode,plan.environment?.sun?.night]);if(key===this.key)return;this.key=key;
    this.water?.dispose();this.water=undefined;const strokes=plan.environment?.terrain;if(!strokes?.length){this.ground?.dispose();this.ground=undefined;this.gridKey='';this.target=[];return;}
    this.soil.diffuseColor=Color3.FromHexString(plan.camera.darkMode?'#455748':'#9cab77');const sample=terrainSampler(plan);
    const bounds=landscapeBounds(plan),radius=Math.max(35,bounds.radius+8),points=strokes.flatMap(s=>s.points),minX=Math.min(bounds.x-radius,...points.map(p=>p.x-10)),maxX=Math.max(bounds.x+radius,...points.map(p=>p.x+10)),minZ=Math.min(bounds.z-radius,...points.map(p=>p.z-10)),maxZ=Math.max(bounds.z+radius,...points.map(p=>p.z+10));
    const n=160,positions:number[]=[],indices:number[]=[],uvs:number[]=[],seeds:boolean[]=[];
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=minX+x*(maxX-minX)/n,pz=minZ+z*(maxZ-minZ)/n;positions.push(px,sample(px,pz).height,pz);uvs.push(x/n,z/n);}
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);
      const px=minX+(x+.5)*(maxX-minX)/n,pz=minZ+(z+.5)*(maxZ-minZ)/n;
      seeds.push(sample(px,pz).water);
    }
    const {positions:waterPositions,indices:waterIndices,uvs:waterUvs,beds}=basinWater(positions,n,seeds);
    const make=(name:string,p:number[],i:number[],uv:number[])=>{const mesh=new Mesh(name,this.scene),data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,i,normals,{useRightHandedSystem:this.scene.useRightHandedSystem});data.positions=p;data.indices=i;data.normals=normals;data.uvs=uv;data.applyToMesh(mesh,true);mesh.isPickable=false;return mesh;};
    const gridKey=JSON.stringify([minX,maxX,minZ,maxZ,n]);
    if(!this.ground||this.gridKey!==gridKey){this.ground?.dispose();this.gridKey=gridKey;this.positions=[...positions];this.indices=indices;this.ground=make('sculpted-landscape',this.positions,indices,uvs);this.ground.material=this.soil;this.ground.receiveShadows=true;}this.target=positions;
    if(waterIndices.length){this.water=make('river-surface',waterPositions,waterIndices,waterUvs);this.water.setVerticesData('waterDepth',beds.map(y=>Math.max(0,-.20-y)),false,1);this.water.material=this.river;this.river.setFloat('night',plan.environment?.sun?.night||plan.camera.darkMode?1:0);}
  }
  dispose(){this.ground?.dispose();this.water?.dispose();this.soil.dispose();this.river.dispose();}
}

