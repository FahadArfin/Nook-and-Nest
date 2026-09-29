import type {PlanDocumentV1} from './types';

/** Rebind only project-owned metadata for an intentional private copy. */
export function reidentifyPrivatePlan(source:PlanDocumentV1,id:string,name=source.name,now=new Date().toISOString()):PlanDocumentV1 {
  const plan=structuredClone(source);
  const layouts=[plan,...(plan.layoutAlternatives?.options.map(o=>o.snapshot)??[]),...(plan.designHistory?.checkpoints.map(c=>c.snapshot)??[])];
  for(const layout of layouts)if(layout.installChecklist)layout.installChecklist={...layout.installChecklist,projectId:id};
  return {...plan,id,name,createdAt:now,updatedAt:now};
}
