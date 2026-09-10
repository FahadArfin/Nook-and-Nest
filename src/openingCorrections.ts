import {blueprintPlan,fixtureAt,roomGroups,type BlueprintDraft} from './blueprint';
import type {PlanDocumentV1} from './types';
import type {Span} from './openingReviewContract';
import {snapWindow,wallRuns,windowProblem} from './windows';
import {uid} from './domain';
export function applyReviewedOpening(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft,span:Span,scale:number,kind:'door'|'window'|'open'):BlueprintDraft {
  const plan=blueprintPlan(base,floorId,draft),horizontal=span.ay===span.by,x=(span.ax+span.bx)*scale/2,z=(span.ay+span.by)*scale/2,width=Math.hypot(span.bx-span.ax,span.by-span.ay)*scale;
  if(!Number.isFinite(width)||width<200||width>4000)throw new Error('Check scale and opening width (0.2–4 m) before applying.');
  const id=kind==='window'?'window-picture':'door-flush',item={...fixtureAt(plan,floorId,id,x,z),x,z,rotation:horizontal?0:90,widthMm:width,...(kind==='open'?{doorless:true}:{})};
  const runs=wallRuns(plan.floors.find(f=>f.id===floorId)!,base.gridSizeMm).filter(r=>r.horizontal===horizontal),snapped=snapWindow(plan,item,runs);
  if(Math.hypot(snapped.x-x,snapped.z-z)>120)throw new Error('No matching wall within 12 cm. Correct the yellow wall first; the doorway was not moved to another room.');
  const problem=windowProblem(plan,snapped);if(problem)throw new Error(problem);
  return {...draft,fixtures:[...draft.fixtures,snapped]};
}
/** Split room labels without inserting a physical divider. Existing walls must not be removed. */
export function splitRoomLabel(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft,roomId:string,axis:'h'|'v',fraction:number):BlueprintDraft {
  const room=roomGroups(draft.rooms).find(r=>r.id===roomId);if(!room||!Number.isFinite(fraction)||fraction<=0||fraction>=1)throw new Error('Select a room and an interior split position.');
  const line=(axis==='v'?room.x:room.z)+(axis==='v'?room.width:room.depth)*fraction,grid=base.gridSizeMm;
  const plan=blueprintPlan(base,floorId,draft),runs=wallRuns(plan.floors.find(f=>f.id===floorId)!,grid);
  const start=axis==='v'?room.z:room.x,end=start+(axis==='v'?room.depth:room.width);
  if(runs.some(r=>r.horizontal===(axis==='h')&&Math.abs(r.line-line)<1&&r.end>start&&r.start<end))throw new Error('A physical wall already follows this line. Use room editing to preserve it.');
  const ids=new Set(room.parts.map(p=>p.id)),group=uid(),cuts:BlueprintDraft['walls']=[];
  const rooms=draft.rooms.flatMap(r=>{
    if(!ids.has(r.id))return [r];const a=axis==='v'?r.x:r.z,b=a+(axis==='v'?r.width:r.depth);
    if(b<=line)return [r];if(a>=line)return [{...r,groupId:group,name:`${room.name} — separate area`}];
    if(Math.min(line-a,b-line)<100)throw new Error('Keep at least 10 cm on either side of each split rectangle.');
    cuts.push(axis==='v'?{id:uid(),ax:line/grid,bx:line/grid,az:r.z/grid,bz:(r.z+r.depth)/grid}:{id:uid(),az:line/grid,bz:line/grid,ax:r.x/grid,bx:(r.x+r.width)/grid});
    return [{...r,...(axis==='v'?{width:line-a}:{depth:line-a})},{...r,id:uid(),groupId:group,name:`${room.name} — separate area`,...(axis==='v'?{x:line,width:b-line}:{z:line,depth:b-line})}];
  });
  if(!cuts.length)throw new Error('Choose a split that crosses the room interior.');
  if(rooms.length>100)throw new Error('This split would exceed the 100-area limit.');
  return {...draft,rooms,wallCuts:[...draft.wallCuts??[],...cuts]};
}
