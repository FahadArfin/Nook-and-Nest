import { roomGroups, type BlueprintRoom } from './blueprint';

// Translate the whole selected room without changing its shape. Opposing edges
// attract only when their wall spans overlap, never across unrelated rooms.
export function snapRoomMove(rooms:BlueprintRoom[],id:string,dx:number,dz:number,tolerance=120) {
  const group=roomGroups(rooms).find(g=>g.parts.some(p=>p.id===id));
  if(!group)return {rooms,snapped:false};
  const ids=new Set(group.parts.map(p=>p.id)),others=rooms.filter(r=>!ids.has(r.id));
  let sx=0,sz=0,bestX=tolerance,bestZ=tolerance;
  for(const a of group.parts)for(const b of others){
    if(Math.min(a.z+dz+a.depth,b.z+b.depth)>Math.max(a.z+dz,b.z))for(const offset of [b.x-(a.x+dx+a.width),b.x+b.width-(a.x+dx)])if(Math.abs(offset)<bestX){sx=offset;bestX=Math.abs(offset);}
  }
  for(const a of group.parts)for(const b of others){
    if(Math.min(a.x+dx+sx+a.width,b.x+b.width)>Math.max(a.x+dx+sx,b.x))for(const offset of [b.z-(a.z+dz+a.depth),b.z+b.depth-(a.z+dz)])if(Math.abs(offset)<bestZ){sz=offset;bestZ=Math.abs(offset);}
  }
  return {rooms:rooms.map(r=>ids.has(r.id)?{...r,x:r.x+dx+sx,z:r.z+dz+sz}:r),snapped:bestX<tolerance||bestZ<tolerance};
}
