import {QuantitySurface,CoverageRate,SurfaceTakeoffSettings,TakeoffPlan,SurfaceQuantityRow,SurfaceQuantityReport,defaultTakeoffSettings,parseSurfaceTakeoffSettings} from './surfaceSettings';
export * from './surfaceSettings';
import {measurementEvidenceSummary} from './siteSurvey';
import {geometryParts,unionShapes} from './polygonGeometry';
import {findFloorFinish,findWallFinish} from './surfaces';
import {areaM2,floorQuantityGeometry,intersectShapes,pointInShape,pointOnPlate,subtractShapes,wallFaceRegions,type FloorQuantityGeometry,type QuantityWallPlate} from './surfaceGeometry';
import type {FloorRect} from './floorGeometry';
import type {PlanDocumentV1} from './types';

export function updateSurfaceTakeoffSettings(base:TakeoffPlan,current:TakeoffPlan,value:unknown,validate:(plan:unknown)=>void):TakeoffPlan {
  if(base!==current)throw new Error('The project changed. Reopen the surface assumptions before saving.');
  const next={...base,surfaceTakeoffSettings:parseSurfaceTakeoffSettings(value)};validate(next);if(new TextEncoder().encode(JSON.stringify(next)).length>8_000_000)throw new Error('This project exceeds the 8 MB save limit.');return next;
}
const revisions=new Map<PlanDocumentV1,string>();
const fingerprint=(input:string)=>{let hash=2166136261;for(let i=0;i<input.length;i++)hash=Math.imul(hash^input.charCodeAt(i),16777619);return `${input.length}-${(hash>>>0).toString(16)}`;};
/** A reproducible local geometry/assumptions fingerprint, not a server revision or signature. */
export function surfaceRevision(plan:PlanDocumentV1,settings:SurfaceTakeoffSettings):string {
  let model=revisions.get(plan);if(!model){model=fingerprint(JSON.stringify([plan.id,plan.gridSizeMm,plan.floors,plan.furniture.map(p=>[p.id,p.catalogId,p.floorId,p.x,p.z,p.rotation,p.widthMm,p.depthMm,p.heightMm,p.elevationMm,p.toFloorId]) ]));revisions.set(plan,model);if(revisions.size>4)revisions.delete(revisions.keys().next().value!);}
  return `${plan.updatedAt} / model ${model} / assumptions ${fingerprint(JSON.stringify(settings))}`;
}
export function rateFor(settings:SurfaceTakeoffSettings,surface:QuantitySurface,finishId:string):CoverageRate {return settings.finishRates.find(r=>r.surface===surface&&r.finishId===finishId)??settings.rates[surface];}
export function purchasingQuantity(netM2:number|null,rate:CoverageRate){if(netM2===null)return {requiredM2:null,purchaseUnits:null};const requiredM2=netM2*(1+rate.wastePercent/100)*rate.coats;return {requiredM2,purchaseUnits:rate.coverageM2PerUnit===null?null:Math.ceil(requiredM2/rate.coverageM2PerUnit-1e-10)};}
/** Model apertures plus explicitly measured legacy markers. Unknown legacy heights never become zero. */
export function remainingWallSurface(geometry:FloorQuantityGeometry,plate:QuantityWallPlate,settings:SurfaceTakeoffSettings):{pieces:FloorRect[];warnings:string[];unavailable:boolean;legacy:Array<{x:number;bottom:number;width:number;height:number;label:string}>}{
  const warnings=[...plate.warnings],legacy:Array<{x:number;bottom:number;width:number;height:number;label:string}>=[];
  if(plate.heightMm===null)return {pieces:[],warnings,unavailable:true,legacy};
  let shape=unionShapes(settings.deductOpenings?plate.remaining:[{x:0,z:0,width:plate.lengthMm,depth:plate.heightMm}]),unavailable=false;
  if(geometry.unmatchedLegacyOpening){warnings.push('An older opening marker no longer has a current host wall. Resolve the marker before relying on deductions.');unavailable=settings.deductOpenings;}
  for(const opening of geometry.floor.openings){
    const part=plate.parts.find(p=>p.wall.id===opening.wallKey||`${p.wall.ax}:${p.wall.az}:${p.wall.bx}:${p.wall.bz}`===opening.wallKey);if(!part)continue;
    const measured=settings.legacyOpenings.find(o=>o.floorId===geometry.floor.id&&o.openingId===opening.id);
    if(!measured?.heightMm){if(settings.deductOpenings){unavailable=true;warnings.push('A legacy door/window marker has no measured opening height. Supply it or choose gross areas.');}continue;}
    const w=part.wall,scale=geometry.gridSizeMm;
    const a=(plate.ux*w.ax+plate.uz*w.az)*scale,b=(plate.ux*w.bx+plate.uz*w.bz)*scale;
    // The source marker offset is relative to its original host segment, not the merged plate.
    const center=(a+(b-a)*opening.offset)-plate.start,left=center-opening.widthMm/2;
    const cut={x:left,z:measured.sillMm,width:opening.widthMm,depth:measured.heightMm};legacy.push({x:left,bottom:measured.sillMm,width:opening.widthMm,height:measured.heightMm,label:`Measured legacy ${opening.kind}`});
    if(left<-.01||left+opening.widthMm>plate.lengthMm+.01||measured.sillMm+measured.heightMm>plate.heightMm+.01)warnings.push('A measured legacy opening extends past this wall and is clipped to the wall surface.');
    if(settings.deductOpenings)shape=subtractShapes(shape,unionShapes([cut]));
  }
  return {pieces:geometryParts(shape),warnings:[...new Set(warnings)],unavailable,legacy};
}
function materialSpans(geometry:FloorQuantityGeometry,plate:QuantityWallPlate,grid:number){
  const spans:Array<{start:number;end:number;finishId:string;warning?:string}>=[];
  for(const part of plate.parts){const diagonal=Math.abs(plate.ux)>.000001&&Math.abs(plate.uz)>.000001,origin=diagonal?(part.wall.ax*plate.ux+part.wall.az*plate.uz)*grid:0,points=[part.start,part.end];
    for(let v=Math.ceil((plate.start+part.start-origin)/grid)*grid+origin;v<plate.start+part.end-.001;v+=grid)if(v>plate.start+part.start+.001)points.push(v-plate.start);
    points.sort((a,b)=>a-b);for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],along=diagonal?Math.abs(plate.start+(start+end)/2-origin):plate.start+(start+end)/2,key=`${part.wall.id}|${Math.floor((along+.001)/grid)}`;spans.push({start,end,finishId:geometry.floor.wallFinishes?.[key]??part.finishId,warning:part.warning});}
  }return spans;
}
const reportCache=new Map<TakeoffPlan,Map<string,SurfaceQuantityReport>>();
/** Up to four immutable plans and four geometry-assumption variants each; rate edits only remap rows. */
export function evaluateSurfaceQuantities(plan:TakeoffPlan,input:SurfaceTakeoffSettings=plan.surfaceTakeoffSettings??defaultTakeoffSettings()):SurfaceQuantityReport {
  const settings=parseSurfaceTakeoffSettings(input),key=JSON.stringify([settings.wallFaces,settings.deductOpenings,settings.ceiling,settings.legacyOpenings]);
  let cache=reportCache.get(plan);if(!cache){cache=new Map();reportCache.set(plan,cache);if(reportCache.size>4)reportCache.delete(reportCache.keys().next().value!);}
  let measured=cache.get(key);if(!measured){measured=evaluateGeometryQuantities(plan,settings);cache.set(key,measured);if(cache.size>4)cache.delete(cache.keys().next().value!);}
  const evidence=measurementEvidenceSummary(plan),evidenceWarnings=evidence.changed||evidence.discrepancy?[`${evidence.changed} site record(s) refer to changed geometry; ${evidence.discrepancy} record(s) disagree with the model. Recheck affected measurements before ordering. Checking one item does not verify every surface.`]:[];
  return {...measured,settings,revision:surfaceRevision(plan,settings),warnings:[...measured.warnings,...evidenceWarnings],rows:measured.rows.map(row=>{const rate=rateFor(settings,row.surface,row.finishId);return {...row,rate:{...rate},warnings:[...row.warnings],...purchasingQuantity(row.netM2,rate)};})};
}
function evaluateGeometryQuantities(plan:TakeoffPlan,input:SurfaceTakeoffSettings):SurfaceQuantityReport {
  const settings=parseSurfaceTakeoffSettings(input),rows:SurfaceQuantityRow[]=[],warnings:string[]=[];
  const accumulate=new Map<string,SurfaceQuantityRow>();
  const add=(floorId:string,floorName:string,roomKey:string,roomName:string,surface:QuantitySurface,finishId:string,grossM2:number|null,netM2:number|null,notes:string[]=[])=>{
    const key=JSON.stringify([floorId,roomKey,surface,finishId]),rate=rateFor(settings,surface,finishId),existing=accumulate.get(key);
    if(existing){existing.grossM2=existing.grossM2===null||grossM2===null?null:existing.grossM2+grossM2;existing.netM2=existing.netM2===null||netM2===null?null:existing.netM2+netM2;existing.deductionM2=existing.grossM2===null||existing.netM2===null?null:Math.max(0,existing.grossM2-existing.netM2);existing.warnings=[...new Set([...existing.warnings,...notes])];Object.assign(existing,purchasingQuantity(existing.netM2,rate));return;}
    const finishName=surface==='ceiling'?'Ceiling assumption':finishId==='unknown-wall-finish'?'Unresolved wall finish':surface==='floor'?findFloorFinish(finishId).name:findWallFinish(finishId).name;
    const row={floorId,floorName,roomKey,roomName,surface,finishId,finishName,grossM2,netM2,deductionM2:grossM2===null||netM2===null?null:Math.max(0,grossM2-netM2),rate,...purchasingQuantity(netM2,rate),warnings:[...new Set(notes)]};accumulate.set(key,row);rows.push(row);
  };
  for(const floor of plan.floors){
    let geometry:FloorQuantityGeometry;try{geometry=floorQuantityGeometry(plan,floor.id);}catch(error){for(const surface of ['floor','wall','ceiling'] as const)add(floor.id,floor.name,'unavailable','Unavailable',surface,'unknown',null,null,[(error as Error).message]);warnings.push(`${floor.name}: ${(error as Error).message}`);continue;}
    for(const region of geometry.regions){
      for(const finish of geometry.finishes){const gross=areaM2(intersectShapes(finish.original,region.shape)),net=areaM2(intersectShapes(finish.visible,region.shape));if(gross>.0000001)add(floor.id,floor.name,region.key,region.name,'floor',finish.finishId,gross,net,region.warning?[region.warning]:[]);}
      const ceiling=areaM2(intersectShapes(geometry.visible,region.shape));add(floor.id,floor.name,region.key,region.name,'ceiling','ceiling',settings.ceiling==='floor-projection'?ceiling:null,settings.ceiling==='floor-projection'?ceiling:null,[settings.ceiling==='not-included'?'Ceiling area is unavailable until the flat floor-projection assumption is selected.':'Assumed flat ceiling follows this visible floor outline, including its voids. Verify open-air rooms, stair voids, slopes and soffits separately.',...(region.warning?[region.warning]:[])]);
    }
    for(const plate of geometry.plates){
      if(settings.wallFaces==='exterior'&&!plate.boundary)continue;
      const sides:Array<1|-1>=[1,-1];
      const remaining=remainingWallSurface(geometry,plate,settings),shape=unionShapes(remaining.pieces),materials=materialSpans(geometry,plate,plan.gridSizeMm);
      for(const side of sides)for(const face of wallFaceRegions(geometry,plate,side))for(const material of materials){const start=Math.max(face.start,material.start),end=Math.min(face.end,material.end);if(end-start<=.001)continue;
        const sample=pointOnPlate(plate,(start+end)/2,side*.1),opposite=pointOnPlate(plate,(start+end)/2,-side*.1),inside=pointInShape(sample.x,sample.z,geometry.original),otherInside=pointInShape(opposite.x,opposite.z,geometry.original),uncertain=plate.boundary&&inside===otherInside;
        if(plate.boundary&&settings.wallFaces!=='both'&&(uncertain?side!==(settings.wallFaces==='room-side'?1:-1):settings.wallFaces==='room-side'?!inside:inside))continue;
        const gross=plate.heightMm===null?null:(end-start)*plate.heightMm/1e6,net=remaining.unavailable||plate.heightMm===null?null:areaM2(intersectShapes(shape,unionShapes([{x:start,z:0,width:end-start,depth:plate.heightMm}])));
        add(floor.id,floor.name,uncertain?'unassigned':face.region.key,uncertain?'Unassigned face':face.region.key==='exterior'?'Outside footprint (verify)':face.region.name,'wall',material.finishId,gross,uncertain?null:net,[...remaining.warnings,...(uncertain?['The room-facing side cannot be established reliably here; this face quantity is unavailable.']:[]),...(face.region.warning?[face.region.warning]:[]),...(material.warning?[material.warning]:[]),...(face.region.key==='exterior'?['This face may overlook the exterior, a courtyard or a floor void; that distinction is not inferred.']:[])]);
      }
    }
  }
  if(rows.some(row=>row.surface==='wall'))warnings.push('Wall areas are vertical model faces, excluding reveals, wall tops, trim, baseboards and cabinet coverage. Verify model heights on site.');
  return {projectName:plan.name,revision:surfaceRevision(plan,settings),settings,rows,warnings};
}
