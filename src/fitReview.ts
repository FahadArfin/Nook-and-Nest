import clipping, {type MultiPolygon} from 'polygon-clipping';
import {catalog,isWallOpening} from './catalog';
import {visibleFloorRects} from './building';
import {floorBoundaryWalls} from './floorGeometry';
import {geometryArea,polygonBounds,projectPoint,shapeOf,unionShapes,type PlanPoint} from './polygonGeometry';
import {windowWallPieces} from './windows';
import {subtractWallCuts} from './wallCuts';
import {isVegetation} from './vegetation';
import type {FurniturePlacement,PlanDocumentV1} from './types';

export interface FitReviewSettings {
  enabled:boolean; passageMm:number; chairPulloutMm:number;
  checkGaps:boolean; checkChairs:boolean; checkDoors:boolean; checkDrawers:boolean;
  doorOverrides:Record<string,{side:'front'|'back';hinge:'left'|'right'}>;
}
export const defaultFitReviewSettings:FitReviewSettings={enabled:false,passageMm:900,chairPulloutMm:600,checkGaps:true,checkChairs:true,checkDoors:false,checkDrawers:false,doorOverrides:{}};
export function normalizeFitReviewSettings(input:Partial<FitReviewSettings>):FitReviewSettings {
  const number=(v:unknown,fallback:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
  const flag=(key:'enabled'|'checkGaps'|'checkChairs'|'checkDoors'|'checkDrawers')=>typeof input[key]==='boolean'?input[key]!:defaultFitReviewSettings[key];
  const doorOverrides:FitReviewSettings['doorOverrides']={};
  for(const [id,value] of Object.entries(input.doorOverrides??{}).slice(0,200))if(id.length<=160&&!['__proto__','prototype','constructor'].includes(id)&&value&&['front','back'].includes(value.side)&&['left','right'].includes(value.hinge))doorOverrides[id]={side:value.side,hinge:value.hinge};
  return {enabled:flag('enabled'),checkGaps:flag('checkGaps'),checkChairs:flag('checkChairs'),checkDoors:flag('checkDoors'),checkDrawers:flag('checkDrawers'),passageMm:number(input.passageMm,900,100,2500),chairPulloutMm:number(input.chairPulloutMm,600,100,1500),doorOverrides};
}
export type FitIssueKind='floor-edge'|'overlap'|'gap'|'chair-pullout'|'door-swing'|'drawer-opening';
export type FitOverlay = {id:string;issueId:string;floorId:string;itemIds:string[];approximate:boolean} & (
  {kind:'line';a:PlanPoint;b:PlanPoint} | {kind:'footprint';points:PlanPoint[]}
);
export interface FitIssue {
  id:string;kind:FitIssueKind;floorId:string;itemIds:string[];title:string;message:string;
  measuredMm?:number;requiredMm?:number;outsideAreaMm2?:number;approximate:boolean;overlays:FitOverlay[];
}
export interface FitReviewResult {
  floorId:string;issues:FitIssue[];overlays:FitOverlay[];notices:string[];
  stats:{checked:number;recomputed:number;recomputedIds:string[];skippedVegetation:number;limited:boolean};
}
export const emptyFitReview=(floorId=''):FitReviewResult=>({floorId,issues:[],overlays:[],notices:[],stats:{checked:0,recomputed:0,recomputedIds:[],skippedVegetation:0,limited:false}});

/** Only supported authored constructions get envelopes. Travel/swing assumptions are never real-world certification. */
export const fitInteractionMetadata:Readonly<Record<string,{kind:'door'|'drawer';widthRatio:number;depthRatio:number;hingeRatio?:number;hingeZRatio?:number;source:string;note:string}>>={
  'door-flush':{kind:'door',widthRatio:822/950,depthRatio:0,hingeRatio:-411/950,source:'tools/blender/building_models.py:16-29',note:'Authored single-leaf width; assumed 90° swing. Confirm hinge and swing side.'},
  'door-shaker':{kind:'door',widthRatio:822/950,depthRatio:0,hingeRatio:-411/950,source:'tools/blender/building_models.py:16-29',note:'Authored single-leaf width; assumed 90° swing. Confirm hinge and swing side.'},
  'door-six-panel':{kind:'door',widthRatio:822/950,depthRatio:0,hingeRatio:-411/950,source:'tools/blender/building_models.py:16-29',note:'Authored single-leaf width; assumed 90° swing. Confirm hinge and swing side.'},
  'secondary-storm-screen-door':{kind:'door',widthRatio:864/950,depthRatio:0,hingeRatio:-433/950,hingeZRatio:30/165,source:'tools/blender/household_architecture.py:35-48',note:'Authored left hinge and leaf extent; assumed 90° swing. Confirm the opening side.'},
  'office-filing-cabinet':{kind:'drawer',widthRatio:474/510,depthRatio:416/450,source:'tools/blender/household_lighting_office.py:443-451',note:'Authored drawer width/depth. Full drawer-depth extension is an approximate planning allowance; slide stops are not modeled.'},
};
const chairIds=new Set(['dining-chair','breakfast-nook-chair','breakfast-chair','office-chair','ergonomic-office-chair','gaming-chair','bar-stool']);
const definitions=new Map(catalog.map(c=>[c.id,c]));
const doorIds=new Set(catalog.filter(c=>c.category==='Doors').map(c=>c.id)),stairIds=new Set(catalog.filter(c=>c.category==='Stairs').map(c=>c.id)),openingIds=new Set(catalog.filter(c=>isWallOpening(c.id)).map(c=>c.id));
const MAX_ITEMS=600,MAX_ISSUES=200,MAX_NEIGHBORS=120,CELL=2000;
type Bounds={left:number;right:number;top:number;bottom:number};
type Target={id:string;item?:FurniturePlacement;label:string;points:PlanPoint[];bounds:Bounds;bottom:number;top:number;wall?:boolean};
type Envelope={kind:'chair-pullout'|'door-swing'|'drawer-opening';points:PlanPoint[];required:number;origin:PlanPoint;direction:1|-1;note:string};
type Node=Target&{item:FurniturePlacement;signature:string;envelopes:Envelope[];indexBounds:Bounds};
const bounds=(points:PlanPoint[]):Bounds=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.z)),bottom:Math.max(...points.map(p=>p.z))});
const expand=(b:Bounds,n:number):Bounds=>({left:b.left-n,right:b.right+n,top:b.top-n,bottom:b.bottom+n});
const intersects=(a:Bounds,b:Bounds)=>a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
const world=(item:FurniturePlacement,x:number,z:number):PlanPoint=>{const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:item.x+x*c+z*s,z:item.z-x*s+z*c};};
const local=(item:FurniturePlacement,p:PlanPoint):PlanPoint=>{const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-item.x,z=p.z-item.z;return{x:x*c-z*s,z:x*s+z*c};};
const rectangle=(item:FurniturePlacement,width=item.widthMm,depth=item.depthMm,x=0,z=0)=>[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([dx,dz])=>world(item,x+dx,z+dz));
const polygon=(points:PlanPoint[])=>shapeOf(polygonBounds(points));
const areaInside=(a:PlanPoint[],b:PlanPoint[])=>geometryArea(clipping.intersection(polygon(a),polygon(b)));
const edges=(points:PlanPoint[])=>points.map((a,i)=>({a,b:points[(i+1)%points.length]}));
function inside(point:PlanPoint,points:PlanPoint[]){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;}
/** Exact shortest distance between the modeled rotated rectangular footprints, not their axis-aligned bounds. */
export function footprintGap(a:PlanPoint[],b:PlanPoint[]){
  let best={distance:Infinity,a:a[0],b:b[0]};
  for(const [first,second,reversed] of [[a,b,false],[b,a,true]] as const)for(const p of first)for(const e of edges(second)){
    const q=projectPoint(p,e.a,e.b),distance=Math.hypot(p.x-q.x,p.z-q.z);
    if(distance<best.distance)best={distance,a:reversed?q:p,b:reversed?p:q};
  }
  // Crossing polygons may overlap with no vertex contained in the other polygon.
  if(intersects(bounds(a),bounds(b))&&(inside(a[0],b)||inside(b[0],a)||areaInside(a,b)>1))return{...best,distance:0};
  return best;
}
class SpatialIndex<T extends {id:string}> {
  private cells=new Map<string,T[]>();private large:T[]=[];private locations=new Map<string,Bounds>();
  constructor(items:T[],getBounds:(item:T)=>Bounds){for(const item of items){const b=getBounds(item);this.locations.set(item.id,b);const keys=this.keys(b);if(!keys){this.large.push(item);continue;}for(const key of keys){const values=this.cells.get(key)??[];values.push(item);this.cells.set(key,values);}}}
  private keys(b:Bounds){const l=Math.floor(b.left/CELL),r=Math.floor(b.right/CELL),t=Math.floor(b.top/CELL),d=Math.floor(b.bottom/CELL);if((r-l+1)*(d-t+1)>256)return;const keys:string[]=[];for(let x=l;x<=r;x++)for(let z=t;z<=d;z++)keys.push(`${x},${z}`);return keys;}
  query(b:Bounds){const keys=this.keys(b),found=new Map<string,T>();for(const item of this.large)found.set(item.id,item);if(keys)for(const key of keys)for(const item of this.cells.get(key)??[])found.set(item.id,item);else for(const values of this.cells.values())for(const item of values)found.set(item.id,item);return [...found.values()].filter(item=>intersects(b,this.locations.get(item.id)!));}
}
function envelopes(item:FurniturePlacement,s:FitReviewSettings):Envelope[]{
  const list:Envelope[]=[],metadata=fitInteractionMetadata[item.catalogId];
  if(s.checkChairs&&chairIds.has(item.catalogId))list.push({kind:'chair-pullout',points:rectangle(item,item.widthMm,s.chairPulloutMm,0,-(item.depthMm+s.chairPulloutMm)/2),required:s.chairPulloutMm,origin:world(item,0,-item.depthMm/2),direction:-1,note:'User-selected pull-out allowance behind the chair; the entire seat footprint is used.'});
  if(s.checkDrawers&&metadata?.kind==='drawer'){
    const distance=item.depthMm*metadata.depthRatio;
    list.push({kind:'drawer-opening',points:rectangle(item,item.widthMm*metadata.widthRatio,distance,0,(item.depthMm+distance)/2),required:distance,origin:world(item,0,item.depthMm/2),direction:1,note:metadata.note});
  }
  if(s.checkDoors&&metadata?.kind==='door'&&!item.doorless){
    const override=s.doorOverrides[item.id],hinge=override?.hinge??'left',side=override?.side??'front',radius=item.widthMm*metadata.widthRatio;
    const x=Math.abs(item.widthMm*(metadata.hingeRatio??-.43))*(hinge==='left'?-1:1),z=item.depthMm*(metadata.hingeZRatio??0),origin=world(item,x,z);
    const points=[origin,...Array.from({length:25},(_,i)=>{const angle=i*Math.PI/48;return world(item,x+(hinge==='left'?1:-1)*radius*Math.cos(angle),z+(side==='front'?1:-1)*radius*Math.sin(angle));})];
    list.push({kind:'door-swing',points,required:radius,origin,direction:side==='front'?1:-1,note:metadata.note});
  }
  return list;
}
const signature=(p:FurniturePlacement)=>JSON.stringify([p.catalogId,p.floorId,p.x,p.z,p.rotation,p.widthMm,p.depthMm,p.heightMm,p.elevationMm,p.toFloorId,p.stairRiseMm,p.doorless,p.hostDoorId]);
function makeNode(item:FurniturePlacement,s:FitReviewSettings):Node {
  const points=rectangle(item),access=envelopes(item,s),all=[...points,...access.flatMap(e=>e.points)];
  return{id:item.id,item,label:definitions.get(item.catalogId)?.name??item.catalogId,points,bounds:bounds(points),indexBounds:expand(bounds(all),s.checkGaps?s.passageMm:0),signature:signature(item),envelopes:access,bottom:item.elevationMm??0,top:(item.elevationMm??0)+item.heightMm};
}
function wallTargets(plan:PlanDocumentV1,floorId:string):Target[]{
  const floor=plan.floors.find(f=>f.id===floorId)!;
  const openings=plan.furniture.filter(p=>p.floorId===floorId&&openingIds.has(p.catalogId));
  const result:Target[]=[];
  for(const wall of [...floorBoundaryWalls(floor,plan.gridSizeMm),...subtractWallCuts(floor.walls,floor.wallCuts??[])]){
    const ax=wall.ax*plan.gridSizeMm,az=wall.az*plan.gridSizeMm,bx=wall.bx*plan.gridSizeMm,bz=wall.bz*plan.gridSizeMm,length=Math.hypot(bx-ax,bz-az);if(length<1)continue;
    const horizontal=az===bz,diagonal=!horizontal&&ax!==bx;
    const point=(along:number):PlanPoint=>diagonal?{x:ax+(bx-ax)*along/length,z:az+(bz-az)*along/length}:{x:horizontal?along:ax,z:horizontal?az:along};
    for(const [i,p] of windowWallPieces(wall,plan.gridSizeMm,wall.heightMm??floor.heightMm,openings).entries()){
      if(p.top<=0)continue;
      const a=point(p.start),b=point(p.end),nx=-(b.z-a.z)/(p.end-p.start)*50,nz=(b.x-a.x)/(p.end-p.start)*50;
      const points=[{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}];
      result.push({id:`wall:${wall.id}:${i}`,label:'wall',points,bounds:bounds(points),bottom:p.bottom,top:p.top,wall:true});
    }
  }
  return result;
}
const eligible=(p:FurniturePlacement)=>{
  const c=definitions.get(p.catalogId);if(!c||isVegetation(p.catalogId)||c.shape==='rug'||c.mount==='surface'||c.mount==='ceiling'||openingIds.has(p.catalogId)&&!doorIds.has(p.catalogId))return false;
  return doorIds.has(p.catalogId)||stairIds.has(p.catalogId)||p.heightMm>=150&&['seat','table','bed','storage','bathroom','appliance','plant','lamp','decor','device'].includes(c.shape);
};

