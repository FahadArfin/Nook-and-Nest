import {windowTreatmentIds,doorAperture} from './homeCollection';
import { isWindow, isDoor, isWallOpening, isStairs, isKitchenWall, isCeilingMounted, defaultMountHeight } from "./catalog";
import { floorBoundaryWalls } from "./floorGeometry";
import type { FloorPlan, FurniturePlacement, PlanDocumentV1, WallSegment } from "./types";

export interface WallRun { horizontal: boolean; line: number; start: number; end: number }
// Boundaries arrive as individual tile edges. Merge only touching collinear edges,
// so a window can span many tiles without bridging a gap in the apartment.
export function wallRuns(floor: FloorPlan, grid: number, include?: (wall:WallSegment,boundary:boolean)=>boolean): WallRun[] {
  const runs: WallRun[]=[];
  const boundaries=floorBoundaryWalls(floor,grid);
  for(const wall of [...boundaries,...floor.walls]) {
    if(include&&!include(wall,boundaries.includes(wall)))continue;
    const horizontal=wall.az===wall.bz;
    if(!horizontal&&wall.ax!==wall.bx)continue;
    const a=(horizontal?wall.ax:wall.az)*grid,b=(horizontal?wall.bx:wall.bz)*grid;
    runs.push({horizontal,line:(horizontal?wall.az:wall.ax)*grid,start:Math.min(a,b),end:Math.max(a,b)});
  }
  runs.sort((a,b)=>Number(a.horizontal)-Number(b.horizontal)||a.line-b.line||a.start-b.start);
  const merged:WallRun[]=[];
  for(const run of runs){const last=merged.at(-1);if(last&&last.horizontal===run.horizontal&&Math.abs(last.line-run.line)<.01&&run.start<=last.end+.01)last.end=Math.max(last.end,run.end);else merged.push({...run});}
  return merged;
}

export function snapWindow(plan:PlanDocumentV1,item:FurniturePlacement, allowedRuns?:WallRun[]):FurniturePlacement {
  if(isCeilingMounted(item.catalogId)){
    const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return item;
    return {...item,elevationMm:Math.max(0,Math.min(item.elevationMm??floor.heightMm-item.heightMm-50,floor.heightMm-item.heightMm-50))};
  }
  if(isKitchenWall(item.catalogId)){
    const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return item;
    const candidates=(allowedRuns??wallRuns(floor,plan.gridSizeMm)).filter(r=>r.end-r.start>=item.widthMm).map(r=>{
      const center=Math.max(r.start+item.widthMm/2,Math.min(r.end-item.widthMm/2,r.horizontal?item.x:item.z));
      const base=r.horizontal?0:90,rotation=[base,base+180].sort((a,b)=>angleDistance(a,item.rotation)-angleDistance(b,item.rotation))[0];
      const offset=(item.depthMm/2+51)*(r.horizontal?Math.cos(rotation*Math.PI/180):Math.sin(rotation*Math.PI/180));
      const x=r.horizontal?center:r.line+offset,z=r.horizontal?r.line+offset:center;
      return {x,z,rotation,distance:Math.hypot(item.x-x,item.z-z)};
    }).sort((a,b)=>a.distance-b.distance);
    if(!candidates[0])return item;
    return {...item,x:candidates[0].x,z:candidates[0].z,rotation:candidates[0].rotation,elevationMm:Math.round(Math.max(0,Math.min(item.elevationMm??defaultMountHeight(item.catalogId)??1500,floor.heightMm-item.heightMm-50)))};
  }
  if(!isWallOpening(item.catalogId))return item;
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return item;
  const candidates=(allowedRuns??wallRuns(floor,plan.gridSizeMm)).filter(r=>r.end-r.start>=item.widthMm+40).map(run=>{
    const along=run.horizontal?item.x:item.z;
    const center=Math.max(run.start+item.widthMm/2+20,Math.min(run.end-item.widthMm/2-20,Math.round(along/50)*50));
    const x=run.horizontal?center:run.line,z=run.horizontal?run.line:center;
    const base=run.horizontal?0:90;
    const rotation=[base,base+180].sort((a,b)=>angleDistance(a,item.rotation)-angleDistance(b,item.rotation))[0];
    return {x,z,rotation,distance:Math.hypot(item.x-x,item.z-z)};
  }).sort((a,b)=>a.distance-b.distance);
  const nearest=candidates[0];if(!nearest)return item;
  return {...item,x:nearest.x,z:nearest.z,rotation:nearest.rotation,elevationMm:isDoor(item.catalogId)?0:Math.round(Math.max(100,Math.min(item.elevationMm??850,floor.heightMm-item.heightMm-100)))};
}
const angleDistance=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
export const windowRotation=(item:FurniturePlacement,step:number)=>((item.rotation+(isWallOpening(item.catalogId)||isKitchenWall(item.catalogId)?Math.sign(step)*180:isStairs(item.catalogId)?Math.sign(step)*90:step))+360)%360;

