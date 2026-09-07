import {subtractRect,type FloorRect} from './floorGeometry';
import type {WallSegment,TileCell} from './types';

/** Close butt joints without changing saved wall centerlines or painted IDs. */
export function joinedWallSpan(wall:WallSegment,walls:WallSegment[],grid:number){
  const horizontal=wall.az===wall.bz,line=(horizontal?wall.az:wall.ax)*grid;
  const ends=[Math.min(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid,Math.max(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*grid];
  return ends.map((end,i)=>{
    const crossing=walls.filter(w=>(w.az===w.bz)!==horizontal).map(w=>({line:(horizontal?w.ax:w.az)*grid,start:Math.min(horizontal?w.az:w.ax,horizontal?w.bz:w.bx)*grid,end:Math.max(horizontal?w.az:w.ax,horizontal?w.bz:w.bx)*grid})).filter(w=>Math.abs(w.line-end)<=100&&line>=w.start-100&&line<=w.end+100).sort((a,b)=>Math.abs(a.line-end)-Math.abs(b.line-end))[0];
    return crossing?crossing.line+(i?50:-50):end;
  }) as [number,number];
}

/** Align the finish grid to nearby interior walls, then trim visible slabs at wall faces.
 * Structural floor/support geometry remains unchanged. World-space UVs retain tile scale.
 */
export function floorSurfaceRects<T extends FloorRect&{cell:TileCell}>(rects:T[],walls:WallSegment[],grid:number,masks:WallSegment[]=walls):T[]{
  const runs=walls.map(w=>{const horizontal=w.az===w.bz;return {horizontal,line:(horizontal?w.az:w.ax)*grid,start:Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)*grid,end:Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)*grid};});
  const shift=(edge:number,along:number,horizontal:boolean)=>{
    const near=runs.filter(w=>w.horizontal===horizontal&&along>=w.start&&along<=w.end&&Math.abs(w.line-edge)<grid*.5&&Math.abs(edge/grid-Math.round(edge/grid))<.0001).sort((a,b)=>Math.abs(a.line-edge)-Math.abs(b.line-edge))[0];
    return near?.line??edge;
  };
  return rects.flatMap(r=>{
    const left=shift(r.x,r.z+r.depth/2,false),right=shift(r.x+r.width,r.z+r.depth/2,false),top=shift(r.z,r.x+r.width/2,true),bottom=shift(r.z+r.depth,r.x+r.width/2,true);
    let pieces:FloorRect[]=[{x:left,z:top,width:right-left,depth:bottom-top}];
    for(const segment of masks){const horizontal=segment.az===segment.bz,w={horizontal,line:(horizontal?segment.az:segment.ax)*grid,start:Math.min(horizontal?segment.ax:segment.az,horizontal?segment.bx:segment.bz)*grid,end:Math.max(horizontal?segment.ax:segment.az,horizontal?segment.bx:segment.bz)*grid};const mask=w.horizontal?{x:w.start-50,z:w.line-50,width:w.end-w.start+100,depth:100}:{x:w.line-50,z:w.start-50,width:100,depth:w.end-w.start+100};pieces=pieces.flatMap(p=>subtractRect(p,mask));}
    return pieces.filter(p=>p.width>.01&&p.depth>.01).map(p=>({...r,...p}));
  });
}
