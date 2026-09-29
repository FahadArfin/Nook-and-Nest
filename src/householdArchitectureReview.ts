import {catalog} from './catalog';
import {createSamplePlan,rectangleCells} from './domain';
import {fitStair} from './building';
import {placementFromWallAnchor} from './householdArchitectureGeometry';
import {snapWindow,windowProblem} from './windows';
import type {FurniturePlacement,PlanDocumentV1} from './types';

/** Development-only two-floor fixture; never modifies the user's active plan. */
export function createHouseholdArchitectureReview():PlanDocumentV1 {
  const plan=createSamplePlan('Household architecture review','metric');plan.gridSizeMm=500;
  const lower={...plan.floors[0],id:'architecture-ground',name:'Garage and entry',elevationMm:0,heightMm:2600,cells:rectangleCells(18,14),walls:[],openings:[],stairs:[],blueprint:undefined,cellRects:undefined,wallCuts:undefined};
  const upper={...lower,id:'architecture-upper',name:'Upper landing and skylight',elevationMm:2800,cells:rectangleCells(8,10).map(p=>({x:p.x+10,z:p.z+2}))};
  plan.floors=[lower,upper];plan.furniture=[];
  plan.environment={background:'plain',grass:'off',flatRoof:true,sun:{enabled:true,azimuth:235,elevation:42,night:false}};
  const make=(catalogId:string,floorId:string,x:number,z:number,rotation=0):FurniturePlacement=>{
    const c=catalog.find(c=>c.id===catalogId);if(!c)throw new Error('Missing architecture review model: '+catalogId);
    return {id:'architecture-review-'+catalogId,catalogId,floorId,x,z,rotation,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'};
  };
  const add=(item:FurniturePlacement)=>{
    const fitted=fitStair(plan,snapWindow(plan,item)),problem=windowProblem(plan,fitted);
    if(problem)throw new Error('Invalid architecture review '+item.catalogId+': '+problem);
    plan.furniture.push(fitted);return fitted;
  };
  // The garage is beside the upper wing, keeping its return tracks visible.
  add(placementFromWallAnchor(make('sectional-garage-door',lower.id,2300,0,180)));
  const entry=add(make('door-shaker',lower.id,0,5000,270));
  add({...make('secondary-storm-screen-door',lower.id,0,5000,270),hostDoorId:entry.id});
  add({...make('spiral-staircase',lower.id,6600,3800),toFloorId:upper.id,stairRiseMm:2800});
  add(make('roof-skylight',upper.id,7800,2900));
  plan.camera={...plan.camera,mode:'dollhouse',ghostBelow:false,showGrid:false,showClearance:false,wallVisibility:'near-hidden'};
  return plan;
}
