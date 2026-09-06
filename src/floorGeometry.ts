import {subtractWallCuts} from './wallCuts';
import { deriveBoundaryWalls } from "./domain";
import type { FloorPlan, TileCell, WallSegment } from "./types";

export interface FloorRect { x:number; z:number; width:number; depth:number }
export interface MeasuredRegion { cells:TileCell[]; rects:Record<string,FloorRect[]>; widthMm:number; depthMm:number; origin:TileCell }
const key=(c:TileCell)=>`${c.x},${c.z}`;
const round=(v:number)=>Math.round(v*10000)/10000;
export const rectArea=(r:FloorRect)=>r.width*r.depth;
export const intersects=(a:FloorRect,b:FloorRect)=>a.x<b.x+b.width-.01&&a.x+a.width>b.x+.01&&a.z<b.z+b.depth-.01&&a.z+a.depth>b.z+.01;
export function subtractRect(a:FloorRect,b:FloorRect):FloorRect[] {
  if(!intersects(a,b))return [a];
  const l=Math.max(a.x,b.x),r=Math.min(a.x+a.width,b.x+b.width),t=Math.max(a.z,b.z),d=Math.min(a.z+a.depth,b.z+b.depth);
  return [{x:a.x,z:a.z,width:l-a.x,depth:a.depth},{x:r,z:a.z,width:a.x+a.width-r,depth:a.depth},{x:l,z:a.z,width:r-l,depth:t-a.z},{x:l,z:d,width:r-l,depth:a.z+a.depth-d}].filter(r=>r.width>.01&&r.depth>.01);
}
export function unionRects(rects:FloorRect[]):FloorRect[] {
  const result:FloorRect[]=[];
  for(const r of rects){let pieces=[r];for(const previous of result)pieces=pieces.flatMap(p=>subtractRect(p,previous));result.push(...pieces);}
  return result;
}
export function cellRect(cell:TileCell,grid:number):FloorRect {return {x:round(cell.x*grid),z:round(cell.z*grid),width:grid,depth:grid};}
export function floorRects(floor:FloorPlan,grid:number):Array<FloorRect&{cell:TileCell}> {
  return floor.cells.flatMap(cell=>(floor.cellRects?.[key(cell)]??[cellRect(cell,grid)]).map(r=>({...r,cell})));
}
export function measuredRegion(grid:number,origin:TileCell,widthMm:number,depthMm:number):MeasuredRegion {
  if(![grid,widthMm,depthMm].every(Number.isFinite)||grid<10||widthMm<100||depthMm<100||widthMm>60000||depthMm>60000||!Number.isInteger(origin.x)||!Number.isInteger(origin.z)||Math.abs(origin.x)>9000||Math.abs(origin.z)>9000)throw new Error("Use room sides between 10 cm and 60 m.");
  const width=Math.ceil(widthMm/grid),depth=Math.ceil(depthMm/grid);
  if(width*depth>10000)throw new Error("This room needs too many tiles. Use a larger tile size or a smaller room.");
  const cells:TileCell[]=[],rects:Record<string,FloorRect[]>={};
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
    const cell={x:origin.x+x,z:origin.z+z}; cells.push(cell);
    rects[key(cell)]=[{x:round(cell.x*grid),z:round(cell.z*grid),width:round(Math.min(grid,widthMm-x*grid)),depth:round(Math.min(grid,depthMm-z*grid))}];
  }
  return {cells,rects,widthMm,depthMm,origin};
}
export function addMeasuredRegion(floor:FloorPlan,grid:number,region:MeasuredRegion):FloorPlan {
  const occupied=new Map(floor.cells.map(c=>[key(c),c])),cellRects={...floor.cellRects};
  for(const cell of region.cells){
    const k=key(cell),existing=occupied.has(k)?cellRects[k]??[cellRect(cell,grid)]:[],parts=unionRects([...existing,...region.rects[k]]);
    if(parts.length>64)throw new Error("This tile is too fragmented; paint it as a full tile first.");
    // Full tiles retain their compact legacy representation. Only boundary cuts
    // need extra geometry in saved/shared plans.
    if(Math.abs(parts.reduce((sum,r)=>sum+rectArea(r),0)-grid*grid)<.001)delete cellRects[k];else cellRects[k]=parts;
    occupied.set(k,cell);
  }
  if(occupied.size>20000)throw new Error("A floor can contain up to 20,000 tiles.");
  return {...floor,cells:[...occupied.values()],cellRects};
}
export function paintFloorCells(floor:FloorPlan,cells:TileCell[],present:boolean):FloorPlan {
  const occupied=new Map(floor.cells.map(c=>[key(c),c])),cellRects={...floor.cellRects},cellFinishes={...floor.cellFinishes};
  for(const cell of cells){const k=key(cell);if(present)occupied.set(k,cell);else {occupied.delete(k);delete cellFinishes[k];}delete cellRects[k];}
  return {...floor,cells:[...occupied.values()],...(floor.cellRects?{cellRects}:{}),...(floor.cellFinishes?{cellFinishes}:{})};
}
export function floorBoundaryWalls(floor:FloorPlan,grid:number):WallSegment[] {return subtractWallCuts(rawBoundaryWalls(floor,grid),floor.wallCuts??[]);}
function rawBoundaryWalls(floor:FloorPlan,grid:number):WallSegment[] {
  if(!floor.cellRects)return deriveBoundaryWalls(floor.cells);
  // Cancel shared collinear edges, including partially shared cut tiles. Keep
  // tile breakpoints so legacy wall IDs and segment finishes remain stable.
  const lines=new Map<string,{horizontal:boolean;line:number;events:Map<number,number>}>();
  const edge=(horizontal:boolean,line:number,start:number,end:number,sign:number)=>{
    line=round(line);start=round(start);end=round(end);const k=`${horizontal}:${line}`;
    let group=lines.get(k);if(!group){group={horizontal,line,events:new Map()};lines.set(k,group);}
    group.events.set(start,(group.events.get(start)??0)+sign);group.events.set(end,(group.events.get(end)??0)-sign);
  };
  for(const r of floorRects(floor,grid)){edge(true,r.z,r.x,r.x+r.width,1);edge(true,r.z+r.depth,r.x,r.x+r.width,-1);edge(false,r.x+r.width,r.z,r.z+r.depth,1);edge(false,r.x,r.z,r.z+r.depth,-1);}
  const walls:WallSegment[]=[];
  for(const {horizontal,line,events} of lines.values()){
    const points=[...events.keys()].sort((a,b)=>a-b);let count=0;
    for(let i=0;i<points.length-1;i++){count+=events.get(points[i])!;if(!count)continue;const a=count>0?points[i]:points[i+1],b=count>0?points[i+1]:points[i];
      const ax=round((horizontal?a:line)/grid),az=round((horizontal?line:a)/grid),bx=round((horizontal?b:line)/grid),bz=round((horizontal?line:b)/grid);
      walls.push({id:`${ax}:${az}:${bx}:${bz}`,ax,az,bx,bz});
    }
  }
  return walls;
}
export function parseRoomLength(text:string,unit:"ft"|"m"):number {
  const value=text.trim().replace(/[′’]/g,"'").replace(/[″”]/g,'"');
  let mm:number;
  if(unit==="ft"&&/[ft'"in]/i.test(value)){
    const match=value.match(/^(\d+(?:\.\d+)?)\s*(?:ft|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|")?)?$/i);
    if(!match||Number(match[2]??0)>=12)throw new Error("Use decimal feet or a measurement such as 12' 6\".");
    mm=Number(match[1])*304.8+Number(match[2]??0)*25.4;
  }else {if(!/^\d+(?:\.\d+)?$/.test(value))throw new Error("Enter a positive measurement.");mm=Number(value)*(unit==="ft"?304.8:1000);}
  if(mm<100||mm>60000)throw new Error("Use room sides between 10 cm and 60 m.");return Math.round(mm);
}
