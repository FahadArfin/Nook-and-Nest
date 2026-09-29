import clipping,{type MultiPolygon} from 'polygon-clipping';
import {geometryKey} from './blueprint';
import {floorBoundaryWalls,floorRects,type FloorRect} from './floorGeometry';
import {visibleFloorRects} from './building';
import {geometryArea,unionShapes} from './polygonGeometry';
import {findFloorFinish,findWallFinish} from './surfaces';
import {windowProblem,windowWallPieces} from './windows';
import {isWallOpening} from './catalog';
import type {FloorPlan,PlanDocumentV1,WallSegment} from './types';

export interface QuantityRegion {key:string;name:string;shape:MultiPolygon;warning?:string}
export interface PlatePart {start:number;end:number;wall:WallSegment;finishId:string;warning?:string}
export interface QuantityWallPlate {key:string;floorId:string;boundary:boolean;ux:number;uz:number;line:number;start:number;end:number;lengthMm:number;heightMm:number|null;parts:PlatePart[];remaining:FloorRect[];warnings:string[]}
export interface FloorQuantityGeometry {floor:FloorPlan;gridSizeMm:number;original:MultiPolygon;visible:MultiPolygon;finishes:{finishId:string;original:MultiPolygon;visible:MultiPolygon}[];regions:QuantityRegion[];plates:QuantityWallPlate[];unmatchedLegacyOpening:boolean;warnings:string[]}
export const areaM2=(shape:MultiPolygon)=>geometryArea(shape)/1_000_000;
export const intersectShapes=(a:MultiPolygon,b:MultiPolygon):MultiPolygon=>a.length&&b.length?clipping.intersection(a,b):[];
export const subtractShapes=(a:MultiPolygon,b:MultiPolygon):MultiPolygon=>!a.length?[]:b.length?clipping.difference(a,b):a;
const combine=(a:MultiPolygon,b:MultiPolygon):MultiPolygon=>!a.length?b:!b.length?a:clipping.union(a,b);
const rounded=(v:number)=>Math.round(v*1e6)/1e6;
function pointInRing(x:number,z:number,ring:number[][]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function pointInShape(x:number,z:number,shape:MultiPolygon){return shape.some(rings=>pointInRing(x,z,rings[0])&&!rings.slice(1).some(r=>pointInRing(x,z,r)));}
export function pointOnPlate(plate:QuantityWallPlate,along:number,sideOffset=0){const t=plate.start+along,n=plate.line+sideOffset;return {x:plate.ux*t-plate.uz*n,z:plate.uz*t+plate.ux*n};}
export function plateWall(plate:QuantityWallPlate,grid:number):WallSegment {const a=pointOnPlate(plate,0),b=pointOnPlate(plate,plate.lengthMm);return {id:plate.key,ax:a.x/grid,az:a.z/grid,bx:b.x/grid,bz:b.z/grid};}

function rooms(floor:FloorPlan,shape:MultiPolygon):QuantityRegion[]{
  if(!floor.blueprint?.rooms.length||floor.blueprint.geometryKey!==geometryKey(floor))return [{key:'unassigned',name:'Unassigned',shape,warning:'Current named room geometry is unavailable; areas remain assigned to the floor.'}];
  const groups=new Map<string,{name:string;parts:FloorRect[]}>();for(const room of floor.blueprint.rooms){const key=room.groupId??room.id,entry=groups.get(key)??{name:room.name,parts:[]};entry.parts.push(room);groups.set(key,entry);}
  const regions=[...groups].map(([key,group])=>({key,name:group.name,shape:intersectShapes(shape,unionShapes(group.parts))}));
  let claimed:MultiPolygon=[],ambiguous:MultiPolygon=[];
  for(const region of regions){ambiguous=combine(ambiguous,intersectShapes(claimed,region.shape));claimed=combine(claimed,region.shape);}
  const result:QuantityRegion[]=regions.map(region=>({...region,shape:subtractShapes(region.shape,ambiguous)})).filter(r=>r.shape.length);
  if(ambiguous.length)result.push({key:'ambiguous',name:'Overlapping rooms',shape:ambiguous,warning:'This area belongs to multiple named rooms; it is counted once here.'});
  const unassigned=subtractShapes(shape,claimed);if(unassigned.length)result.push({key:'unassigned',name:'Unassigned',shape:unassigned,warning:'This area is outside the named room outlines.'});return result;
}
function plates(plan:PlanDocumentV1,floor:FloorPlan):QuantityWallPlate[]{
  const boundary=floorBoundaryWalls(floor,plan.gridSizeMm),sources=[...boundary.map(wall=>({wall,boundary:true})),...floor.walls.map(wall=>({wall,boundary:false}))];
  if(sources.length>12_000)throw new Error('Too many wall segments for a bounded material calculation.');
  type Span={start:number;end:number;height:number|null;wall:WallSegment;boundary:boolean};
  const lines=new Map<string,{ux:number;uz:number;line:number;spans:Span[]}>();
  for(const source of sources){const w=source.wall,dx=(w.bx-w.ax)*plan.gridSizeMm,dz=(w.bz-w.az)*plan.gridSizeMm,length=Math.hypot(dx,dz);if(!Number.isFinite(length)||length<=.001)throw new Error('A wall has invalid or missing length.');
    const sign=dx<-.000001||Math.abs(dx)<.000001&&dz<0?-1:1,ux=dx/length*sign,uz=dz/length*sign,line=rounded((-uz*w.ax+ux*w.az)*plan.gridSizeMm),a=(ux*w.ax+uz*w.az)*plan.gridSizeMm,b=(ux*w.bx+uz*w.bz)*plan.gridSizeMm;
    const key=`${ux.toFixed(6)}:${uz.toFixed(6)}:${line.toFixed(3)}`,entry=lines.get(key)??{ux,uz,line,spans:[]},height=w.heightMm??floor.heightMm;
    entry.spans.push({start:rounded(Math.min(a,b)),end:rounded(Math.max(a,b)),height:Number.isFinite(height)&&height>0?height:null,...source});lines.set(key,entry);
  }
  const result:QuantityWallPlate[]=[];
  for(const line of lines.values()){
    const events=new Map<number,{add:Span[];remove:Span[]}>();for(const span of line.spans){for(const [position,kind] of [[span.start,'add'],[span.end,'remove']] as const){const event=events.get(position)??{add:[],remove:[]};event[kind].push(span);events.set(position,event);}}
    const points=[...events.keys()].sort((a,b)=>a-b),active=new Set<Span>();let previous:QuantityWallPlate|undefined;
    for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],event=events.get(start)!;for(const span of event.remove)active.delete(span);for(const span of event.add)active.add(span);if(!active.size||end-start<=.001){previous=undefined;continue;}
      const candidates=[...active],height=candidates.some(s=>s.height===null)?null:Math.max(...candidates.map(s=>s.height!)),boundary=candidates.some(s=>s.boundary),visible=candidates.filter(s=>height===null||s.height===height),source=visible.find(s=>s.boundary)??visible[0];
      const finish=findWallFinish(floor.wallFinishes?.[source.wall.id]??floor.wallFinishId).id;
      const conflicting=new Set(visible.map(s=>floor.wallFinishes?.[s.wall.id]??floor.wallFinishId??'pale-white')).size>1;
      if(!previous||Math.abs(previous.end-start)>.001||previous.heightMm!==height||previous.boundary!==boundary){previous={key:'',floorId:floor.id,boundary,ux:line.ux,uz:line.uz,line:line.line,start,end,lengthMm:end-start,heightMm:height,parts:[],remaining:[],warnings:[]};result.push(previous);}else{previous.end=end;previous.lengthMm=end-previous.start;}
      previous.parts.push({start:start-previous.start,end:end-previous.start,wall:source.wall,finishId:conflicting?'unknown-wall-finish':finish,...(conflicting?{warning:'Overlapping walls have conflicting finishes; check the material assignment.'}:{})});
    }
  }
  const candidates=plan.furniture.filter(item=>item.floorId===floor.id&&isWallOpening(item.catalogId)),valid=candidates.filter(item=>!windowProblem(plan,item));
  const invalid=candidates.length-valid.length;
  for(const plate of result){plate.key=`wall:${rounded(plate.ux)}:${rounded(plate.uz)}:${plate.line}:${plate.start}:${plate.end}:${plate.heightMm??'unknown'}`;
    if(plate.heightMm===null){plate.warnings.push('Wall height is unavailable.');continue;}
    const wall=plateWall(plate,plan.gridSizeMm),base=Math.abs(plate.uz)<.000001?Math.min(wall.ax,wall.bx)*plan.gridSizeMm:Math.abs(plate.ux)<.000001?Math.min(wall.az,wall.bz)*plan.gridSizeMm:0;
    plate.remaining=windowWallPieces(wall,plan.gridSizeMm,plate.heightMm,valid).map(p=>({x:p.start-base,z:p.bottom,width:p.end-p.start,depth:p.top-p.bottom}));
    if(invalid)plate.warnings.push(`${invalid} invalid door/window placements are not deducted, matching the current wall geometry.`);
    if(valid.some(p=>p.catalogId==='window-arched'))plate.warnings.push('Arched openings use the same segmented crown approximation as the model.');
  }
  return result;
}
const geometryCache=new Map<PlanDocumentV1,Map<string,FloorQuantityGeometry|Error>>();
/** Immutable-plan cache. Coverage/waste changes reuse all geometric unions and wall plates. */
export function floorQuantityGeometry(plan:PlanDocumentV1,floorId:string):FloorQuantityGeometry {
  let cache=geometryCache.get(plan);if(!cache){cache=new Map();geometryCache.set(plan,cache);if(geometryCache.size>4)geometryCache.delete(geometryCache.keys().next().value!);}const cached=cache.get(floorId);if(cached instanceof Error)throw cached;if(cached)return cached;
  try {const floor=plan.floors.find(f=>f.id===floorId);if(!floor)throw new Error('Floor is unavailable.');
    const originalRects=floorRects(floor,plan.gridSizeMm),visibleRects=visibleFloorRects(plan,floor.id);if(originalRects.length>12_000||visibleRects.length>24_000)throw new Error('This floor is too fragmented for a bounded material calculation.');
    for(const r of [...originalRects,...visibleRects])if(![r.x,r.z,r.width,r.depth].every(Number.isFinite)||r.width<=0||r.depth<=0)throw new Error('A floor region has invalid dimensions.');
    const original=unionShapes(originalRects),visible=unionShapes(visibleRects),finishRects=new Map<string,{original:FloorRect[];visible:FloorRect[]}>();
    for(const [kind,rects] of [['original',originalRects],['visible',visibleRects]] as const)for(const rect of rects){const finishId=findFloorFinish(floor.cellFinishes?.[`${rect.cell.x},${rect.cell.z}`]??floor.floorFinishId).id,entry=finishRects.get(finishId)??{original:[],visible:[]};entry[kind].push(rect);finishRects.set(finishId,entry);}
    const result={floor,gridSizeMm:plan.gridSizeMm,original,visible,finishes:[...finishRects].map(([finishId,entry])=>({finishId,original:unionShapes(entry.original),visible:unionShapes(entry.visible)})),regions:rooms(floor,original),plates:plates(plan,floor),unmatchedLegacyOpening:false,warnings:[]};
    const hostIds=new Set(result.plates.flatMap(plate=>plate.parts.flatMap(({wall})=>[wall.id,[wall.ax,wall.az,wall.bx,wall.bz].join(':')])));result.unmatchedLegacyOpening=floor.openings.some(opening=>!hostIds.has(opening.wallKey));
    const vertices=result.regions.reduce((sum,r)=>sum+r.shape.reduce((s,p)=>s+p.reduce((n,ring)=>n+ring.length,0),0),0);if(vertices*Math.max(1,result.plates.length)>2_000_000)throw new Error('This floor has too many room/wall intersections for a bounded material calculation.');cache.set(floorId,result);return result;
  }catch(error){const failure=error instanceof Error?error:new Error('Geometry could not be calculated.');cache.set(floorId,failure);throw failure;}
}
/** Splits a selected face at exact room-edge crossings before assigning its intervals. */
export function wallFaceRegions(geometry:FloorQuantityGeometry,plate:QuantityWallPlate,side:1|-1):Array<{start:number;end:number;region:QuantityRegion}> {
  const shift=side*.1,line=plate.line,points=[0,plate.lengthMm];
  for(const region of geometry.regions)for(const rings of region.shape)for(const ring of rings)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],da=-plate.uz*a[0]+plate.ux*a[1]-line,db=-plate.uz*b[0]+plate.ux*b[1]-line;
    if(da*db>0||Math.abs(da-db)<1e-10)continue;const t=da/(da-db),along=plate.ux*(a[0]+(b[0]-a[0])*t)+plate.uz*(a[1]+(b[1]-a[1])*t)-plate.start;if(along>.001&&along<plate.lengthMm-.001)points.push(along);
  }
  const sorted=[...new Set(points.map(rounded))].sort((a,b)=>a-b),result=[];
  for(let i=0;i<sorted.length-1;i++){const start=sorted[i],end=sorted[i+1];if(end-start<=.001)continue;const center=pointOnPlate(plate,(start+end)/2,shift),inside=pointInShape(center.x,center.z,geometry.original),region=geometry.regions.find(r=>pointInShape(center.x,center.z,r.shape))??{key:inside?'unassigned':'exterior',name:inside?'Unassigned':'Exterior',shape:[],...(inside?{warning:'Room assignment is unavailable for this wall face.'}:{})};result.push({start,end,region});}return result;
}
