import {furnitureIsLocked,assertLockedFurnitureUnchanged,type GroupPlan} from './furnitureGroups';
import {validatePlan,MAX_PLAN_BYTES} from './planValidation';
import type {PlanDocumentV1,FurniturePlacement} from './types';
import type {KitPreviewRequest} from './FurnitureKitsPanel';
import {parseMoodboard,parseMoodboards,type Moodboard,type MoodboardPlan,type MoodboardTarget,type PersonalSurface,type SurfacePlacement} from './moodboards';
import {moodboardMaterialSlots,personalArtModels,validateSurfaceForPiece} from './moodboardMaterials';

function checked<T extends PlanDocumentV1>(plan:T):T {validatePlan(plan);if(new TextEncoder().encode(JSON.stringify(plan)).byteLength>MAX_PLAN_BYTES)throw new Error('This edit would exceed the project size limit.');return plan;}
export function saveMoodboard(base:PlanDocumentV1,input:Moodboard):MoodboardPlan {
  const board=parseMoodboard({...input,updatedAt:new Date().toISOString()}),existing=(base as MoodboardPlan).moodboards?.boards??[];
  const boards=existing.some(b=>b.id===board.id)?existing.map(b=>b.id===board.id?board:b):[...existing,board];
  return checked({...base,moodboards:parseMoodboards({version:1,boards})});
}
export function deleteMoodboard(base:PlanDocumentV1,id:string):MoodboardPlan {return checked({...base,moodboards:parseMoodboards({version:1,boards:((base as MoodboardPlan).moodboards?.boards??[]).filter(b=>b.id!==id)})});}
function inRoom(x:number,z:number,room:{x:number;z:number;width:number;depth:number;polygon?:{x:number;z:number}[]}){
  const p=room.polygon??[{x:room.x,z:room.z},{x:room.x+room.width,z:room.z},{x:room.x+room.width,z:room.z+room.depth},{x:room.x,z:room.z+room.depth}];let inside=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j],cross=(x-a.x)*(b.z-a.z)-(z-a.z)*(b.x-a.x);if(Math.abs(cross)<.001&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)&&z>=Math.min(a.z,b.z)&&z<=Math.max(a.z,b.z))return true;if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;
}
export function resolveMoodboardTarget(plan:PlanDocumentV1,target:MoodboardTarget):FurniturePlacement[]{
  const floor=plan.floors.find(f=>f.id===target.floorId);if(!floor)throw new Error('The linked floor is no longer available. Choose another target.');const pieces=plan.furniture.filter(p=>p.floorId===floor.id);
  if(target.scope==='floor')return pieces;
  if(target.scope==='group'){const group=(plan as GroupPlan).furnitureGroups?.groups.find(g=>g.id===target.id&&g.floorId===floor.id);if(!group)throw new Error('The linked group is no longer available. Choose another target.');return pieces.filter(p=>group.memberIds.includes(p.id));}
  const rooms=floor.blueprint?.rooms.filter(r=>(r.groupId??r.id)===target.id)??[];if(!rooms.length)throw new Error('The linked room is no longer available. Choose another target.');return pieces.filter(p=>rooms.some(r=>inRoom(p.x,p.z,r)));
}
export interface PaletteProposal extends KitPreviewRequest {changedIds:string[];skippedLockedIds:string[];unmatchedIds:string[]}
export function buildMoodboardPalette(base:PlanDocumentV1,input:Moodboard):PaletteProposal {
  const board=parseMoodboard(input);if(!board.target||!board.bindings.length)throw new Error('Choose a room or group and link at least one palette color to a material role.');
  const targets=new Set(resolveMoodboardTarget(base,board.target).map(p=>p.id)),colors=new Map(board.palette.map(c=>[c.id,c.color])),changedIds:string[]=[],skippedLockedIds:string[]=[],unmatchedIds:string[]=[];
  const furniture=base.furniture.map(piece=>{if(!targets.has(piece.id))return piece;if(furnitureIsLocked(base,piece.id)){skippedLockedIds.push(piece.id);return piece;}
    const slots=new Set(moodboardMaterialSlots(piece.catalogId).map(s=>s.id)),imageSlot=(piece as SurfacePlacement).personalSurface?.slotId,bindings=board.bindings.filter(b=>slots.has(b.slotId)&&b.slotId!==imageSlot);if(!bindings.length){unmatchedIds.push(piece.id);return piece;}
    const materialColors={...piece.materialColors};let changed=false;for(const binding of bindings){const next=colors.get(binding.paletteId)!;if(materialColors[binding.slotId]!==next){materialColors[binding.slotId]=next;changed=true;}}
    if(!changed)return piece;changedIds.push(piece.id);return {...piece,materialColors};
  });
  if(!changedIds.length)throw new Error(skippedLockedIds.length?'No editable matching parts changed. Locked pieces were preserved.':'No matching material colors changed. Choose another role or color.');
  const plan=checked({...base,furniture});assertLockedFurnitureUnchanged(base,plan);
  return {base,plan,floorId:board.target.floorId,label:`Palette: ${board.name}`,addedIds:[],warnings:[],changedIds,skippedLockedIds,unmatchedIds};
}
export function buildPersonalSurface(base:PlanDocumentV1,floorId:string,itemId:string,input:PersonalSurface):PaletteProposal {
  const piece=base.furniture.find(p=>p.id===itemId&&p.floorId===floorId);if(!piece)throw new Error('Choose an existing piece on the current floor.');if(furnitureIsLocked(base,piece.id))throw new Error('Unlock this piece or its group before applying a personal image.');
  const personalSurface=validateSurfaceForPiece(input,piece),materialColors={...piece.materialColors,[personalSurface.slotId]:personalSurface.fallbackColor};
  if(personalSurface.kind==='art'&&personalSurface.frameColor)materialColors[personalArtModels[piece.catalogId].frameSlot]=personalSurface.frameColor;
  const replacement:SurfacePlacement={...piece,personalSurface,materialColors},plan=checked({...base,furniture:base.furniture.map(p=>p.id===itemId?replacement:p)});assertLockedFurnitureUnchanged(base,plan);
  return {base,plan,floorId,label:personalSurface.label,addedIds:[],warnings:[],changedIds:[itemId],skippedLockedIds:[],unmatchedIds:[]};
}
export function buildRemovePersonalSurface(base:PlanDocumentV1,floorId:string,itemId:string):PaletteProposal {
  const piece=base.furniture.find(p=>p.id===itemId&&p.floorId===floorId) as SurfacePlacement|undefined;if(!piece?.personalSurface)throw new Error('This piece has no personal image.');if(furnitureIsLocked(base,itemId))throw new Error('Unlock this piece or group before restoring its catalog appearance.');
  const {personalSurface,...rest}=piece,materialColors={...piece.materialColors};if(materialColors[personalSurface.slotId]===personalSurface.fallbackColor)delete materialColors[personalSurface.slotId];const frame=personalArtModels[piece.catalogId]?.frameSlot;if(frame&&personalSurface.frameColor&&materialColors[frame]===personalSurface.frameColor)delete materialColors[frame];
  const replacement={...rest,materialColors:Object.keys(materialColors).length?materialColors:undefined},plan=checked({...base,furniture:base.furniture.map(p=>p.id===itemId?replacement:p)});assertLockedFurnitureUnchanged(base,plan);
  return {base,plan,floorId,label:'Restore catalog appearance',addedIds:[],warnings:[],changedIds:[itemId],skippedLockedIds:[],unmatchedIds:[]};
}
