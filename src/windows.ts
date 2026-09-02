import { isWindow } from "./catalog";
import { deriveBoundaryWalls } from "./domain";
import type { FloorPlan, FurniturePlacement, PlanDocumentV1, WallSegment } from "./types";

export interface WallRun { horizontal: boolean; line: number; start: number; end: number }
// Boundaries arrive as individual tile edges. Merge only touching collinear edges,
// so a window can span many tiles without bridging a gap in the apartment.
export function wallRuns(floor: FloorPlan, grid: number): WallRun[] {
  const runs: WallRun[]=[];
  for(const wall of [...deriveBoundaryWalls(floor.cells),...floor.walls]) {
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

export function snapWindow(plan:PlanDocumentV1,item:FurniturePlacement):FurniturePlacement {
  if(!isWindow(item.catalogId))return item;
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return item;
  const candidates=wallRuns(floor,plan.gridSizeMm).filter(r=>r.end-r.start>=item.widthMm+40).map(run=>{
    const along=run.horizontal?item.x:item.z;
    const center=Math.max(run.start+item.widthMm/2+20,Math.min(run.end-item.widthMm/2-20,Math.round(along/50)*50));
    const x=run.horizontal?center:run.line,z=run.horizontal?run.line:center;
    const base=run.horizontal?0:90;
    const rotation=[base,base+180].sort((a,b)=>angleDistance(a,item.rotation)-angleDistance(b,item.rotation))[0];
    return {x,z,rotation,distance:Math.hypot(item.x-x,item.z-z)};
  }).sort((a,b)=>a.distance-b.distance);
  const nearest=candidates[0];if(!nearest)return item;
  return {...item,x:nearest.x,z:nearest.z,rotation:nearest.rotation,elevationMm:Math.round(Math.max(100,Math.min(item.elevationMm??850,floor.heightMm-item.heightMm-100)))};
}
const angleDistance=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
export const windowRotation=(item:FurniturePlacement,step:number)=>((item.rotation+(isWindow(item.catalogId)?Math.sign(step)*180:step))+360)%360;

export function windowProblem(plan:PlanDocumentV1,item:FurniturePlacement):string|undefined {
  if(!isWindow(item.catalogId))return;
  const floor=plan.floors.find(f=>f.id===item.floorId);if(!floor)return "Choose a floor first.";
  if(![item.x,item.z,item.widthMm,item.depthMm,item.heightMm,item.rotation,item.elevationMm??850].every(Number.isFinite)||Math.min(item.widthMm,item.depthMm,item.heightMm)<=0)return "Enter valid window dimensions.";
  if(item.heightMm+200>floor.heightMm)return "This window is taller than the wall. Reduce its height.";
  const horizontal=Math.abs(Math.sin(item.rotation*Math.PI/180))<.001;
  const vertical=Math.abs(Math.cos(item.rotation*Math.PI/180))<.001;
  if(!horizontal&&!vertical)return "Windows must align with a wall.";
  const along=horizontal?item.x:item.z,line=horizontal?item.z:item.x;
  const fits=wallRuns(floor,plan.gridSizeMm).some(r=>r.horizontal===horizontal&&Math.abs(r.line-line)<1&&along-item.widthMm/2>=r.start+19&&along+item.widthMm/2<=r.end-19);
  if(!fits)return "No wall long enough here. Add a wall or reduce the window width.";
  const bottom=item.elevationMm??850;
  if(bottom<100||bottom+item.heightMm>floor.heightMm-99)return "Keep the window between the floor and ceiling.";
  const overlaps=plan.furniture.some(other=>other.id!==item.id&&other.floorId===item.floorId&&isWindow(other.catalogId)&&Math.abs((horizontal?other.z:other.x)-line)<1&&Math.abs((horizontal?other.x:other.z)-along)<(other.widthMm+item.widthMm)/2+30&&bottom<(other.elevationMm??850)+other.heightMm&&bottom+item.heightMm>(other.elevationMm??850));
  if(overlaps)return "This overlaps another window. Move it along the wall.";
}

export interface WallPiece { start:number; end:number; bottom:number; top:number }
// Subtract apertures in millimetres. The arched crown uses narrow strips hidden
// under its curved frame, avoiding heavyweight boolean geometry in the editor.
export function windowWallPieces(wall:WallSegment,grid:number,height:number,items:FurniturePlacement[]):WallPiece[] {
  const horizontal=wall.az===wall.bz,line=(horizontal?wall.az:wall.ax)*grid;
  const start=Math.min(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid;
  const end=Math.max(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid;
  let pieces:WallPiece[]=[{start,end,bottom:0,top:height}];
  for(const item of items.filter(i=>isWindow(i.catalogId)&&Math.abs((horizontal?i.z:i.x)-line)<1&&Math.abs(Math.sin((i.rotation-(horizontal?0:90))*Math.PI/180))<.001)){
    const center=horizontal?item.x:item.z,left=center-item.widthMm/2+25,right=center+item.widthMm/2-25,bottom=(item.elevationMm??850)+25,top=bottom+item.heightMm-50;
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
