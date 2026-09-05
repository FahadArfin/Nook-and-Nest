import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Scene} from '@babylonjs/core/scene';
import type {PlanDocumentV1} from '../types';
import {landscapeBounds} from '../outdoors';
import {terrainSampler} from '../terrain';
export class TerrainScene{
  private ground?:Mesh;private water?:Mesh;private key='';private soil:StandardMaterial;private river:StandardMaterial;private texture:DynamicTexture;
  constructor(private scene:Scene){
    this.soil=new StandardMaterial('sculpted-ground',scene);this.soil.diffuseColor=Color3.FromHexString('#9cab77');this.soil.specularColor=Color3.Black();
    this.river=new StandardMaterial('flowing-river',scene);this.river.diffuseColor=Color3.FromHexString('#80b9bb');this.river.specularColor=new Color3(.2,.3,.3);this.river.alpha=.84;
    this.texture=new DynamicTexture('water-ripples',{width:64,height:64},scene,false);const c=this.texture.getContext();c.fillStyle='#8fbdbb';c.fillRect(0,0,64,64);c.strokeStyle='#bddbd0';c.lineWidth=2;for(let y=0;y<64;y+=16){c.beginPath();for(let x=0;x<=64;x+=4)c.lineTo(x,y+3*Math.sin(x*Math.PI/32));c.stroke();}this.texture.update();this.texture.uScale=12;this.texture.vScale=12;this.river.diffuseTexture=this.texture;
    scene.onBeforeRenderObservable.add(()=>{if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)this.texture.vOffset=(this.texture.vOffset+scene.getEngine().getDeltaTime()*.000012)%1;});
  }
  update(plan:PlanDocumentV1){
    const key=JSON.stringify([plan.environment?.terrain,plan.floors.map(f=>[f.cells,f.cellRects]),plan.gridSizeMm,plan.camera.darkMode]);if(key===this.key)return;this.key=key;
    this.ground?.dispose();this.water?.dispose();const strokes=plan.environment?.terrain;if(!strokes?.length)return;
    this.soil.diffuseColor=Color3.FromHexString(plan.camera.darkMode?'#455748':'#9cab77');const sample=terrainSampler(plan);
    const bounds=landscapeBounds(plan),radius=Math.max(35,bounds.radius+8),points=strokes.flatMap(s=>s.points),minX=Math.min(bounds.x-radius,...points.map(p=>p.x-10)),maxX=Math.max(bounds.x+radius,...points.map(p=>p.x+10)),minZ=Math.min(bounds.z-radius,...points.map(p=>p.z-10)),maxZ=Math.max(bounds.z+radius,...points.map(p=>p.z+10));
    const n=160,positions:number[]=[],indices:number[]=[],uvs:number[]=[],waterPositions:number[]=[],waterIndices:number[]=[],waterUvs:number[]=[];
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=minX+x*(maxX-minX)/n,pz=minZ+z*(maxZ-minZ)/n;positions.push(px,sample(px,pz).height,pz);uvs.push(x/n,z/n);}
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);
      const px=minX+(x+.5)*(maxX-minX)/n,pz=minZ+(z+.5)*(maxZ-minZ)/n;
      if(sample(px,pz).water&&[a,b,c,d].every(i=>sample(positions[i*3],positions[i*3+2]).water)){
        const offset=waterPositions.length/3;for(const i of [a,b,c,d]){waterPositions.push(positions[i*3],-.20,positions[i*3+2]);waterUvs.push(positions[i*3]/4,positions[i*3+2]/4);}waterIndices.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3);
      }
    }
    const make=(name:string,p:number[],i:number[],uv:number[])=>{const mesh=new Mesh(name,this.scene),data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,i,normals);data.positions=p;data.indices=i;data.normals=normals;data.uvs=uv;data.applyToMesh(mesh);mesh.isPickable=false;return mesh;};
    this.ground=make('sculpted-landscape',positions,indices,uvs);this.ground.material=this.soil;this.ground.receiveShadows=true;
    if(waterIndices.length){this.water=make('river-surface',waterPositions,waterIndices,waterUvs);this.water.material=this.river;}
  }
  dispose(){this.ground?.dispose();this.water?.dispose();this.soil.dispose();this.river.dispose();this.texture.dispose();}
}

