import {createSamplePlan,rectangleCells,uid} from './domain';
import {catalog} from './catalog';
import type {Units} from './types';
export function createExamplePlan(units:Units='imperial'){
 const plan=createSamplePlan('Example apartment',units),floor={...plan.floors[0],cells:rectangleCells(20,18)};
 plan.floors=[floor];plan.furniture=[{id:'sofa',x:1600,z:2000,rotation:180},{id:'coffee-table',x:1600,z:3300,rotation:0},{id:'armchair',x:3600,z:2800,rotation:90},{id:'tv-stand',x:1600,z:4400,rotation:0}].map(p=>{const c=catalog.find(c=>c.id===p.id)!;return {id:uid(),catalogId:c.id,floorId:floor.id,x:p.x,z:p.z,rotation:p.rotation,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'white'}});return plan;
}
