import { catalog, defaultMountHeight, isDoor, isStairs, isSurfaceMounted, isWallMounted, variants } from './catalog';
import metadata from './modelMaterials.json';
import { fitStair, stairWarnings, visibleFloorRects } from './building';
import { uid } from './domain';
import { addMeasuredRegion, floorBoundaryWalls, measuredRegion, paintFloorCells } from './floorGeometry';
import { restsOnShelf, shelfChoices, shelfSurfaces } from './shelfSurfaces';
import { supportsDesktop, tabletopPoint } from './tabletop';
import { countertopFinishes, defaultCountertopFinish, defaultDoorFinish, doorFinishes, floorFinishes, supportsCountertopFinish, wallFinishes } from './surfaces';
import { snapWindow, windowProblem } from './windows';
import { validatePlan, MAX_PLAN_BYTES } from './planValidation';
import { array, choice, integer, number, object, text, type Schema } from './agentSchema';
import type { FurniturePlacement, PlanDocumentV1, TileCell } from './types';

export const materialSlots=(id:string)=>(metadata as Record<string,{id:string;label:string;color:string}[]>)[id]??[];
const color:Schema={type:'string',pattern:'^#[0-9a-fA-F]{6}$',maxLength:7};
const transform={x:number(),z:number(),rotation:number(-3600,3600),widthMm:integer(10,50000),depthMm:integer(10,50000),heightMm:integer(10,50000),elevationMm:integer(0,20000),variant:choice(...Object.keys(variants)),surfaceVariant:text(),materialColors:{type:'object',additionalProperties:color} as Schema,toFloorId:text(),stairRiseMm:integer(100,20000)};
const support={supportId:text(),shelfId:text()};
const cell=object({x:integer(-9000,9000),z:integer(-9000,9000)},['x','z']);
export const operationSchema:Schema={anyOf:[
  object({action:choice('place'),catalogId:text(),floorId:text(),key:text(60),...transform,...support},['action','catalogId','floorId','x','z']),
  object({action:choice('update'),id:text(),...transform,...support},['action','id']),
  object({action:choice('remove'),ids:array(text(),100)},['action','ids']),
  object({action:choice('add_room'),floorId:text(),origin:cell,widthMm:integer(100,60000),depthMm:integer(100,60000)},['action','floorId','origin','widthMm','depthMm']),
  object({action:choice('paint_tiles'),floorId:text(),cells:array(cell,2000),present:{type:'boolean'}},['action','floorId','cells','present']),
  object({action:choice('add_wall'),floorId:text(),ax:number(),az:number(),bx:number(),bz:number()},['action','floorId','ax','az','bx','bz']),
  object({action:choice('remove_wall'),floorId:text(),id:text()},['action','floorId','id']),
  object({action:choice('finish'),floorId:text(),kind:choice('floor','wall'),finishId:text(),cells:array(cell,2000),wallId:text()},['action','floorId','kind','finishId']),
  object({action:choice('environment'),background:choice('plain','city','suburban','rural','farm','medieval'),grass:choice('off','sparse','lush')},['action','background','grass']),
]};
type Transform=Partial<Omit<FurniturePlacement,'id'|'catalogId'|'floorId'>>;
export type DesignOperation =
 | ({action:'place';catalogId:string;floorId:string;key?:string;x:number;z:number;supportId?:string;shelfId?:string}&Transform)
 | ({action:'update';id:string;supportId?:string;shelfId?:string}&Transform)
 | {action:'remove';ids:string[]}
 | {action:'add_room';floorId:string;origin:TileCell;widthMm:number;depthMm:number}
 | {action:'paint_tiles';floorId:string;cells:TileCell[];present:boolean}
 | {action:'add_wall';floorId:string;ax:number;az:number;bx:number;bz:number}
 | {action:'remove_wall';floorId:string;id:string}
 | {action:'finish';floorId:string;kind:'floor'|'wall';finishId:string;cells?:TileCell[];wallId?:string}
 | {action:'environment';background:NonNullable<PlanDocumentV1['environment']>['background'];grass:NonNullable<PlanDocumentV1['environment']>['grass']};

