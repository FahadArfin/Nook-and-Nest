import { floorBoundaryWalls } from "./floorGeometry";
import { wallRuns } from "./windows";
import type { FloorPlan, TileCell, WallSegment } from "./types";

const wallsOf=(floor:FloorPlan,grid:number)=>[...floorBoundaryWalls(floor,grid),...floor.walls];
const tolerance=(grid:number)=>Math.min(.65,220/grid);
const nearest=(point:TileCell,points:TileCell[],radius:number)=>points.map(p=>({p,d:Math.hypot(point.x-p.x,point.z-p.z)})).filter(p=>p.d<=radius).sort((a,b)=>a.d-b.d)[0]?.p;
export function snapWallStart(floor:FloorPlan,grid:number,point:TileCell):TileCell {
  const walls=wallsOf(floor,grid),radius=tolerance(grid);
  const endpoint=nearest(point,walls.flatMap(w=>[{x:w.ax,z:w.az},{x:w.bx,z:w.bz}]),radius);
  if(endpoint)return endpoint;
  const onWall=nearest(point,walls.map(w=>w.az===w.bz
    ?{x:Math.max(Math.min(w.ax,w.bx),Math.min(Math.max(w.ax,w.bx),Math.round(point.x))),z:w.az}
    :{x:w.ax,z:Math.max(Math.min(w.az,w.bz),Math.min(Math.max(w.az,w.bz),Math.round(point.z)))}),radius);
  return onWall??{x:Math.round(point.x),z:Math.round(point.z)};
}
export function snapWallEnd(floor:FloorPlan,grid:number,start:TileCell,point:TileCell):{end:TileCell;connected:boolean} {
  const horizontal=Math.abs(point.x-start.x)>=Math.abs(point.z-start.z),radius=tolerance(grid);
  const axisPoint=horizontal?{x:point.x,z:start.z}:{x:start.x,z:point.z};
  const targets:TileCell[]=[];
  for(const w of wallsOf(floor,grid)) {
    for(const p of [{x:w.ax,z:w.az},{x:w.bx,z:w.bz}])if(Math.abs(horizontal?p.z-start.z:p.x-start.x)<.00001)targets.push(p);
    if(horizontal&&w.ax===w.bx&&start.z>=Math.min(w.az,w.bz)&&start.z<=Math.max(w.az,w.bz))targets.push({x:w.ax,z:start.z});
    if(!horizontal&&w.az===w.bz&&start.x>=Math.min(w.ax,w.bx)&&start.x<=Math.max(w.ax,w.bx))targets.push({x:start.x,z:w.az});
  }
  const connection=nearest(axisPoint,targets,radius);
  return {end:connection??(horizontal?{x:Math.round(point.x),z:start.z}:{x:start.x,z:Math.round(point.z)}),connected:!!connection};
}
export function wallBetween(start:TileCell,end:TileCell):Omit<WallSegment,"id">|undefined {
  if(Math.hypot(start.x-end.x,start.z-end.z)<.001)return;
  return {ax:start.x,az:start.z,bx:end.x,bz:end.z};
}

/** A plate is one continuous straight wall, stopping at corners or floor gaps.
 * Existing per-tile finish keys remain readable until the plate is repainted. */
export function wallPlateIds(floor:FloorPlan,grid:number,selectedId:string):string[] {
  const walls=wallsOf(floor,grid),selected=walls.find(w=>w.id===selectedId.split("|")[0]);
  if(!selected)return [];
  const horizontal=selected.az===selected.bz,line=(horizontal?selected.az:selected.ax)*grid;
  const center=(horizontal?selected.ax+selected.bx:selected.az+selected.bz)*grid/2;
  const run=wallRuns(floor,grid).find(r=>r.horizontal===horizontal&&Math.abs(r.line-line)<.01&&center>=r.start&&center<=r.end);
  return !run?[]:walls.filter(w=>(w.az===w.bz)===horizontal&&Math.abs((horizontal?w.az:w.ax)*grid-line)<.01&&Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)*grid>=run.start-.01&&Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)*grid<=run.end+.01).map(w=>w.id);
}
export function paintWallPlate(floor:FloorPlan,grid:number,id:string,finishId:string):FloorPlan {
  const ids=new Set(wallPlateIds(floor,grid,id));if(!ids.size)return floor;
  const wallFinishes={...floor.wallFinishes};
  for(const key of Object.keys(wallFinishes))if(ids.has(key.split("|")[0]))delete wallFinishes[key];
  for(const id of ids)wallFinishes[id]=finishId;
  return {...floor,wallFinishes};
}

/** Paint structural groups without touching finishes on the other group. */
export function paintWallGroup(floor:FloorPlan,grid:number,group:'interior'|'exterior',finishId:string):FloorPlan {
 const ids=new Set((group==='interior'?floor.walls:floorBoundaryWalls(floor,grid)).map(w=>w.id));
 const wallFinishes={...floor.wallFinishes};
 for(const key of Object.keys(wallFinishes))if(ids.has(key.split('|')[0]))delete wallFinishes[key];
 for(const id of ids)wallFinishes[id]=finishId;
 return {...floor,wallFinishes};
}
