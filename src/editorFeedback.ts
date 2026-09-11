import {catalog} from './catalog';
import type {PlanDocumentV1} from './types';
const names=new Map(catalog.map(item=>[item.id,item.name]));
export function describeEdit(before:PlanDocumentV1,after:PlanDocumentV1):string|undefined {
  if(before.id!==after.id)return;
  if(after.floors.length>before.floors.length)return `Added ${after.floors.find(f=>!before.floors.some(b=>b.id===f.id))?.name??'floor'}`;
  if(after.floors.length<before.floors.length)return `Deleted ${before.floors.find(f=>!after.floors.some(b=>b.id===f.id))?.name??'floor'}`;
  if(after.floors.some((f,i)=>f.id!==before.floors[i].id))return 'Reordered building floors';
  const added=after.furniture.length-before.furniture.length;
  if(added===1)return `Added ${names.get(after.furniture.at(-1)!.catalogId)??'furniture'}`;
  if(added>1)return `Added ${added} pieces`;
  if(added===-1){const ids=new Set(after.furniture.map(p=>p.id));const removed=before.furniture.find(p=>!ids.has(p.id));return `Removed ${names.get(removed?.catalogId??'')??'piece'}`;}
  if(added<0)return `Removed ${-added} pieces`;
  for(let i=0;i<after.floors.length;i++){
    const a=after.floors[i],b=before.floors[i];if(a===b)continue;
    if(a.name!==b.name)return `Renamed floor to ${a.name}`;
    if(a.floorFinishId!==b.floorFinishId||a.wallFinishId!==b.wallFinishId||a.cellFinishes!==b.cellFinishes||a.wallFinishes!==b.wallFinishes)return `Updated finishes on ${a.name}`;
    if(a.cells!==b.cells||a.cellRects!==b.cellRects||a.walls!==b.walls)return `Updated ${a.name} layout`;
  }
  if(after.environment!==before.environment)return 'Updated outdoors';
  // Camera, naming and slider changes stay quiet; feedback must not follow every frame.
}