export function buildDesign(base:PlanDocumentV1,operations:DesignOperation[]) {
  const plan=structuredClone(base),keys:Record<string,string>=Object.create(null),changed=new Set<string>();
  const resolve=(id:string)=>keys[id]??id;
  for(const op of operations){
    if(op.action==='place'||op.action==='update'){
      const old=op.action==='update'?plan.furniture.find(f=>f.id===resolve(op.id)):undefined;
      if(op.action==='update'&&!old)throw new Error(`Furniture ${op.id} was not found.`);
      const catalogId=op.action==='place'?op.catalogId:old!.catalogId,def=catalog.find(c=>c.id===catalogId);
      if(!def)throw new Error(`Unknown catalog ID ${catalogId}. Search the catalog first.`);
      let item: FurniturePlacement=old?{...old}:{id:uid(),catalogId,floorId:(op as Extract<DesignOperation,{action:'place'}>).floorId,x:0,z:0,rotation:0,widthMm:def.widthMm,depthMm:def.depthMm,heightMm:def.heightMm,variant:'sage',elevationMm:defaultMountHeight(catalogId),surfaceVariant:isDoor(catalogId)?defaultDoorFinish.id:supportsCountertopFinish(catalogId)?defaultCountertopFinish.id:undefined};
      if(!plan.floors.some(f=>f.id===item.floorId))throw new Error('Unknown floor ID.');
      for(const k of Object.keys(transform) as (keyof Transform)[])if(k in op)(item as unknown as Record<string,unknown>)[k]=(op as unknown as Record<string,unknown>)[k];
      item.x=Math.round(item.x);item.z=Math.round(item.z);item.rotation=((item.rotation%360)+360)%360;
      if(item.materialColors){const slots=new Set(materialSlots(catalogId).map(s=>s.id));for(const key of Object.keys(item.materialColors))if(!slots.has(key))throw new Error(`Unknown material part ${key} for ${catalogId}.`);}
      if(item.surfaceVariant){const finishes=isDoor(catalogId)?doorFinishes:supportsCountertopFinish(catalogId)?countertopFinishes:[];if(!finishes.some(f=>f.id===item.surfaceVariant))throw new Error('Unsupported surface finish for this furniture.');}
      if(item.toFloorId){const index=plan.floors.findIndex(f=>f.id===item.floorId);if(!isStairs(catalogId)||plan.floors[index+1]?.id!==item.toFloorId)throw new Error('Stairs must connect to the adjacent floor above.');}
      item=fitStair(plan,snapWindow(plan,item));
      if(op.supportId){
        if(!isSurfaceMounted(catalogId)&&catalogId!=='table-lamp')throw new Error('This item does not support tabletop or shelf placement.');
        const owner=plan.furniture.find(f=>f.id===resolve(op.supportId!)&&f.floorId===item.floorId&&f.id!==item.id);
        if(!owner)throw new Error('Support must exist on the same floor. Add it earlier in the batch.');
        if(op.shelfId){const match=shelfChoices(plan,item).find(c=>c.owner.id===owner.id&&c.surface.id===op.shelfId);if(!match)throw new Error('This piece does not fit the selected shelf.');item={...item,...match.placement};}
        else {const floor=plan.floors.find(f=>f.id===item.floorId)!;const point=tabletopPoint({...plan,furniture:[owner]},item,{x:item.x/1000,y:(floor.elevationMm+owner.heightMm+(owner.elevationMm??0)+50000)/1000,z:item.z/1000},{x:0,y:-1,z:0});if(!point)throw new Error('The entire piece must fit on the support surface.');item={...item,...point};}
      }else if(op.shelfId)throw new Error('shelfId requires supportId.');
      const problem=windowProblem({...plan,furniture:plan.furniture.filter(f=>f.id!==item.id)},item);if(problem)throw new Error(problem);
      if(old)plan.furniture=plan.furniture.map(f=>f.id===item.id?item:f);else plan.furniture.push(item);
      changed.add(item.id);
      if(op.action==='place'&&op.key){if(Object.hasOwn(keys,op.key)||['__proto__','constructor','prototype'].includes(op.key)||plan.furniture.some(f=>f.id===op.key))throw new Error('Use a unique, non-reserved key for each new piece.');keys[op.key]=item.id;}
    }else if(op.action==='remove'){
      for(const inputId of op.ids){const id=resolve(inputId);if(!plan.furniture.some(f=>f.id===id))throw new Error(`Furniture ${inputId} was not found.`);plan.furniture=plan.furniture.filter(f=>f.id!==id);changed.add(id);}
    }else if(op.action==='environment'){plan.environment={background:op.background,grass:op.grass};}
    else {
      const index=plan.floors.findIndex(f=>f.id===op.floorId);if(index<0)throw new Error('Unknown floor ID.');let floor=plan.floors[index];
      if(op.action==='add_room')floor=addMeasuredRegion(floor,plan.gridSizeMm,measuredRegion(plan.gridSizeMm,op.origin,op.widthMm,op.depthMm));
      if(op.action==='paint_tiles')floor=paintFloorCells(floor,op.cells,op.present);
      if(op.action==='add_wall'){
        if(op.ax!==op.bx&&op.az!==op.bz||op.ax===op.bx&&op.az===op.bz)throw new Error('Walls must be nonzero orthogonal segments.');
        floor.walls.push({id:uid(),ax:op.ax/plan.gridSizeMm,az:op.az/plan.gridSizeMm,bx:op.bx/plan.gridSizeMm,bz:op.bz/plan.gridSizeMm});
      }
      if(op.action==='remove_wall'){if(!floor.walls.some(w=>w.id===op.id))throw new Error('Unknown interior wall. Outer walls are derived from tiles.');floor.walls=floor.walls.filter(w=>w.id!==op.id);}
      if(op.action==='finish'){
        const finishes=op.kind==='floor'?floorFinishes:wallFinishes;if(!finishes.some(f=>f.id===op.finishId))throw new Error('Unknown finish ID.');
        if(op.kind==='floor'){
          if(op.wallId)throw new Error('Use cells for floor finishes.');
          if(op.cells){const occupied=new Set(floor.cells.map(c=>`${c.x},${c.z}`));floor.cellFinishes={...floor.cellFinishes};for(const c of op.cells){const key=`${c.x},${c.z}`;if(!occupied.has(key))throw new Error('Cannot finish an unpainted tile.');floor.cellFinishes[key]=op.finishId;}}
          else {floor.floorFinishId=op.finishId;floor.cellFinishes={};}
        }else {
          if(op.cells)throw new Error('Use wallId for wall finishes.');
          if(op.wallId){if(![...floorBoundaryWalls(floor,plan.gridSizeMm),...floor.walls].some(w=>w.id===op.wallId))throw new Error('Unknown wall ID.');floor.wallFinishes={...floor.wallFinishes,[op.wallId]:op.finishId};}
          else {floor.wallFinishId=op.finishId;floor.wallFinishes={};}
        }
      }
      plan.floors[index]=floor;
    }
  }
  // Architecture changes must not leave existing mounted openings unsupported.
  for(const item of plan.furniture){const problem=windowProblem({...plan,furniture:plan.furniture.filter(f=>f.id!==item.id)},item);if(problem)throw new Error(`${item.catalogId}: ${problem}`);}
  validatePlan(plan);if(new TextEncoder().encode(JSON.stringify(plan)).length>MAX_PLAN_BYTES)throw new Error('The design exceeds the 1 MB project limit.');
  return {plan,keys,changedIds:[...changed],warnings:designWarnings(plan)};
}

