import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {motionData} from './LivingModels';
/** Apply once to a fresh clone; travel stays in the authored leaf coordinate system. */
export function positionSlidingLeaves(root:TransformNode,fraction=0){
 for(const node of root.getDescendants(false)){
  const data=motionData(node);
  if(data.motion_role==='sliding_leaf'&&!motionData(node.parent).motion_role)
   (node as TransformNode).position.x+=Number(data.slide_travel??0)*Math.max(0,Math.min(1,fraction));
 }
}