export function windowProblem(plan:PlanDocumentV1,item:FurniturePlacement):string|undefined {
  if(isKitchenWall(item.catalogId)||isCeilingMounted(item.catalogId)){
    const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return "Choose a floor first.";
    if(![item.x,item.z,item.widthMm,item.depthMm,item.heightMm,item.elevationMm??0,item.rotation].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return "Enter valid model dimensions.";
    const bottom=item.elevationMm??0;if(bottom<0||bottom+item.heightMm+50>floor.heightMm+1)return "This piece is taller than the available wall height. Reduce its height.";
    if(isCeilingMounted(item.catalogId))return;
    const angle=item.rotation*Math.PI/180,horizontal=Math.abs(Math.sin(angle))<.001;
    if(!horizontal&&Math.abs(Math.cos(angle))>.001)return "Align this piece with a wall.";
    const along=horizontal?item.x:item.z,back=(horizontal?item.z:item.x)-(item.depthMm/2+51)*(horizontal?Math.cos(angle):Math.sin(angle));
    if(!wallRuns(floor,plan.gridSizeMm).some(r=>r.horizontal===horizontal&&Math.abs(r.line-back)<1&&along-item.widthMm/2>=r.start-.01&&along+item.widthMm/2<=r.end+.01))return "No wall long enough here. Add a wall or reduce this piece's width.";
    if(!windowTreatmentIds.has(item.catalogId)&&plan.furniture.some(o=>o.floorId===item.floorId&&isWallOpening(o.catalogId)&&Math.abs((horizontal?o.z:o.x)-back)<1&&Math.abs((horizontal?o.x:o.z)-along)<(item.widthMm+o.widthMm)/2&&bottom+50<(o.elevationMm??0)+o.heightMm&&bottom+50+item.heightMm>(o.elevationMm??0)))return "This covers a door or window. Move it, or use smaller panels around the opening.";
    return;
  }
  if(!isWallOpening(item.catalogId))return;
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return "Choose a floor first.";
  if(![item.x,item.z,item.widthMm,item.depthMm,item.heightMm,item.rotation,item.elevationMm??850].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return "Enter valid opening dimensions.";
  if(item.heightMm+(isDoor(item.catalogId)?25:200)>floor.heightMm)return "This opening is taller than the wall. Reduce its height.";
  const horizontal=Math.abs(Math.sin(item.rotation*Math.PI/180))<.001;
  const vertical=Math.abs(Math.cos(item.rotation*Math.PI/180))<.001;
  if(!horizontal&&!vertical)return "Doors and windows must align with a wall.";
  const along=horizontal?item.x:item.z,line=horizontal?item.z:item.x;
  const fits=wallRuns(floor,plan.gridSizeMm).some(r=>r.horizontal===horizontal&&Math.abs(r.line-line)<1&&along-item.widthMm/2>=r.start+19&&along+item.widthMm/2<=r.end-19);
  if(!fits)return "No wall long enough here. Add a wall or reduce the opening width.";
  const bottom=isDoor(item.catalogId)?0:item.elevationMm??850;
  if((!isDoor(item.catalogId)&&bottom<100)||bottom+item.heightMm>floor.heightMm-(isDoor(item.catalogId)?24:99))return "Keep the window between the floor and ceiling.";
  const overlaps=plan.furniture.some(other=>other.id!==item.id&&other.floorId===item.floorId&&isWallOpening(other.catalogId)&&Math.abs((horizontal?other.z:other.x)-line)<1&&Math.abs((horizontal?other.x:other.z)-along)<(other.widthMm+item.widthMm)/2+30&&bottom<(other.elevationMm??850)+other.heightMm&&bottom+item.heightMm>(other.elevationMm??850));
  if(overlaps)return "This overlaps another door or window. Move it along the wall.";
}

export interface WallPiece { start:number; end:number; bottom:number; top:number }
// Subtract apertures in millimetres. The arched crown uses narrow strips hidden
// under its curved frame, avoiding heavyweight boolean geometry in the editor.
export function windowWallPieces(wall:WallSegment,grid:number,height:number,items:FurniturePlacement[]):WallPiece[] {
  const horizontal=wall.az===wall.bz,line=(horizontal?wall.az:wall.ax)*grid;
  const start=Math.min(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid;
  const end=Math.max(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid;
  let pieces:WallPiece[]=[{start,end,bottom:0,top:height}];
  for(const item of items.filter(i=>isWallOpening(i.catalogId)&&Math.abs((horizontal?i.z:i.x)-line)<1&&Math.abs(Math.sin((i.rotation-(horizontal?0:90))*Math.PI/180))<.001)){
    const aperture=doorAperture(item,horizontal),center=(horizontal?item.x:item.z)+aperture.offset,left=center-aperture.width/2+25,right=center+aperture.width/2-25,bottom=isDoor(item.catalogId)?0:(item.elevationMm??850)+25,top=isDoor(item.catalogId)?aperture.height-25:bottom+item.heightMm-50;
    const cuts=[{left,right,bottom,top}];
    if(item.catalogId==="window-arched"){
      const spring=(item.elevationMm??850)+item.heightMm*.95/1.41,rx=item.widthMm*.40,ry=item.heightMm*.40/1.41;
      cuts[0].top=spring;
      for(let i=0;i<20;i++){const x1=-rx+2*rx*i/20,x2=-rx+2*rx*(i+1)/20;const crown=spring+ry*Math.sqrt(Math.max(0,1-(Math.max(Math.abs(x1),Math.abs(x2))/rx)**2));cuts.push({left:center+x1,right:center+x2,bottom:spring,top:crown});}
    }
    for(const cut of cuts)pieces=pieces.flatMap(p=>{const l=Math.max(cut.left,p.start),r=Math.min(cut.right,p.end),b=Math.max(cut.bottom,p.bottom),t=Math.min(cut.top,p.top);if(l>=r||b>=t)return[p];return [{...p,end:l},{...p,start:r},{start:l,end:r,bottom:p.bottom,top:b},{start:l,end:r,bottom:t,top:p.top}].filter(q=>q.end-q.start>.1&&q.top-q.bottom>.1);});
  }
  return pieces;
}
