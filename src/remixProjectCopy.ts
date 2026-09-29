import type {PlanDocumentV1} from './types';

/** Only a permitted arrangement seed enters here; project-owned identities are always fresh. */
export async function independentRemixPlan(source:PlanDocumentV1):Promise<PlanDocumentV1>{
  const [{reviewPlan},{parsePlan},{reidentifyPrivatePlan}]=await Promise.all([import('./clientReview'),import('./domain'),import('./projectIdentity')]);
  const clean=reviewPlan(source,source.name);
  if(clean.floors.length!==1||clean.furniture.length>40||!clean.furniture.length||clean.floors[0].cells.length>2000||clean.floors.some(f=>f.blueprint||f.walls.length||f.openings.length||f.stairs.length))throw Error('Only a reviewed single-room arrangement can become this private copy.');
  const next=reidentifyPrivatePlan(clean,crypto.randomUUID(),source.name),floorId=crypto.randomUUID();
  next.floors=next.floors.map(f=>({...f,id:floorId,...(f.wallCuts?{wallCuts:f.wallCuts.map(w=>({...w,id:crypto.randomUUID()}))}:{})}));
  next.furniture=next.furniture.map(p=>({...p,id:crypto.randomUUID(),floorId}));
  return parsePlan(JSON.stringify(next));
}

/** Read only the device's active save. A public link must never trigger legacy share imports. */
async function activeLocalPlan():Promise<PlanDocumentV1|undefined>{
  const {openDB}=await import('idb');const db=await openDB('nook-and-nest',1,{upgrade(db){if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects');}});
  try{const active=await db.get('projects','active');return active?.activeProjectId?await db.get('projects','project:'+active.activeProjectId):active?.schemaVersion===1?active:undefined;}finally{db.close();}
}

let copying=false;
/** Called only by the viewer's explicit copy action. Neither the store nor identity runtime loads on preview. */
export async function copyRemixFromPublicRoute(seed:PlanDocumentV1,isCurrent:()=>boolean=()=>true):Promise<void>{
  if(copying)throw Error('A private copy is already being saved.');copying=true;
  try{
    const runtime=await import('./store'),current=runtime.usePlanner.getState().plan;
    const check=()=>{if(!isCurrent()||runtime.usePlanner.getState().plan!==current)throw Error('Your active view changed. Open the arrangement and try copying again.');if(runtime.plannerCollaborationActive())throw Error('Leave the shared room before opening a private project.');};
    check();const saved=await activeLocalPlan();check();
    // getInitialState identifies the untouched bootstrap blank without guessing from its contents.
    const preserve=current.id!==runtime.usePlanner.getInitialState().plan.id?current:saved;
    const next=await independentRemixPlan(seed);check();
    if(preserve){await runtime.savePlan(preserve);check();}
    await runtime.savePlan(next);
    try{check();}catch(error){const latest=runtime.usePlanner.getState().plan;await runtime.savePlan(latest===current&&preserve?preserve:latest);throw error;}
    runtime.usePlanner.getState().replacePlan(next);
  }finally{copying=false;}
}
