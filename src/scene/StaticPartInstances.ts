import {Mesh} from '@babylonjs/core/Meshes/mesh';
import type {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/instancedMesh';
/** Shared render sources are independent of any one editable placement. */
export class StaticPartInstances {
 private sources=new Map<string,Mesh>();
 convert(root:TransformNode){
  for(const old of root.getChildMeshes()){if(!(old instanceof Mesh)||!old.geometry||old.skeleton||old.morphTargetManager||old.animations.length||old.getChildren().length||old.hasThinInstances)continue;
   const key=old.geometry.uniqueId+':'+old.material?.uniqueId;let source=this.sources.get(key);
   if(!source){source=old.clone('static-part-source',null,true)!;source.parent=null;source.position.setAll(0);source.rotation.setAll(0);source.rotationQuaternion=null;source.scaling.setAll(1);source.isVisible=false;source.isPickable=false;source.setEnabled(true);this.sources.set(key,source)}
   const instance=source.createInstance(old.name);instance.parent=old.parent;instance.position.copyFrom(old.position);instance.rotation.copyFrom(old.rotation);instance.rotationQuaternion=old.rotationQuaternion?.clone()??null;instance.scaling.copyFrom(old.scaling);instance.setPivotMatrix(old.getPivotMatrix());instance.metadata=old.metadata;instance.isVisible=old.isVisible;instance.isPickable=old.isPickable;instance.receiveShadows=old.receiveShadows;old.dispose(false,false);
  }
  for(const [key,source] of this.sources)if(!source.instances.length){source.dispose(false,false);this.sources.delete(key)}
 }
 dispose(){for(const mesh of this.sources.values())mesh.dispose(false,false);this.sources.clear()}
}
