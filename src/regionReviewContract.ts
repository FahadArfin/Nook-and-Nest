import type {FloorRegion} from './missingFloorGeometry';
import type {Span} from './openingReviewContract';
export interface RegionRequest {version:'region-review-v1';room:string;hall:string;door:Span;regions:FloorRegion[];annotated:string}
export interface RegionAnswer {selectedIds:string[];confidence:'high'|'medium'|'low';note:string}
export function validateRegionRequest(value:unknown,width:number,height:number):RegionRequest {
  const r=value as RegionRequest;
  if(!r||r.version!=='region-review-v1'||typeof r.room!=='string'||r.room.length>100||typeof r.hall!=='string'||r.hall.length>100||!Array.isArray(r.regions)||!r.regions.length||r.regions.length>7||typeof r.annotated!=='string'||r.annotated.length>5*1024*1024||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(r.annotated))throw new Error('Invalid analysis regions.');
  const d=r.door;if(!d||![d.ax,d.ay,d.bx,d.by].every(Number.isFinite)||Math.min(d.ax,d.bx)<0||Math.max(d.ax,d.bx)>width||Math.min(d.ay,d.by)<0||Math.max(d.ay,d.by)>height||(d.ax!==d.bx&&d.ay!==d.by)||Math.hypot(d.bx-d.ax,d.by-d.ay)<5)throw new Error('Invalid analysis doorway.');
  const ids=new Set();let count=0;
  for(const region of r.regions){if(!region||!/^region-([1-6]|transfer)$/.test(region.id)||ids.has(region.id)||typeof region.added!=='boolean'||!Array.isArray(region.rects)||!region.rects.length)throw new Error('Invalid analysis region.');ids.add(region.id);for(const p of region.rects){count++;if(!p||![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.width<=0||p.height<=0||p.x<0||p.y<0||p.x+p.width>width+.01||p.y+p.height>height+.01)throw new Error('Invalid analysis region bounds.');}}
  if(count>30)throw new Error('Invalid analysis region count.');return r;
}
export function validateRegionAnswer(value:unknown,regions:FloorRegion[]):RegionAnswer {
  const r=value as RegionAnswer;if(!r||!Array.isArray(r.selectedIds)||r.selectedIds.length>regions.length||new Set(r.selectedIds).size!==r.selectedIds.length||r.selectedIds.some(id=>!regions.some(p=>p.id===id))||!['high','medium','low'].includes(r.confidence)||typeof r.note!=='string'||r.note.length>800)throw new Error('Invalid analysis region selection.');return r;
}
export const regionAnswerSchema=(ids:string[])=>({type:'object',additionalProperties:false,required:['selectedIds','confidence','note'],properties:{selectedIds:{type:'array',items:{type:'string',enum:ids}},confidence:{type:'string',enum:['high','medium','low']},note:{type:'string'}}});
