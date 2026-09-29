import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer';
import {MultiMaterial} from '@babylonjs/core/Materials/multiMaterial';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh';

/** Picture GLBs use packed atlas UVs. Only a private placement's image part gets planar UVs. */
export function projectPersonalArtUV(candidate:AbstractMesh,slotId:string){
 if(!(candidate instanceof Mesh)||!candidate.geometry||!candidate.material)return;
 const positions=candidate.getVerticesData(VertexBuffer.PositionKind),original=candidate.getVerticesData(VertexBuffer.UVKind);if(!positions||!original)return;
 const vertices=new Set<number>();
 if(candidate.material instanceof MultiMaterial){
  const indices=candidate.getIndices();if(!indices)return;
  for(const sub of candidate.subMeshes)if(candidate.material.subMaterials[sub.materialIndex]?.name===slotId)for(let i=sub.indexStart;i<sub.indexStart+sub.indexCount;i++)vertices.add(indices[i]);
 }else if(candidate.material.name===slotId){for(let i=0;i<positions.length/3;i++)vertices.add(i)}
 if(!vertices.size)return;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const i of vertices){minX=Math.min(minX,positions[i*3]);maxX=Math.max(maxX,positions[i*3]);minY=Math.min(minY,positions[i*3+1]);maxY=Math.max(maxY,positions[i*3+1])}
 if(maxX-minX<.00001||maxY-minY<.00001)return;
 const uvs=Float32Array.from(original);
 // The preserved catalog root reverses X. Canvas/glTF image rows start at the top.
 for(const i of vertices){uvs[i*2]=1-(positions[i*3]-minX)/(maxX-minX);uvs[i*2+1]=1-(positions[i*3+1]-minY)/(maxY-minY)}
 candidate.makeGeometryUnique();candidate.setVerticesData(VertexBuffer.UVKind,uvs,false,2);
}
