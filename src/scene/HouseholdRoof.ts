import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Scene} from '@babylonjs/core/scene';
import type {FloorPlan,PlanDocumentV1} from '../types';
import {flatRoofRects,FLAT_ROOF_THICKNESS_MM} from '../householdArchitecture';
import {polygonPrism,ringOf} from '../polygonGeometry';

/** One bounded roof mesh, with actual cut geometry; existing plans create none. */
export function createFlatRoof(scene:Scene,plan:PlanDocumentV1,floor:FloorPlan):Mesh|undefined {
  const parts=flatRoofRects(plan,floor.id);if(!parts.length)return;
  const positions:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[];
  for(const part of parts){
    const geometry=polygonPrism(ringOf(part),FLAT_ROOF_THICKNESS_MM/1000),offset=positions.length/3;
    positions.push(...geometry.positions);indices.push(...geometry.indices.map(i=>i+offset));uvs.push(...geometry.uvs);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;
  const roof=new Mesh('household-flat-roof:'+floor.id,scene);data.applyToMesh(roof);
  roof.position.y=(floor.elevationMm+floor.heightMm+FLAT_ROOF_THICKNESS_MM/2)/1000;
  roof.isPickable=false;roof.receiveShadows=true;roof.metadata={architecturalRoof:true,floorId:floor.id};
  const mat=new StandardMaterial('household-flat-roof-material:'+floor.id,scene);
  mat.diffuseColor=Color3.FromHexString('#d3cec2');mat.specularColor=Color3.Black();mat.backFaceCulling=false;
  roof.material=mat;
  // The material is unique to this roof and does not outlive rebuilds.
  roof.onDisposeObservable.add(()=>mat.dispose());
  setFlatRoofPresentation(roof,'cutaway');
  return roof;
}

export type RoofPresentation='cutaway'|'review'|'walkthrough';
export function setFlatRoofPresentation(roof:Mesh,presentation:RoofPresentation){
  if(roof.isDisposed()||roof.metadata?.presentation===presentation)return;
  const mat=roof.material as StandardMaterial;
  mat.disableColorWrite=presentation==='cutaway';
  mat.disableDepthWrite=presentation!=='walkthrough';
  mat.alpha=presentation==='review'?.26:1;
  roof.metadata={...roof.metadata,presentation};
}
