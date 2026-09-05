import {blueprintPlan,fixtureAt,floorFromRooms,coveredByFloor,footprint,type BlueprintDraft} from './blueprint';
import {floorBoundaryWalls} from './floorGeometry';
import {recognizedScale,validateRecognition,type Recognition} from './recognitionContract';
import type {PlanReference} from './blueprintImport';
import type {PlanDocumentV1} from './types';
import {snapWindow,wallRuns,windowProblem} from './windows';
import {catalog,isWallOpening} from './catalog';

export async function recognizeReference(reference:PlanReference,signal?:AbortSignal):Promise<Recognition> {
  const response=await fetch('/api/floor-plan/recognize',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal,body:JSON.stringify({image:reference.url,width:reference.width,height:reference.height})});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.error)throw new Error(body?.error??'Automatic analysis could not be reached. Please try again.');
  return validateRecognition(body,reference.width,reference.height);
}
export function draftFromRecognition(base:PlanDocumentV1,floorId:string,result:Recognition) {
  const scale=recognizedScale(result),mm=(n:number)=>Math.round(n*scale);
  const draft:BlueprintDraft={rooms:result.rooms.map((r,i)=>({id:`scan-room-${i}`,name:r.name,kind:r.kind,x:mm(r.x),z:mm(r.y),width:Math.max(10,mm(r.x+r.width)-mm(r.x)),depth:Math.max(10,mm(r.y+r.height)-mm(r.y)),enclosed:false})),walls:[],omittedWalls:[],fixtures:[]};
  // Union each physical room before adding dividers, avoiding walls through its L-shaped extensions.
  const original=base.floors.find(f=>f.id===floorId)!,grid=base.gridSizeMm;
  const boundary=floorBoundaryWalls(floorFromRooms(original,grid,draft.rooms),grid);
  const groups=new Map<string,typeof draft.rooms>();
  result.rooms.forEach((r,i)=>{if(!r.enclosed)return;const name=r.name.split(/\s+[—–]\s+/)[0].toLowerCase(),g=groups.get(name)??[];g.push(draft.rooms[i]);groups.set(name,g);});
  for(const rooms of groups.values())for(const w of floorBoundaryWalls(floorFromRooms(original,grid,rooms),grid)){
    const horizontal=w.az===w.bz,line=horizontal?w.az:w.ax,a=horizontal?Math.min(w.ax,w.bx):Math.min(w.az,w.bz),b=horizontal?Math.max(w.ax,w.bx):Math.max(w.az,w.bz);
    const outside=boundary.filter(o=>horizontal?o.az===o.bz&&Math.abs(o.az-line)<.00001:o.ax===o.bx&&Math.abs(o.ax-line)<.00001).map(o=>horizontal?[Math.min(o.ax,o.bx),Math.max(o.ax,o.bx)]:[Math.min(o.az,o.bz),Math.max(o.az,o.bz)]);
    const points=[...new Set([a,b,...outside.flat().filter(p=>p>a&&p<b)])].sort((x,y)=>x-y);
    for(let i=0;i<points.length-1;i++){const mid=(points[i]+points[i+1])/2;if(outside.some(([start,end])=>mid>=start&&mid<=end))continue;draft.walls.push({id:`scan-wall-${draft.walls.length}`,ax:horizontal?points[i]:line,az:horizontal?line:points[i],bx:horizontal?points[i+1]:line,bz:horizontal?line:points[i+1]});}
  }
  const plan=blueprintPlan(base,floorId,draft);
  const placementNotes:string[]=[];
  result.fixtures.forEach((f,i)=>{
    const item={...fixtureAt(plan,floorId,f.catalogId,mm(f.x),mm(f.y)),id:`scan-fixture-${i}`,x:mm(f.x),z:mm(f.y),rotation:f.rotation,widthMm:Math.max(100,mm(f.width)),depthMm:isWallOpening(f.catalogId)?180:Math.max(100,mm(f.depth))};
    const runs=isWallOpening(f.catalogId)?wallRuns(plan.floors.find(f=>f.id===floorId)!,grid).filter(r=>r.horizontal===(f.rotation%180===0)):undefined;
    let snapped=snapWindow(plan,item,runs);
    if(isWallOpening(f.catalogId)){
      if(Math.hypot(snapped.x-item.x,snapped.z-item.z)>500){placementNotes.push(`Opening ${i+1}: the sloping or short wall could not support this detection. It was left out rather than moved to a different room. Add or correct it in the editor.`);return;}
      const working={...plan,furniture:[...plan.furniture,...draft.fixtures]};
      if(windowProblem(working,snapped)){
        const horizontal=f.rotation%180===0;
        const candidates=[0,50,-50,100,-100,150,-150].flatMap(offset=>[0,40,80].map(trim=>snapWindow(plan,{...item,widthMm:Math.max(100,item.widthMm-trim),x:item.x+(horizontal?offset:0),z:item.z+(horizontal?0:offset)},runs)));
        const valid=candidates.find(c=>Math.hypot(c.x-item.x,c.z-item.z)<=500&&!windowProblem(working,c));
        if(valid){snapped=valid;placementNotes.push(`Opening ${i+1}: estimated position/width adjusted slightly to separate neighboring openings. Check against the scan.`);}
      }
    }else if(!coveredByFloor(footprint(snapped),plan.floors.find(f=>f.id===floorId)!,grid)){
      const offsets=[];for(let x=-250;x<=250;x+=50)for(let z=-250;z<=250;z+=50)offsets.push({x,z});
      offsets.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
      const fit=offsets.map(o=>({...snapped,x:snapped.x+o.x,z:snapped.z+o.z})).find(c=>coveredByFloor(footprint(c),plan.floors.find(f=>f.id===floorId)!,grid));
      const name=catalog.find(c=>c.id===f.catalogId)?.name??'Fixture';
      if(!fit){placementNotes.push(`${name}: its detected footprint did not fit the room and was left out. Check its location against the scan.`);return;}
      snapped=fit;placementNotes.push(`${name}: moved slightly inside the inferred room boundary. Check its location against the scan.`);
    }
    draft.fixtures.push(snapped);
  });
  blueprintPlan(base,floorId,draft);
  return {draft,scale,notes:[...placementNotes,...result.warnings,...result.rooms.filter(r=>r.note).map(r=>`${r.name}: ${r.note}`)],dimensions:result.dimensions.map(d=>`${d.text} = ${(d.millimetres/1000).toFixed(3)} m`)};
}
