import {blueprintPlan,blueprintProblems,mergeFloorRegions,roomGroups,type BlueprintDraft} from './blueprint';
import {subtractRect,unionRects,rectArea,type FloorRect} from './floorGeometry';
import {isDoor,isWallOpening} from './catalog';
import {windowProblem} from './windows';
import {uid} from './domain';
import {applyReviewedOpening} from './openingCorrections';
import type {PixelRect} from './doorBoundaryGeometry';
import type {Span} from './openingReviewContract';
import type {PlanDocumentV1} from './types';
/** Added regions must be the bounded source candidates selected in the current preview. */
export function applyMissingFloorRepair(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft,roomId:string,hallId:string,added:PixelRect[],transferred:PixelRect[],door:Span,scale:number):BlueprintDraft {
  const hall=roomGroups(draft.rooms).find(g=>g.id===hallId);
  if(!hall||!added.length||added.length+transferred.length>30||!Number.isFinite(scale)||scale<=0)throw new Error('Invalid missing floor selection.');
  const newParts=added.map(r=>({...hall.parts[0],id:uid(),groupId:hall.groupId??hall.id,x:r.x*scale,z:r.y*scale,width:r.width*scale,depth:r.height*scale}));
  if(newParts.some(r=>![r.x,r.z,r.width,r.depth].every(Number.isFinite)||r.width<10||r.depth<10||draft.rooms.some(p=>Math.min(r.x+r.width,p.x+p.width)-Math.max(r.x,p.x)>.1&&Math.min(r.z+r.depth,p.z+p.depth)-Math.max(r.z,p.z)>.1)))throw new Error('New floor overlaps an existing room or has invalid dimensions.');
  const augmented={...draft,rooms:draft.rooms.map(r=>hall.parts.includes(r)?{...r,groupId:hall.groupId??hall.id}:r).concat(newParts)};
  const next=applyBoundaryRepair(base,floorId,augmented,roomId,hallId,[...added,...transferred],door,scale);
  validateBoundaryChange(base,floorId,draft,next);return next;
}
/** Transfer existing floor ownership only; preserve all unrelated edits and the pair's exact union. */
export function applyBoundaryRepair(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft,roomId:string,hallId:string,transferred:PixelRect[],door:Span,scale:number):BlueprintDraft {
  const groups=roomGroups(draft.rooms),room=groups.find(r=>r.id===roomId),hall=groups.find(r=>r.id===hallId);
  if(!room||!hall||room===hall||!room.enclosed||!Number.isFinite(scale)||scale<=0||!transferred.length||transferred.length>30)throw new Error('Choose an enclosed receiving room and a different adjacent space.');
  const cuts=transferred.map(r=>({x:r.x*scale,z:r.y*scale,width:r.width*scale,depth:r.height*scale}));
  if(cuts.some(r=>![r.x,r.z,r.width,r.depth].every(Number.isFinite)||r.width<=0||r.depth<=0))throw new Error('Invalid repair area.');
  const remaining=(parts:FloorRect[],remove:FloorRect[])=>remove.reduce((p,c)=>p.flatMap(r=>subtractRect(r,c)),parts);
  if(remaining(cuts,hall.parts).reduce((s,r)=>s+rectArea(r),0)>1)throw new Error('The repair includes missing floor. Draw the missing room area first, then preview again.');
  const other=draft.rooms.filter(r=>!hall.parts.includes(r));
  if(cuts.some(c=>other.some(r=>Math.min(c.x+c.width,r.x+r.width)-Math.max(c.x,r.x)>.1&&Math.min(c.z+c.depth,r.z+r.depth)-Math.max(c.z,r.z)>.1)))throw new Error('The repair overlaps another room. Correct the overlapping room areas first.');
  const moved=unionRects(cuts),left=mergeFloorRegions(remaining(hall.parts,moved)),received=mergeFloorRegions(unionRects([...room.parts,...moved]));
  if(!left.length||moved.reduce((a,r)=>a+rectArea(r),0)>hall.parts.reduce((a,r)=>a+rectArea(r),0)*.55)throw new Error('This would move most of the adjacent space. Check the selected pair.');
  // Do not hide an authored wall inside the newly united room.
  for(const wall of draft.walls){const horizontal=wall.az===wall.bz,line=(horizontal?wall.az:wall.ax)*base.gridSizeMm,start=Math.min(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*base.gridSizeMm,end=Math.max(horizontal?wall.ax:wall.az,horizontal?wall.bx:wall.bz)*base.gridSizeMm;
    const covered=(side:number)=>received.some(r=>horizontal?line+side>r.z&&line+side<r.z+r.depth&&end>r.x&&start<r.x+r.width:line+side>r.x&&line+side<r.x+r.width&&end>r.z&&start<r.z+r.depth);
    if(covered(-1)&&covered(1))throw new Error('An edited wall crosses the repaired room. Review that wall before changing ownership.');
  }
  const connected=(parts:FloorRect[])=>{const seen=new Set([0]);for(let pass=0;pass<parts.length;pass++)parts.forEach((r,i)=>{if([...seen].some(j=>{const p=parts[j];return (Math.abs(r.x+r.width-p.x)<.01||Math.abs(p.x+p.width-r.x)<.01)&&Math.min(r.z+r.depth,p.z+p.depth)>Math.max(r.z,p.z)+.01||(Math.abs(r.z+r.depth-p.z)<.01||Math.abs(p.z+p.depth-r.z)<.01)&&Math.min(r.x+r.width,p.x+p.width)>Math.max(r.x,p.x)+.01;}))seen.add(i);});return seen.size===parts.length;};
  if(!connected(received))throw new Error('Missing floor separates the recess from this room. Draw the missing area first, then preview again.');
  const replace=(g:typeof room,parts:FloorRect[])=>parts.map((r,i)=>({...g.parts[0],...r,id:i?uid():g.id,groupId:g.groupId??g.id}));
  let next:BlueprintDraft={...draft,rooms:[...draft.rooms.filter(r=>!room.parts.includes(r)&&!hall.parts.includes(r)),...replace(room,received),...replace(hall,left)]};
  if(next.rooms.length>100||next.rooms.some(r=>r.width<10||r.depth<10))throw new Error('The repair has tiny or too many pieces. Adjust the nearby room edges first.');
  const x=(door.ax+door.bx)*scale/2,z=(door.ay+door.by)*scale/2,width=Math.hypot(door.bx-door.ax,door.by-door.ay)*scale,horizontal=door.ay===door.by;
  const existing=draft.fixtures.find(f=>isDoor(f.catalogId)&&!f.doorless&&(f.rotation%180===0)===horizontal&&Math.hypot(f.x-x,f.z-z)<120&&Math.abs(f.widthMm-width)<120);
  if(!existing)next=applyReviewedOpening(base,floorId,next,door,scale,'door');
  validateBoundaryChange(base,floorId,draft,next);return next;
}
function validateBoundaryChange(base:PlanDocumentV1,floorId:string,draft:BlueprintDraft,next:BlueprintDraft){
  const plan=blueprintPlan(base,floorId,next),previous=blueprintPlan(base,floorId,draft);
  for(const f of draft.fixtures.filter(f=>isWallOpening(f.catalogId)))if(!windowProblem(previous,f)&&windowProblem(plan,f))throw new Error('This repair would detach an existing opening. Correct its host wall first.');
  const oldProblems=new Set(blueprintProblems(previous,floorId));const problem=blueprintProblems(plan,floorId).find(p=>!oldProblems.has(p));if(problem)throw new Error(problem);
}
