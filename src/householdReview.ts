import {catalog,defaultMountHeight} from './catalog';
import {createSamplePlan,rectangleCells} from './domain';
import {shelfChoices} from './shelfSurfaces';
import {tabletopPoint} from './tabletop';
import {snapWindow} from './windows';
import type {FurniturePlacement} from './types';

/** Development-only review arrangement; never changes an existing project. */
export function createHouseholdReview(){
 const plan=createSamplePlan('Household collection review','metric');
 const floor={...plan.floors[0],id:'household-review',name:'Collection review',cells:rectangleCells(36,28),walls:[],openings:[],stairs:[]};
 plan.floors=[floor];plan.furniture=[];
 const place=(id:string,x:number,z:number):FurniturePlacement=>{
  const c=catalog.find(c=>c.id===id)!;
  const p={id:`review-${id}`,catalogId:id,floorId:floor.id,x,z,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage',elevationMm:defaultMountHeight(id,floor.heightMm)};
  plan.furniture.push(p);return p;
 };
 const cabinet=place('kitchen-microwave-drawer-cabinet',800,550);
 const microwave=place('kitchen-microwave-drawer',800,550);
 const bay=shelfChoices({...plan,furniture:[cabinet]},microwave).find(c=>c.surface.id==='appliance-bay');
 if(bay)Object.assign(microwave,bay.placement);
 const dressing=place('dressing-table',2200,550),cup=place('bath-toothbrush-cup',2200,550);
 const cupSupport=shelfChoices({...plan,furniture:[dressing]},cup)[0];if(cupSupport)Object.assign(cup,cupSupport.placement);
 const plantStand=place('tiered-plant-stand',3800,650),plant=place('trailing-pothos-in-shelf-pot',3800,650);
 const plantSupport=shelfChoices({...plan,furniture:[plantStand]},plant).find(c=>c.surface.id==='high');if(plantSupport)Object.assign(plant,plantSupport.placement);
 const desk=place('desk',5600,750),arm=place('desk-monitor-arm',5600,750);
 const clamp=tabletopPoint({...plan,furniture:[desk]},arm,{x:5.6,y:3,z:.75},{x:0,y:-1,z:0});if(clamp)Object.assign(arm,clamp);
 place('compact-paper-printer',6000,850).elevationMm=desk.heightMm;
 const ids=['hall-tree','potted-monstera-deliciosa','compact-digital-piano','compact-piano-bench','office-filing-cabinet','manual-recliner','lift-recliner-raised','floor-chair','bar-cart','potted-snake-plant','wall-bed-open','laundry-divided-hamper','wire-dog-crate','portable-play-yard','toddler-learning-tower','laundry-ironing-board','utility-air-purifier','home-dumbbell-rack','folding-treadmill','rolling-tool-cabinet','bath-standalone-bidet','utility-portable-ac','woven-basket','chair-sleeper-open'];
 ids.forEach((id,i)=>place(id,600+(i%6)*1420,2200+Math.floor(i/6)*1300));
 for(const [id,x] of [['art-picture-light',2200],['bath-heated-towel-rail',7000],['utility-thermostat',7800]] as const){const q=place(id,x,0);Object.assign(q,snapWindow(plan,q));}
 for(const [i,id] of ['adjustable-ceiling-track-light','ceiling-fan-with-light'].entries())place(id,3000+i*3000,3300);
 plan.camera={...plan.camera,ghostBelow:false,showGrid:false,wallVisibility:'all-hidden'};
 return plan;
}
