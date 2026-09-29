import {catalog,defaultMountHeight} from './catalog';
import {createSamplePlan,deriveBoundaryWalls,rectangleCells} from './domain';
import defaults from './furnitureDefaultVariants.json';
import {placementFromWallAnchor} from './householdArchitectureGeometry';
import {fitsShelf,shelfChoices} from './shelfSurfaces';
import {snapWindow} from './windows';
import type {FurniturePlacement,PlanDocumentV1} from './types';

/** Unsaved development fixture. The caller alone decides whether to display it. */
export function createGarageOutdoorReview(area:'garage'|'outdoor'):PlanDocumentV1 {
  const plan=createSamplePlan(area==='garage'?'Garage construction review':'Outdoor living review','metric');
  plan.gridSizeMm=500;
  const cells=rectangleCells(area==='garage'?14:16,area==='garage'?14:16);
  const floor={...plan.floors[0],id:`${area}-review`,name:area==='garage'?'7 m garage':'8 m stone patio',
    elevationMm:0,heightMm:3000,cells,walls:[],openings:[],stairs:[],
    floorFinishId:area==='garage'?'realism-garage-rubber':'realism-weathered-pavers',
    wallFinishId:'realism-limewash',wallCuts:area==='outdoor'?deriveBoundaryWalls(cells):undefined};
  plan.floors=[floor];plan.furniture=[];plan.environment={background:'plain',grass:'off'};
  plan.camera={...plan.camera,ghostBelow:false,showGrid:false,showClearance:false,wallVisibility:'near-hidden'};

  const make=(id:string,x:number,z:number,rotation=0):FurniturePlacement=>{
    const c=catalog.find(item=>item.id===id);
    if(!c)throw Error(`Review fixture requires catalog item ${id}`);
    return {id:`${area}-review-${plan.furniture.length}-${id}`,catalogId:id,floorId:floor.id,x,z,rotation,
      widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,
      variant:(defaults as Record<string,string>)[id]??'oat',elevationMm:defaultMountHeight(id,floor.heightMm)??0};
  };
  const add=(item:FurniturePlacement)=>{plan.furniture.push(item);return item;};
  const free=(id:string,x:number,z:number,rotation=0,elevationMm=0)=>add({...make(id,x,z,rotation),elevationMm});
  const wall=(id:string,x:number,z:number,rotation:number)=>add(snapWindow(plan,make(id,x,z,rotation)));
  const back=(id:string,x:number)=>{
    const item=make(id,x,0,180);item.z=7000-item.depthMm/2-70;return add(item);
  };
  const supported=(id:string,host:FurniturePlacement,surfaceId:string,side=0)=>{
    const item=make(id,host.x,host.z,host.rotation);
    const choice=shelfChoices({...plan,furniture:[host]},item).find(c=>c.surface.id===surfaceId);
    if(!choice)throw Error(`Review fixture requires the measured ${surfaceId} support on ${host.catalogId} for ${id}`);
    const placed={...item,...choice.placement};
    // Separate the independent drill and charger along the real clear worktop.
    // Their contact offsets/elevations come entirely from shelfChoices.
    const offset=side*choice.surface.width*.24,a=host.rotation*Math.PI/180;
    placed.x+=Math.round(offset*Math.cos(a));placed.z-=Math.round(offset*Math.sin(a));
    if(!fitsShelf(placed,host,choice.surface))throw Error(`Review support no longer fits ${id}`);
    return add(placed);
  };

  if(area==='garage'){
    // Door placement starts at the wall leaf, retaining the full inward track envelope.
    const doorway=make('garage-door-full-view',3500,0,180);
    add(snapWindow(plan,placementFromWallAnchor(doorway)));
    const hutch=back('garage-hutch-workbench',2500);
    supported('garage-cordless-drill',hutch,'worktop',-1);
    supported('garage-charger-dock',hutch,'worktop',1);
    back('garage-drawer-base',4140);
    back('garage-tall-cabinet',5400);
    const sink=make('garage-utility-sink',0,5300,90);sink.x=sink.depthMm/2+70;add(sink);
    wall('garage-tire-rack',0,3200,90);
    wall('garage-cord-reel',0,1500,90);
    wall('garage-folding-wall-bench',7000,4700,270);
    free('garage-service-cart',5600,5600,270);
    free('garage-air-compressor',1100,6100);
  }else{
    // The open pergola contains a conversation group, not a solid collision block.
    free('outdoor-louvered-pergola',2600,2600);
    const table=free('outdoor-round-conversation-table',2600,2600);
    free('outdoor-rope-dining-chair',1550,2600,90);
    free('outdoor-rope-dining-chair',3650,2600,270);
    free('outdoor-rope-dining-chair',2600,3650,180);
    supported('outdoor-caged-lantern',table,'top');
    // Pool and accessories sit entirely beyond the patio on lowest-level ground.
    // The independent fixed-pose ladder is staged beside the pool, not sunk into its wall.
    free('pool-rectangular-frame',11650,4300,0,-200);
    free('outdoor-pool-ladder',10600,6900,0,-200);
    free('outdoor-pool-lounger',13500,7150,0,-200);
    free('outdoor-kamado-grill',6200,1600);
    free('outdoor-drawer-cabinet',7350,1600);
    free('outdoor-vertical-planter',6200,6100);
  }
  return plan;
}