// Bounding rectangles, not triangle/physics collision. SAT handles arbitrary rotation.
export function footprint(item:FurniturePlacement){const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [-1,1].flatMap(x=>[-1,1].map(z=>({x:item.x+x*item.widthMm/2*c+z*item.depthMm/2*s,z:item.z-x*item.widthMm/2*s+z*item.depthMm/2*c})));}
export function overlap(a:FurniturePlacement,b:FurniturePlacement){
  if(a.floorId!==b.floorId||(a.elevationMm??0)>=(b.elevationMm??0)+b.heightMm-1||(b.elevationMm??0)>=(a.elevationMm??0)+a.heightMm-1)return false;
  const ac=footprint(a),bc=footprint(b);
  for(const item of [a,b])for(const angle of [item.rotation,item.rotation+90]){const c=Math.cos(angle*Math.PI/180),s=-Math.sin(angle*Math.PI/180),pa=ac.map(p=>p.x*c+p.z*s),pb=bc.map(p=>p.x*c+p.z*s);if(Math.max(...pa)<=Math.min(...pb)+1||Math.max(...pb)<=Math.min(...pa)+1)return false;}
  return true;
}
export function designWarnings(plan:PlanDocumentV1){
  const warnings:{kind:string;ids:string[];message:string}[]=[],rects=new Map(plan.floors.map(f=>[f.id,visibleFloorRects(plan,f.id)]));
  const shape=(id:string)=>catalog.find(c=>c.id===id)?.shape;
  for(const item of plan.furniture){
    if(!isWallMounted(item.catalogId)&&!isStairs(item.catalogId)&&!footprint(item).every(p=>rects.get(item.floorId)!.some(r=>p.x>=r.x-1&&p.x<=r.x+r.width+1&&p.z>=r.z-1&&p.z<=r.z+r.depth+1)))warnings.push({kind:'floor_edge',ids:[item.id],message:'Footprint extends beyond floor tiles or into a stair opening; outdoor ground placement may be intentional.'});
    if(isStairs(item.catalogId))for(const message of stairWarnings(plan,item))warnings.push({kind:'stairs',ids:[item.id],message});
  }
  for(let i=0;i<plan.furniture.length&&warnings.length<100;i++)for(let j=i+1;j<plan.furniture.length&&warnings.length<100;j++){
    const a=plan.furniture[i],b=plan.furniture[j];if(shape(a.catalogId)==='rug'||shape(b.catalogId)==='rug'||restsOnShelf(a,b)||restsOnShelf(b,a))continue;
    if(overlap(a,b))warnings.push({kind:'overlap',ids:[a.id,b.id],message:'Bounding footprints overlap at the same height. Check the visible fit.'});
  }
  return warnings.slice(0,100);
}
export function supportSurfaces(item:FurniturePlacement){return {shelves:shelfSurfaces(item),tabletop:supportsDesktop(item)?{elevationMm:(item.elevationMm??0)+item.heightMm,widthMm:item.widthMm,depthMm:item.depthMm}:null};}
