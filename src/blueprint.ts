import { catalog, defaultMountHeight, isDoor, isWallOpening } from './catalog';
import { uid } from './domain';
import { floorBoundaryWalls, floorRects, subtractRect, unionRects, type FloorRect } from './floorGeometry';
import { validatePlan } from './planValidation';
import { snapWindow, windowProblem } from './windows';
import type { FloorPlan, FurniturePlacement, PlanDocumentV1, WallSegment } from './types';

export const roomKinds = ['Living', 'Bedroom', 'Dining', 'Office', 'Kitchen', 'Bathroom', 'Laundry', 'Hall', 'Outdoor', 'Closet'] as const;
export type RoomKind = typeof roomKinds[number];
export interface BlueprintRoom extends FloorRect { id:string; name:string; kind:RoomKind; enclosed:boolean; groupId?:string }
export function roomGroups(rooms:BlueprintRoom[]) {
  const groups=new Map<string,BlueprintRoom[]>();for(const room of rooms){const key=room.groupId??room.id,list=groups.get(key)??[];list.push(room);groups.set(key,list);}
  return [...groups.values()].map(parts=>{const x=Math.min(...parts.map(p=>p.x)),z=Math.min(...parts.map(p=>p.z));return {...parts[0],x,z,width:Math.max(...parts.map(p=>p.x+p.width))-x,depth:Math.max(...parts.map(p=>p.z+p.depth))-z,enclosed:parts.some(p=>p.enclosed),parts};});
}
export interface BlueprintDraft { rooms:BlueprintRoom[]; walls:WallSegment[]; omittedWalls:string[]; fixtures:FurniturePlacement[]; wallCuts?:WallSegment[] }
export const geometryKey = (floor:FloorPlan) => {
  const text=JSON.stringify([floor.cells,floor.cellRects??{},floor.walls]);let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return `bp1:${text.length}:${hash>>>0}`;
};
export function isFixedPiece(id:string) {
  const item=catalog.find(c=>c.id===id);
  return !!item && (isWallOpening(id) || item.category==='Kitchen' || item.category==='Bathroom');
}
export function openPlanAreas(rooms:BlueprintRoom[]):BlueprintRoom[] {
  return rooms.map(r=>r.kind==='Hall'||(['Living','Dining'].includes(r.kind)&&/living|dining/i.test(r.name))?{...r,enclosed:false}:r);
}
export function fixtureName(item:FurniturePlacement) {return item.doorless?'Open entrance (no door)':catalog.find(c=>c.id===item.catalogId)?.name??item.catalogId;}
export function mergeFloorRegions(rectangles:FloorRect[]):FloorRect[] {
  let parts=rectangles.map(r=>({x:r.x,z:r.z,width:r.width,depth:r.depth})),changed=true;
  // Exact adjacent rectangles only: never fill the hole in an L-shaped home.
  for(let pass=0;changed&&pass<4;pass++) {
    changed=false;
    for(const horizontal of [true,false]) {
      const groups=new Map<string,FloorRect[]>();
      for(const r of parts) { const key=horizontal?`${r.z}:${r.depth}`:`${r.x}:${r.width}`;const list=groups.get(key)??[];list.push(r);groups.set(key,list); }
      parts=[];
      for(const group of groups.values()) {
        group.sort((a,b)=>horizontal?a.x-b.x:a.z-b.z);
        let last:FloorRect|undefined;
        for(const r of group) {
          if(last&&Math.abs(horizontal?last.x+last.width-r.x:last.z+last.depth-r.z)<.01) { if(horizontal)last.width+=r.width;else last.depth+=r.depth;changed=true; }
          else {last={...r};parts.push(last);}
        }
      }
    }
  }
  return parts;
}
export function draftFromFloor(plan:PlanDocumentV1,floorId:string):BlueprintDraft {
  const floor=plan.floors.find(f=>f.id===floorId)!;
  const saved=floor.blueprint;
  const rooms=saved?.geometryKey===geometryKey(floor)?structuredClone(saved.rooms):mergeFloorRegions(floorRects(floor,plan.gridSizeMm)).map((r,i)=>({...r,id:uid(),name:`Area ${i+1}`,kind:'Hall' as const,enclosed:false}));
  const valid=saved?.geometryKey===geometryKey(floor);
  return {rooms,wallCuts:valid?structuredClone(saved?.wallCuts??[]):[],walls:structuredClone(floor.walls.filter(w=>!valid||!saved?.generatedWallIds?.includes(w.id))),omittedWalls:valid?[...saved?.omittedWalls??[]]:[],fixtures:structuredClone(plan.furniture.filter(f=>f.floorId===floorId&&isFixedPiece(f.catalogId)))};
}
export function floorFromRooms(original:FloorPlan,grid:number,rooms:BlueprintRoom[]):FloorPlan {
  if(!rooms.length||rooms.length>100)throw new Error('Draw between 1 and 100 room areas.');
  const byCell=new Map<string,{x:number;z:number;rects:FloorRect[]}>();
  for(const r of rooms) {
    if(![r.x,r.z,r.width,r.depth].every(Number.isFinite)||r.width<10||r.depth<10||r.width>60000||r.depth>60000||Math.abs(r.x)>100000||Math.abs(r.z)>100000)throw new Error('Use room sizes from 0.01 to 60 metres, within 100 metres of the origin.');
    if(!roomKinds.includes(r.kind)||!r.name.trim()||r.name.length>100)throw new Error('Give every room a name and room type.');
    const left=Math.floor(r.x/grid),right=Math.ceil((r.x+r.width)/grid),top=Math.floor(r.z/grid),bottom=Math.ceil((r.z+r.depth)/grid);
    if((right-left)*(bottom-top)>20000)throw new Error('This area is too large for the current grid.');
    for(let z=top;z<bottom;z++)for(let x=left;x<right;x++) {
      const k=`${x},${z}`,entry=byCell.get(k)??{x,z,rects:[]};
      const rx=Math.max(x*grid,r.x),rz=Math.max(z*grid,r.z);
      entry.rects.push({x:rx,z:rz,width:Math.min((x+1)*grid,r.x+r.width)-rx,depth:Math.min((z+1)*grid,r.z+r.depth)-rz});byCell.set(k,entry);
      if(byCell.size>20000)throw new Error('A floor can contain up to 20,000 tiles.');
    }
  }
  const cellRects:Record<string,FloorRect[]>={};
  for(const [key,cell] of byCell) {const rects=unionRects(cell.rects);if(rects.length>64)throw new Error('Simplify overlapping room areas.');cellRects[key]=rects;}
  return {...original,cells:[...byCell.values()].map(({x,z})=>({x,z})),cellRects,walls:[],openings:[],stairs:[],cellFinishes:undefined,wallFinishes:undefined,blueprint:undefined};
}
export function roomDividers(floor:FloorPlan,grid:number,rooms:BlueprintRoom[]):WallSegment[] {
  const boundary=floorBoundaryWalls(floor,grid);
  const lines=new Map<string,{horizontal:boolean;line:number;intervals:[number,number][]}>();
  const add=(horizontal:boolean,line:number,start:number,end:number)=>{const key=`${horizontal}:${line}`;const g=lines.get(key)??{horizontal,line,intervals:[]};g.intervals.push([start,end]);lines.set(key,g);};
  for(const group of roomGroups(rooms).filter(r=>r.enclosed))for(const w of floorBoundaryWalls(floorFromRooms(floor,grid,group.parts),grid)){
    if(w.az===w.bz)add(true,w.az*grid,Math.min(w.ax,w.bx)*grid,Math.max(w.ax,w.bx)*grid);
    else add(false,w.ax*grid,Math.min(w.az,w.bz)*grid,Math.max(w.az,w.bz)*grid);
  }
  const result:WallSegment[]=[];
  for(const g of lines.values()) {
    const boundaries=boundary.filter(w=>g.horizontal?Math.abs(w.az*grid-g.line)<.01&&w.az===w.bz:Math.abs(w.ax*grid-g.line)<.01&&w.ax===w.bx).map(w=>g.horizontal?[Math.min(w.ax,w.bx)*grid,Math.max(w.ax,w.bx)*grid]:[Math.min(w.az,w.bz)*grid,Math.max(w.az,w.bz)*grid]);
    const points=[...new Set([...g.intervals,...boundaries].flat())].sort((a,b)=>a-b);
    let start:number|undefined,end=0;
    const flush=()=>{if(start===undefined)return;const ax=(g.horizontal?start:g.line)/grid,az=(g.horizontal?g.line:start)/grid,bx=(g.horizontal?end:g.line)/grid,bz=(g.horizontal?g.line:end)/grid;result.push({id:`bp:${ax}:${az}:${bx}:${bz}`,ax,az,bx,bz});start=undefined;};
    for(let i=0;i<points.length-1;i++){const mid=(points[i]+points[i+1])/2;if(g.intervals.some(([a,b])=>mid>a&&mid<b)&&!boundaries.some(([a,b])=>mid>a&&mid<b)){start??=points[i];end=points[i+1];}else flush();}flush();
  }
  return result;
}
export function cutBlueprintWalls(walls:WallSegment[],cuts:WallSegment[]):WallSegment[] {
  return walls.flatMap(w=>{
    const horizontal=w.az===w.bz,line=horizontal?w.az:w.ax;
    let spans:[[number,number]]|[number,number][]=[[Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz),Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)]];
    for(const cut of cuts){if((cut.az===cut.bz)!==horizontal||Math.abs((horizontal?cut.az:cut.ax)-line)>.001)continue;
      const a=Math.min(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz),b=Math.max(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz);
      spans=spans.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:([[x,Math.max(x,a)],[Math.min(y,b),y]] as [number,number][]).filter(([l,r])=>r-l>.001));
    }
    if(spans.length===1&&spans[0][0]===Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)&&spans[0][1]===Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz))return [w];
    return spans.map(([a,b])=>({id:`cut:${horizontal?1:0}:${line}:${a}:${b}`,ax:horizontal?a:line,az:horizontal?line:a,bx:horizontal?b:line,bz:horizontal?line:b}));
  });
}
export function fixturesAfterWallCuts(fixtures:FurniturePlacement[],cuts:WallSegment[],grid:number) {
  return fixtures.filter(f=>!isWallOpening(f.catalogId)||!cuts.some(c=>{
    const horizontal=c.az===c.bz;if(horizontal!==(f.rotation%180===0))return false;
    const line=(horizontal?c.az:c.ax)*grid,along=horizontal?f.x:f.z;
    return Math.abs((horizontal?f.z:f.x)-line)<1&&along+f.widthMm/2>Math.min(horizontal?c.ax:c.az,horizontal?c.bx:c.bz)*grid&&along-f.widthMm/2<Math.max(horizontal?c.ax:c.az,horizontal?c.bx:c.bz)*grid;
  }));
}
export function combineBlueprintRooms(draft:BlueprintDraft,first:string,second:string,grid:number):BlueprintDraft {
  const groups=roomGroups(draft.rooms),a=groups.find(g=>g.parts.some(p=>p.id===first)),b=groups.find(g=>g.parts.some(p=>p.id===second));
  if(!a||!b||a===b)throw new Error('Select two different adjoining rooms.');
  const cuts:WallSegment[]=[];
  for(const x of a.parts)for(const y of b.parts){
    const top=Math.max(x.z,y.z),bottom=Math.min(x.z+x.depth,y.z+y.depth),left=Math.max(x.x,y.x),right=Math.min(x.x+x.width,y.x+y.width);
    const vertical=Math.abs(x.x+x.width-y.x)<1?y.x:Math.abs(y.x+y.width-x.x)<1?x.x:undefined;
    const horizontal=Math.abs(x.z+x.depth-y.z)<1?y.z:Math.abs(y.z+y.depth-x.z)<1?x.z:undefined;
    if(vertical!==undefined&&bottom>top)cuts.push({id:uid(),ax:vertical/grid,bx:vertical/grid,az:top/grid,bz:bottom/grid});
    if(horizontal!==undefined&&right>left)cuts.push({id:uid(),ax:left/grid,bx:right/grid,az:horizontal/grid,bz:horizontal/grid});
  }
  if(!cuts.length)throw new Error('These rooms must share an edge. Resize or move their rectangles so they meet first.');
  const ids=new Set([...a.parts,...b.parts].map(p=>p.id)),groupId=a.groupId??a.id;
  return {...draft,fixtures:fixturesAfterWallCuts(draft.fixtures,cuts,grid),rooms:draft.rooms.map(r=>ids.has(r.id)?{...r,groupId,name:a.name,kind:a.kind,enclosed:a.enclosed||b.enclosed}:r),wallCuts:[...draft.wallCuts??[],...cuts]};
}
export function blueprintPlan(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft):PlanDocumentV1 {
  const original=base.floors.find(f=>f.id===floorId);if(!original)throw new Error('This floor no longer exists.');
  const floor=floorFromRooms(original,base.gridSizeMm,draft.rooms);
  const generated=cutBlueprintWalls(roomDividers(floor,base.gridSizeMm,draft.rooms),draft.wallCuts??[]);
  const walls=[...generated,...cutBlueprintWalls(draft.walls,draft.wallCuts??[])].filter(w=>!draft.omittedWalls.includes(w.id));
  const seen=new Set<string>();floor.walls=walls.filter(w=>{const points=[`${w.ax},${w.az}`,`${w.bx},${w.bz}`].sort().join(':');if(seen.has(points))return false;seen.add(points);return true;});
  floor.blueprint={rooms:structuredClone(draft.rooms),geometryKey:geometryKey(floor),generatedWallIds:generated.map(w=>w.id),wallCuts:structuredClone(draft.wallCuts??[]),omittedWalls:[...draft.omittedWalls]};
  const plan={...base,floors:base.floors.map(f=>f.id===floorId?floor:{...f,stairs:f.stairs.filter(s=>s.toFloorId!==floorId)}),furniture:[...base.furniture.filter(f=>f.floorId!==floorId&&f.toFloorId!==floorId),...structuredClone(draft.fixtures)],camera:{...base.camera,mode:'isometric' as const}};
  validatePlan(plan);return plan;
}
export function footprint(item:FurniturePlacement,margin=0):FloorRect {
  const angle=item.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.widthMm*c+item.depthMm*s+margin*2,depth=item.widthMm*s+item.depthMm*c+margin*2;
  return {x:item.x-width/2,z:item.z-depth/2,width,depth};
}
const overlaps=(a:FloorRect,b:FloorRect)=>a.x<b.x+b.width-.1&&a.x+a.width>b.x+.1&&a.z<b.z+b.depth-.1&&a.z+a.depth>b.z+.1;
export function coveredByFloor(rect:FloorRect,floor:FloorPlan,grid:number) {
  let remaining=[rect];for(const part of floorRects(floor,grid)){remaining=remaining.flatMap(r=>subtractRect(r,part));if(!remaining.length)return true;}return false;
}
export function roomOverlapPairs(rooms:BlueprintRoom[]) {
  const pairs:{a:BlueprintRoom;b:BlueprintRoom}[]=[];
  for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j];if((a.groupId??a.id)===(b.groupId??b.id))continue;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.z+a.depth,b.z+b.depth)-Math.max(a.z,b.z)>1)pairs.push({a,b});}
  return pairs;
}
export function separateBlueprintRectangle(draft:BlueprintDraft,id:string):BlueprintDraft {
  const part=draft.rooms.find(r=>r.id===id);if(!part)return draft;
  return {...draft,rooms:draft.rooms.map(r=>r.id===id?{...r,groupId:uid(),name:'Separated area',kind:'Hall',enclosed:false}:r)};
}
export function blueprintProblems(plan:PlanDocumentV1,floorId:string):string[] {
  const floor=plan.floors.find(f=>f.id===floorId)!,problems:string[]=roomOverlapPairs(plan.floors.find(f=>f.id===floorId)?.blueprint?.rooms??[]).map(({a,b})=>`${a.name} overlaps ${b.name}. Resize, move or delete the incorrect rectangle before creating 3D.`);
  for(const item of plan.furniture.filter(f=>f.floorId===floorId)) {
    const problem=windowProblem(plan,item);
    if(problem)problems.push(`${catalog.find(c=>c.id===item.catalogId)?.name}: ${problem}`);
    else if(!isWallOpening(item.catalogId)&&!coveredByFloor(footprint(item),floor,plan.gridSizeMm))problems.push(`${catalog.find(c=>c.id===item.catalogId)?.name} is outside the floor. Move or remove it.`);
  }
  return problems;
}
export function fixtureAt(plan:PlanDocumentV1,floorId:string,catalogId:string,x:number,z:number):FurniturePlacement {
  const c=catalog.find(c=>c.id===catalogId);if(!c||!isFixedPiece(catalogId))throw new Error('Choose a kitchen, bathroom, laundry, door or window item.');
  return snapWindow(plan,{id:uid(),catalogId,floorId,x:Math.round(x),z:Math.round(z),rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage',elevationMm:defaultMountHeight(catalogId)});
}
export function autoFurnish(base:PlanDocumentV1,floorId:string,rooms:BlueprintRoom[]) {
  const plan=structuredClone(base),floor=plan.floors.find(f=>f.id===floorId);if(!floor)throw new Error('Choose a floor first.');
  const added:FurniturePlacement[]=[],skipped:string[]=[];
  const groups:Partial<Record<RoomKind,string[]>>={Living:['sofa','coffee-table','armchair','side-table'],Bedroom:['queen-bed','nightstand','dresser'],Dining:['dining-table','dining-chair','dining-chair','dining-chair','dining-chair'],Office:['desk','office-chair','bookshelf']};
  const walls=[...floorBoundaryWalls(floor,plan.gridSizeMm),...floor.walls].map(w=>({x:Math.min(w.ax,w.bx)*plan.gridSizeMm-60,z:Math.min(w.az,w.bz)*plan.gridSizeMm-60,width:Math.abs(w.ax-w.bx)*plan.gridSizeMm+120,depth:Math.abs(w.az-w.bz)*plan.gridSizeMm+120}));
  // Reserve both sides of each door, including old-style openings.
  const doorZones=plan.furniture.filter(f=>f.floorId===floorId&&isDoor(f.catalogId)).map(f=>footprint({...f,depthMm:2000},100));
  for(const o of floor.openings.filter(o=>o.kind==='door')){const w=[...floorBoundaryWalls(floor,plan.gridSizeMm),...floor.walls].find(w=>w.id===o.wallKey);if(w)doorZones.push({x:(w.ax+(w.bx-w.ax)*o.offset)*plan.gridSizeMm-1100,z:(w.az+(w.bz-w.az)*o.offset)*plan.gridSizeMm-1100,width:2200,depth:2200});}
  for(const room of roomGroups(rooms)) {
    const roomFloor=floorFromRooms(floor,plan.gridSizeMm,room.parts);
    for(const id of groups[room.kind]??[]) {
      const c=catalog.find(c=>c.id===id)!;
      // Calling the button again does not duplicate a room's existing arrangement.
      const existing=base.furniture.some(f=>f.floorId===floorId&&f.catalogId===id&&f.x>=room.x&&f.x<=room.x+room.width&&f.z>=room.z&&f.z<=room.z+room.depth);
      if(existing)continue;
      let chosen:FurniturePlacement|undefined;
      const anchor=(catalogId:string)=>plan.furniture.find(f=>f.floorId===floorId&&f.catalogId===catalogId&&f.x>=room.x&&f.x<=room.x+room.width&&f.z>=room.z&&f.z<=room.z+room.depth);
      for(const pass of ['group','space']) {
      for(const rotation of [0,90,180,270]) {
        const width=rotation%180?c.depthMm:c.widthMm,depth=rotation%180?c.widthMm:c.depthMm;
        const candidates=[[room.x+room.width/2,room.z+depth/2+100],[room.x+width/2+100,room.z+depth/2+100],[room.x+room.width-width/2-100,room.z+depth/2+100],[room.x+width/2+100,room.z+room.depth-depth/2-100],[room.x+room.width-width/2-100,room.z+room.depth-depth/2-100],[room.x+room.width/2,room.z+room.depth/2]];
        // A bounded search along walls fills remaining spaces without scaling models.
        for(let i=1;i<=6;i++)candidates.push([room.x+room.width*i/7,room.z+room.depth-depth/2-100],[room.x+width/2+100,room.z+room.depth*i/7],[room.x+room.width-width/2-100,room.z+room.depth*i/7]);
        const grouped:number[][]=[];
        const bed=anchor('queen-bed'),sofa=anchor('sofa'),table=anchor('dining-table'),desk=anchor('desk');
        if(id==='nightstand'&&bed&&rotation===bed.rotation&&rotation===0)grouped.push([bed.x-bed.widthMm/2-width/2-270,bed.z-bed.depthMm/2+depth/2],[bed.x+bed.widthMm/2+width/2+270,bed.z-bed.depthMm/2+depth/2]);
        if(id==='coffee-table'&&sofa&&rotation===0&&sofa.rotation===0)grouped.push([sofa.x,sofa.z+sofa.depthMm/2+depth/2+450]);
        if(id==='dining-table')grouped.push([room.x+room.width/2,room.z+room.depth/2]);
        if(id==='dining-chair'&&table){const bounds=footprint(table);if(rotation===0)grouped.push([table.x,bounds.z-depth/2-270]);if(rotation===180)grouped.push([table.x,bounds.z+bounds.depth+depth/2+270]);if(rotation===90)grouped.push([bounds.x-width/2-270,table.z]);if(rotation===270)grouped.push([bounds.x+bounds.width+width/2+270,table.z]);}
        if(id==='office-chair'&&desk&&rotation===180&&desk.rotation===0)grouped.push([desk.x,desk.z+desk.depthMm/2+depth/2+300]);
        for(const [x,z] of pass==='group'?grouped:candidates){
          const item={id:uid(),catalogId:id,floorId,x:Math.round(x),z:Math.round(z),rotation,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'},rect=footprint(item);
          if(rect.x<room.x||rect.z<room.z||rect.x+rect.width>room.x+room.width||rect.z+rect.depth>room.z+room.depth)continue;
          if(walls.some(w=>overlaps(rect,w))||doorZones.some(d=>overlaps(rect,d)))continue;
          if(plan.furniture.some(f=>f.floorId===floorId&&(f.elevationMm??0)<item.heightMm&&overlaps(footprint(f,isDoor(f.catalogId)?600:250),rect)))continue;
          if(!coveredByFloor(rect,floor,plan.gridSizeMm)||!coveredByFloor(rect,roomFloor,plan.gridSizeMm))continue;
          chosen=item;break;
        }if(chosen)break;
      }
      if(chosen)break;
      }
      if(chosen){plan.furniture.push(chosen);added.push(chosen);}else skipped.push(`${room.name}: no clear space for ${c.name}`);
    }
  }
  validatePlan(plan);return {plan,added,skipped};
}
