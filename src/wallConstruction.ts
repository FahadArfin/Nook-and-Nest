import {floorBoundaryWalls} from './floorGeometry';
import {wallRuns} from './windows';
import {catalog} from './catalog';
import {uid} from './domain';
import {subtractWallCuts} from './wallCuts';
import {fixturesAfterWallCuts,geometryKey,roomDividers} from './blueprint';
import {validatePlan} from './planValidation';
import type {PlanDocumentV1,WallSegment} from './types';

export function removeWallSections(base:PlanDocumentV1,floorId:string,input:Omit<WallSegment,'id'>[],railingId?:string) {
  const plan=structuredClone(base),floor=plan.floors.find(f=>f.id===floorId);
  if(!floor)throw new Error('Choose a floor.');
  const runs=wallRuns(floor,plan.gridSizeMm),originalWalls=[...floorBoundaryWalls(floor,plan.gridSizeMm),...floor.walls];
  if(input.some(c=>![c.ax,c.az,c.bx,c.bz].every(Number.isFinite)||(c.ax!==c.bx&&c.az!==c.bz)))throw new Error('Draw a straight wall section.');
  const cuts=input.flatMap(c=>{
    const horizontal=c.az===c.bz,line=(horizontal?c.az:c.ax)*plan.gridSizeMm,a=Math.min(horizontal?c.ax:c.az,horizontal?c.bx:c.bz)*plan.gridSizeMm,b=Math.max(horizontal?c.ax:c.az,horizontal?c.bx:c.bz)*plan.gridSizeMm;
    return runs.filter(r=>r.horizontal===horizontal&&Math.abs(r.line-line)<.1&&r.end>a&&r.start<b).map(r=>{const start=Math.max(a,r.start)/plan.gridSizeMm,end=Math.min(b,r.end)/plan.gridSizeMm;return {id:uid(),ax:horizontal?start:c.ax,az:horizontal?c.az:start,bx:horizontal?end:c.ax,bz:horizontal?c.az:end}});
  });
  if(!cuts.length)return base;
  floor.openings=floor.openings.filter(o=>{const wall=originalWalls.find(w=>w.id===o.wallKey||`${w.ax}:${w.az}:${w.bx}:${w.bz}`===o.wallKey);return !wall||subtractWallCuts([wall],cuts).length===1&&subtractWallCuts([wall],cuts)[0].id===wall.id});
  floor.wallCuts=[...floor.wallCuts??[],...cuts];
  floor.walls=subtractWallCuts(floor.walls,cuts);
  plan.furniture=fixturesAfterWallCuts(plan.furniture.filter(f=>f.floorId===floorId),cuts,plan.gridSizeMm).concat(plan.furniture.filter(f=>f.floorId!==floorId));
  if(floor.blueprint){floor.blueprint.wallCuts=structuredClone(floor.wallCuts);floor.blueprint.geometryKey=geometryKey(floor);floor.blueprint.generatedWallIds=subtractWallCuts(roomDividers({...floor,wallCuts:[]},plan.gridSizeMm,floor.blueprint.rooms),floor.wallCuts).map(w=>w.id);}
  if(railingId){
    const item=catalog.find(c=>c.id===railingId&&c.id.startsWith('balcony-rail-'));if(!item)throw new Error('Choose a balcony railing.');
    for(const cut of cuts){
      const horizontal=cut.az===cut.bz,length=Math.hypot(cut.bx-cut.ax,cut.bz-cut.az)*plan.gridSizeMm,count=Math.max(1,Math.ceil(length/1200));
      for(let i=0;i<count;i++)plan.furniture.push({id:uid(),catalogId:item.id,floorId,x:(cut.ax+(cut.bx-cut.ax)*(i+.5)/count)*plan.gridSizeMm,z:(cut.az+(cut.bz-cut.az)*(i+.5)/count)*plan.gridSizeMm,rotation:horizontal?0:90,widthMm:length/count,depthMm:item.depthMm,heightMm:item.heightMm,variant:'sage'});
    }
  }
  validatePlan(plan);return plan;
}
