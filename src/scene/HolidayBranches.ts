import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector';
import type {InstancedMesh} from '@babylonjs/core/Meshes/instancedMesh';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {motionData} from './LivingModels';
/** Collapse authored linked branch copies into one instanced draw per tree. */
export function instanceHolidayBranches(root:TransformNode){
 const branches=root.getChildMeshes().filter(m=>motionData(m).shared_geometry||motionData(m.parent).shared_geometry||/(^|:)linked_bough_\d+_\d+$/.test(m.name)) as Mesh[];
 if(branches.length<2)return 0;
 root.computeWorldMatrix(true);const inverse=root.getWorldMatrix().clone().invert();const matrices=branches.map(m=>m.computeWorldMatrix(true).multiply(inverse));const master=branches[0] instanceof Mesh?branches[0]:(branches[0] as unknown as InstancedMesh).sourceMesh.clone('holiday-boughs',root,true)!;
 master.parent=root;master.position=Vector3.Zero();master.rotationQuaternion=Quaternion.Identity();master.scaling=Vector3.One();master.setPreTransformMatrix(Matrix.Identity());
 const buffer=new Float32Array(matrices.length*16);matrices.forEach((matrix,i)=>matrix.copyToArray(buffer,i*16));master.thinInstanceSetBuffer('matrix',buffer,16,true);master.thinInstanceEnablePicking=true;master.thinInstanceRefreshBoundingInfo();
 for(const mesh of branches)if(mesh!==master)mesh.dispose(false,false);
 return matrices.length;
}