/** Stateful cache around a pure read-only evaluation. Geometry/material changes never mutate the plan. */
export function createFitReviewEvaluator(){
  let nodes=new Map<string,Node>(),rows=new Map<string,FitIssue[]>(),index=new SpatialIndex<Node>([],n=>n.indexBounds),floorShape:MultiPolygon=[],walls:Target[]=[],wallIndex=new SpatialIndex<Target>([],n=>n.bounds);
  let geometryRefs:unknown[]=[],settingsKey='',previousFloor='',limited=false;
  const limitedOwners=new Set<string>();
  const clear=()=>{nodes.clear();rows.clear();limitedOwners.clear();geometryRefs=[];settingsKey='';previousFloor='';floorShape=[];walls=[];index=new SpatialIndex([],()=>({left:0,right:0,top:0,bottom:0}));wallIndex=new SpatialIndex([],()=>({left:0,right:0,top:0,bottom:0}));};
  return {clear,evaluate(plan:PlanDocumentV1,floorId:string,input:Partial<FitReviewSettings>):FitReviewResult{
    const s=normalizeFitReviewSettings(input);if(!s.enabled)return emptyFitReview(floorId);
    const floor=plan.floors.find(f=>f.id===floorId);if(!floor)return{...emptyFitReview(floorId),notices:['Choose an existing floor to review.']};
    const architecture=plan.furniture.filter(p=>stairIds.has(p.catalogId)||p.floorId===floorId&&openingIds.has(p.catalogId)).map(signature).join('|');
    const refs=[plan.id,floorId,plan.gridSizeMm,floor.cells,floor.cellRects,floor.walls,floor.wallCuts,floor.heightMm,architecture];
    const geometryChanged=refs.some((v,i)=>v!==geometryRefs[i]);
    const key=JSON.stringify({...s,enabled:true});const reset=geometryChanged||key!==settingsKey||previousFloor!==floorId;
    if(geometryChanged){floorShape=unionShapes(visibleFloorRects(plan,floorId));walls=wallTargets(plan,floorId);wallIndex=new SpatialIndex(walls,w=>w.bounds);geometryRefs=refs;}
    const floorItems=plan.furniture.filter(p=>p.floorId===floorId),skippedVegetation=floorItems.filter(p=>isVegetation(p.catalogId)).length,all=floorItems.filter(eligible);
    const selected=all.slice(0,MAX_ITEMS),next=new Map<string,Node>();limited=all.length>MAX_ITEMS;
    for(const p of selected){const old=nodes.get(p.id);next.set(p.id,!reset&&old?.signature===signature(p)?old:makeNode(p,s));}
    const nextIndex=new SpatialIndex([...next.values()],n=>n.indexBounds),affected=new Set<string>();
    if(reset)for(const id of next.keys())affected.add(id);
    else for(const id of new Set([...nodes.keys(),...next.keys()])){
      const before=nodes.get(id),after=next.get(id);if(before===after)continue;affected.add(id);
      if(before)for(const neighbor of index.query(before.indexBounds))affected.add(neighbor.id);
      if(after)for(const neighbor of nextIndex.query(after.indexBounds))affected.add(neighbor.id);
    }
    for(const id of nodes.keys())if(!next.has(id)){rows.delete(id);limitedOwners.delete(id);}
    const issue=(owner:Node,kind:FitIssueKind,suffix:string,title:string,message:string,targets:Target[]=[],measurement:Partial<FitIssue>={},shape?:PlanPoint[],line?:{a:PlanPoint;b:PlanPoint}):FitIssue=>{
      const id=`${kind}:${owner.id}:${suffix}`,itemIds=[owner.id,...targets.filter(t=>!t.wall).map(t=>t.id)],approximate=kind==='chair-pullout'||kind==='door-swing'||kind==='drawer-opening';
      const base={issueId:id,floorId,itemIds,approximate};const overlays:FitOverlay[]=[{...base,id:`${id}:area`,kind:'footprint',points:shape??owner.points}];
      if(line)overlays.push({...base,id:`${id}:line`,kind:'line',...line});
      return{id,kind,floorId,itemIds,title,message,approximate,overlays,...measurement};
    };
    for(const id of affected){
      const node=next.get(id);if(!node)continue;const found:FitIssue[]=[];limitedOwners.delete(id);
      const append=(entry:FitIssue)=>{const duplicate=entry.itemIds.length===1?found.findIndex(i=>i.kind===entry.kind&&i.itemIds.length===1&&(i.outsideAreaMm2!==undefined)===(entry.outsideAreaMm2!==undefined)):-1;if(duplicate<0)found.push(entry);else if((entry.measuredMm??Infinity)<(found[duplicate].measuredMm??Infinity))found[duplicate]=entry;};
      if(!doorIds.has(node.item.catalogId)&&!stairIds.has(node.item.catalogId)){
        const outside=geometryArea(clipping.difference(polygon(node.points),floorShape));
        if(outside>1)append(issue(node,'floor-edge','floor',`${node.label} crosses the floor edge`,'Part of this footprint lies outside the actual floor shape or across a stair opening.',[],{outsideAreaMm2:outside}));
      }
      const raw=[...nextIndex.query(node.indexBounds).filter(n=>n.id!==id),...wallIndex.query(node.indexBounds)];
      const targets=raw.sort((a,b)=>Math.hypot((a.bounds.left+a.bounds.right)/2-node.item.x,(a.bounds.top+a.bounds.bottom)/2-node.item.z)-Math.hypot((b.bounds.left+b.bounds.right)/2-node.item.x,(b.bounds.top+b.bounds.bottom)/2-node.item.z)).slice(0,MAX_NEIGHBORS);
      if(raw.length>MAX_NEIGHBORS)limitedOwners.add(id);
      for(const target of targets){
        if(found.length>=10){limitedOwners.add(id);break;}
        if(target.bottom>=node.top-1||node.bottom>=target.top-1||target.item?.hostDoorId===id||node.item.hostDoorId===target.id)continue;
        if(!doorIds.has(node.item.catalogId)&&!target.item?.doorless&&!(target.item&&doorIds.has(target.item.catalogId))&&(target.wall||id<target.id)){
          const gap=footprintGap(node.points,target.points);
          if(gap.distance<.01&&areaInside(node.points,target.points)>1)append(issue(node,'overlap',target.id,`${node.label} overlaps ${target.label}`,'Modeled footprints overlap at the same height.',[target],{measuredMm:0},undefined,gap));
          else if(s.checkGaps&&gap.distance>=20&&gap.distance<s.passageMm)append(issue(node,'gap',target.id,`Gap beside ${node.label}`,`The nearest gap to ${target.label} is below your passage preference. This is a candidate gap, not a confirmed walking route.`,[target],{measuredMm:gap.distance,requiredMm:s.passageMm},undefined,gap));
        }
        for(const envelope of node.envelopes){
          if(found.length>=10)break;
          // The door's host wall is intentionally crossed at its hinge/closed leaf plane.
          if(envelope.kind==='door-swing'&&target.wall&&target.points.every(p=>Math.abs(local(node.item,p).z)<101))continue;
          const cut=clipping.intersection(polygon(envelope.points),polygon(target.points));if(geometryArea(cut)<=1)continue;
          const points=cut.flatMap(rings=>rings.flatMap(r=>r.map(([x,z])=>({x,z}))));
          let measured:number;
          if(envelope.kind==='door-swing')measured=Math.min(...cut.flatMap(rings=>rings.flatMap(ring=>edges(ring.map(([x,z])=>({x,z}))).map(edge=>{const p=projectPoint(envelope.origin,edge.a,edge.b);return Math.hypot(p.x-envelope.origin.x,p.z-envelope.origin.z);}))));
          else {const start=local(node.item,envelope.origin).z;measured=Math.max(0,Math.min(...points.map(p=>(local(node.item,p).z-start)*envelope.direction)));}
          const label=envelope.kind==='door-swing'?'Door swing':envelope.kind==='chair-pullout'?'Chair pull-out':'Drawer opening';
          append(issue(node,envelope.kind,target.id,`${label} blocked by ${target.label}`,`${node.label}: ${envelope.note}${envelope.kind==='door-swing'?' Measured distance is from the hinge to the nearest blocked part.':' Measured distance is the available reach before the obstacle.'}`,[target],{measuredMm:measured,requiredMm:envelope.required},envelope.points));
        }
      }
      for(const envelope of node.envelopes){
        const outside=geometryArea(clipping.difference(polygon(envelope.points),floorShape));
        if(outside>1)append(issue(node,envelope.kind,'floor',`${node.label}: access area crosses the floor edge`,`${envelope.note} Part of the proposed access area is outside the floor or over a stair opening.`,[],{outsideAreaMm2:outside,requiredMm:envelope.required},envelope.points));
      }
      rows.set(id,found);
    }
    nodes=next;index=nextIndex;settingsKey=key;previousFloor=floorId;
    const allIssues=[...rows.values()].flat().sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
    const issues=allIssues.slice(0,MAX_ISSUES);if(allIssues.length>MAX_ISSUES||limitedOwners.size)limited=true;
    const notices=['Distances use modeled footprints and heights, not product mesh contours. Passage widths are your preferences, not code checks or a moving-route assessment.'];
    if(s.checkDoors||s.checkDrawers)notices.push('Opening checks cover only listed metadata-supported pieces. Sliding/folding doors, window blinds and unlisted drawer mechanisms are not assessed.');
    const unknown=floorItems.filter(p=>!definitions.has(p.catalogId)).length;
    if(unknown)notices.push(`${unknown} pieces have unavailable catalog metadata and could not be assessed.`);
    if(limited)notices.push(`Review is bounded to ${MAX_ITEMS} solid pieces, ${MAX_NEIGHBORS} nearby obstacles per piece and ${MAX_ISSUES} listed issues. Simplify or review a smaller floor for complete coverage.`);
    if(skippedVegetation)notices.push(`${skippedVegetation} outdoor vegetation placements were skipped to keep review responsive.`);
    return{floorId,issues,overlays:issues.flatMap(i=>i.overlays),notices,stats:{checked:next.size,recomputed:[...affected].filter(id=>next.has(id)).length,recomputedIds:[...affected].filter(id=>next.has(id)),skippedVegetation,limited}};
  }};
}
