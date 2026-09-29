import {catalog,defaultMountHeight} from './catalog';
import {createSamplePlan,rectangleCells} from './domain';
import defaults from './furnitureDefaultVariants.json';
import type {FurniturePlacement} from './types';

/** Development-only material room; never loads or changes a user's home. */
export function createRealismReview(finish='honey-oak',wall='cream-plaster',detailId?:string|null){
 const plan=createSamplePlan('Fabric, timber and architectural finish review','metric');plan.gridSizeMm=500;
 const floor={...plan.floors[0],id:'realism-review',name:'Material room',cells:rectangleCells(12,10),walls:[],openings:[],stairs:[],floorFinishId:finish,wallFinishId:wall};
 plan.floors=[floor];plan.furniture=[];plan.environment={background:'plain',grass:'off'};
 const layout:[string,number,number,number][]=detailId&&catalog.some(c=>c.id===detailId)?[[detailId,3000,2500,165]]:[['slat-day-sofa',1900,1200,180],['sofa',4200,2000,90],['oval-coffee-table',2300,2900,0]];
 for(const [id,x,z,rotation] of layout){
  const c=catalog.find(c=>c.id===id)!;
  const p:FurniturePlacement={id:'realism-'+id,catalogId:id,floorId:floor.id,x,z,rotation,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:(defaults as Record<string,string>)[id]??'oat',elevationMm:defaultMountHeight(id,floor.heightMm)};
  plan.furniture.push(p);
 }
 plan.camera={...plan.camera,ghostBelow:false,showGrid:false,wallVisibility:'near-hidden'};return plan;
}
