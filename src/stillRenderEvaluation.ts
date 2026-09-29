import {createSamplePlan,rectangleCells} from './domain';
import {catalog} from './catalog';
import {makeStillRecord} from './stillRender';
/** Portable, synthetic checks. Running these on a renderer remains an explicit external action. */
export async function buildStillEvaluationPack(){
 const cases=[];
 for(const [index,name] of ['Measured living room','Stepped floor edge','Upper-floor camera'].entries()){
  const plan=createSamplePlan(name,'metric');plan.gridSizeMm=1000;plan.floors=plan.floors.map(f=>({...f,cells:rectangleCells(6,5)}));if(index<2)plan.floors=plan.floors.slice(0,1);if(index===1)plan.floors[0].cells=plan.floors[0].cells.filter(c=>!(c.x>=4&&c.z<2));const floor=plan.floors[index===2?1:0];
  for(const [i,id]of ['armchair','side-table','floor-lamp'].entries()){const def=catalog.find(c=>c.id===id)!;plan.furniture.push({id:'evaluation-'+i,catalogId:id,floorId:floor.id,x:1800+i*1300,z:2700,rotation:0,widthMm:def.widthMm,depthMm:def.depthMm,heightMm:def.heightMm,variant:i===0?'sage':'oat'});}
  const camera={version:1 as const,kind:'orbit' as const,floorId:floor.id,target:{x:3,y:floor.elevationMm/1000+.7,z:2.5},alpha:Math.PI/2,beta:.7,radius:9,mode:0 as const,fov:.8};const job=await makeStillRecord(plan,{id:'evaluation-camera',name,camera},'preview','fixed-geometry',false);
  cases.push({name,request:job.request,expected:{floorCount:plan.floors.length,activeFloorId:floor.id,cellCount:floor.cells.length,gridSizeMm:1000,placements:plan.furniture.map(p=>({id:p.id,catalogId:p.catalogId,x:p.x,z:p.z,widthMm:p.widthMm,depthMm:p.depthMm,heightMm:p.heightMm})),width:960,height:540},checks:['No added/removed architecture or furniture','Correct active floor and stepped boundary where present','Original catalog dimensions and transforms','No severe blur, clipping or invented material features','Record engine/device, runtimeMs, peak memory if available and pass/needs-correction for each check']});
 }
 return {schema:'nook-still-evaluation/1',cases,notice:'Synthetic requests only. No renderer has run, and no quality or GPU compatibility result is claimed.'};
}
export function downloadStillEvaluationPack(value:Awaited<ReturnType<typeof buildStillEvaluationPack>>){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nook-still-evaluation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
