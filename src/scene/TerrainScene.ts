import {floorRects} from '../floorGeometry';
import {artisticWater} from './ArtisticWater';
import type {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {ShallowWater} from '../shallowWater';
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
  private simulation?:ShallowWater;private waterPositions:Float32Array=new Float32Array();private waterDepth:Float32Array=new Float32Array();private waterFlow:Float32Array=new Float32Array();private bounds?:{minX:number;minZ:number;dx:number;dz:number};private projectId='';private architecture='';private accumulator=0;
  private positions:number[]=[];private target:number[]=[];private indices:number[]=[];private gridKey='';private ground?:Mesh;private water?:Mesh;private key='';private soil:StandardMaterial;private river:ShaderMaterial;private time=0;
  constructor(private scene:Scene){
    this.soil=new StandardMaterial('sculpted-ground',scene);this.soil.diffuseColor=Color3.FromHexString('#9cab77');this.soil.specularColor=Color3.Black();this.soil.backFaceCulling=false;
    this.river=artisticWater(scene);
    scene.onBeforeRenderObservable.add(()=>{
      this.advanceWater(Math.min(100,scene.getEngine().getDeltaTime())/1000);
      if(this.ground&&this.target.length){let changed=false;const a=1;for(let i=1;i<this.positions.length;i+=3){const d=this.target[i]-this.positions[i];if(Math.abs(d)>.001){this.positions[i]+=d*a;changed=true}else this.positions[i]=this.target[i];}if(changed){const normals:number[]=[];VertexData.ComputeNormals(this.positions,this.indices,normals,{useRightHandedSystem:this.scene.useRightHandedSystem});this.ground.updateVerticesData(VertexBuffer.PositionKind,this.positions,true);this.ground.updateVerticesData(VertexBuffer.NormalKind,normals);}}if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){this.time+=Math.min(50,scene.getEngine().getDeltaTime())/1000;this.river.setFloat('time',this.time)};});
  }
  update(plan:PlanDocumentV1){
    const key=JSON.stringify([plan.id,plan.environment?.terrain,plan.floors.map(f=>[f.cells,f.cellRects]),plan.gridSizeMm,plan.camera.darkMode,plan.environment?.sun?.night]);if(key===this.key)return;this.key=key;
    const architecture=JSON.stringify([plan.gridSizeMm,plan.floors.map(f=>[f.cells,f.cellRects])]);if(this.projectId!==plan.id||this.architecture!==architecture){this.simulation=undefined;this.projectId=plan.id;this.architecture=architecture;}const strokes=plan.environment?.terrain;if(!strokes?.length){this.ground?.dispose();this.ground=undefined;this.gridKey='';this.target=[];this.water?.dispose();this.water=undefined;this.simulation=undefined;return;}
    this.soil.diffuseColor=Color3.FromHexString(plan.camera.darkMode?'#455748':'#9cab77');const sample=terrainSampler(plan);
    const bounds=landscapeBounds(plan),radius=Math.max(35,bounds.radius+8),points=strokes.flatMap(s=>s.points),minX=Math.min(bounds.x-radius,...points.map(p=>p.x-10)),maxX=Math.max(bounds.x+radius,...points.map(p=>p.x+10)),minZ=Math.min(bounds.z-radius,...points.map(p=>p.z-10)),maxZ=Math.max(bounds.z+radius,...points.map(p=>p.z+10));
    const n=160,positions:number[]=[],indices:number[]=[],uvs:number[]=[],levels:number[]=[],seeds:number[]=[],beds:number[]=[],blocked:number[]=[],foundations=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=minX+x*(maxX-minX)/n,pz=minZ+z*(maxZ-minZ)/n;const ground=sample(px,pz);positions.push(px,ground.height,pz);beds.push(ground.height);blocked.push(foundations.some(r=>px>=r.x/1000-.25&&px<=(r.x+r.width)/1000+.25&&pz>=r.z/1000-.25&&pz<=(r.z+r.depth)/1000+.25)?1:0);seeds.push(ground.water?1:0);levels.push(ground.waterLevel??-.2);uvs.push(x/n,z/n);}
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);

    }

    const make=(name:string,p:number[],i:number[],uv:number[])=>{const mesh=new Mesh(name,this.scene),data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(p,i,normals,{useRightHandedSystem:this.scene.useRightHandedSystem});data.positions=p;data.indices=i;data.normals=normals;data.uvs=uv;data.applyToMesh(mesh,true);mesh.isPickable=false;return mesh;};
    const gridKey=JSON.stringify([minX,maxX,minZ,maxZ,n]);
    if(!this.ground||this.gridKey!==gridKey){this.ground?.dispose();this.gridKey=gridKey;this.positions=[...positions];this.indices=indices;this.ground=make('sculpted-landscape',this.positions,indices,uvs);this.ground.material=this.soil;this.ground.receiveShadows=true;}this.target=positions;
    if(strokes.some(s=>s.kind==='river')){
      const dx=(maxX-minX)/n,dz=(maxZ-minZ)/n;
      if(!this.simulation||!this.bounds||this.bounds.minX!==minX||this.bounds.minZ!==minZ||this.bounds.dx!==dx||this.bounds.dz!==dz){
        const previous=this.simulation,old=this.bounds,next=new ShallowWater(n+1,dx,dz);
        // Conservatively transfer existing water when the bounded terrain grid expands.
        if(previous&&old)for(let i=0;i<previous.depth.length;i++){const x=(old.minX+i%previous.size*old.dx-minX)/dx,z=(old.minZ+Math.floor(i/previous.size)*old.dz-minZ)/dz,ix=Math.max(0,Math.min(n,Math.round(x))),iz=Math.max(0,Math.min(n,Math.round(z)));let destination=iz*(n+1)+ix;
          if(blocked[destination]&&previous.depth[i]>0){let distance=Infinity;for(let j=0;j<blocked.length;j++){if(blocked[j])continue;const d=(j%(n+1)-x)**2+(Math.floor(j/(n+1))-z)**2;if(d<distance){distance=d;destination=j;}}}
          next.depth[destination]+=previous.depth[i]*old.dx*old.dz/(dx*dz);}
        this.simulation=next;this.bounds={minX,minZ,dx,dz};
      }
      this.simulation.setTerrain(beds,seeds,blocked);this.simulation.sourceLevel.set(levels);
      // Render at twice the simulation resolution: bilinear interpolation removes the
      // alternating diagonal sawtooth without increasing the physics workload.
      const renderN=n*2,renderSize=renderN+1,renderCount=renderSize*renderSize;
      if(!this.water||this.waterPositions.length!==renderCount*3){
        this.water?.dispose();const rp:number[]=[],ri:number[]=[],ru:number[]=[];
        for(let z=0;z<=renderN;z++)for(let x=0;x<=renderN;x++){rp.push(minX+x*dx/2,0,minZ+z*dz/2);ru.push(x/renderN,z/renderN);}
        for(let z=0;z<renderN;z++)for(let x=0;x<renderN;x++){const a=z*renderSize+x,b=a+1,c=a+renderSize,d=c+1;ri.push(a,c,b,b,c,d);}
        this.water=make('river-surface',rp,ri,ru);this.water.material=this.river;
        this.waterPositions=new Float32Array(rp);this.waterDepth=new Float32Array(renderCount);this.waterFlow=new Float32Array(renderCount*2);
        this.water.setVerticesData('waterDepth',this.waterDepth,true,1);this.water.setVerticesData('waterFlow',this.waterFlow,true,2);
      }
      this.syncWater();
      this.river.setFloat('night',plan.environment?.sun?.night||plan.camera.darkMode?1:0);
    }else{this.water?.dispose();this.water=undefined;this.simulation=undefined;}

  }
  private advanceWater(dt:number){
    if(!this.simulation||!this.water)return;
    this.accumulator=Math.min(.1,this.accumulator+dt);let changed=false;
    while(this.accumulator>=1/30){this.simulation.step();this.accumulator-=1/30;changed=true;}
    if(changed)this.syncWater();
  }
  private syncWater(){
    const sim=this.simulation,mesh=this.water;if(!sim||!mesh)return;
    const n=sim.size-1,renderSize=n*2+1,bounds=this.bounds!;
    for(let z=0;z<renderSize;z++)for(let x=0;x<renderSize;x++){
      const gx=x/2,gz=z/2,ix=Math.min(n-1,Math.floor(gx)),iz=Math.min(n-1,Math.floor(gz)),fx=gx-ix,fz=gz-iz,a=iz*sim.size+ix,b=a+1,c=a+sim.size,d=c+1,i=z*renderSize+x;
      const blend=(v:ArrayLike<number>,stride=1,axis=0)=>((v[a*stride+axis]*(1-fx)+v[b*stride+axis]*fx)*(1-fz)+(v[c*stride+axis]*(1-fx)+v[d*stride+axis]*fx)*fz);
      const depth=blend(sim.depth);this.waterDepth[i]=depth;
      this.waterPositions[i*3]=bounds.minX+gx*bounds.dx;this.waterPositions[i*3+1]=(fx+fz<=1?sim.bed[a]+(sim.bed[b]-sim.bed[a])*fx+(sim.bed[c]-sim.bed[a])*fz:sim.bed[d]+(sim.bed[c]-sim.bed[d])*(1-fx)+(sim.bed[b]-sim.bed[d])*(1-fz))+depth+.003;this.waterPositions[i*3+2]=bounds.minZ+gz*bounds.dz;
      this.waterFlow[i*2]=blend(sim.flow,2);this.waterFlow[i*2+1]=blend(sim.flow,2,1);
    }
    mesh.updateVerticesData(VertexBuffer.PositionKind,this.waterPositions,true);
    mesh.updateVerticesData('waterDepth',this.waterDepth);
    mesh.updateVerticesData('waterFlow',this.waterFlow);
  }
  dispose(){this.ground?.dispose();this.water?.dispose();this.soil.dispose();this.river.dispose();}
}

