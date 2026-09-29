import {catalog} from './catalog';
import {buildDesign,footprint,operationSchema,overlap,type DesignOperation} from './agentDesign';
import {array,validateInput} from './agentSchema';
import {assertLockedFurnitureUnchanged} from './furnitureGroups';
import {cozyStarterKits,kitBounds,kitFloorFit,replaceKitPiece,roomRecipeDetails,type FurnitureKit} from './furnitureKits';
import {floorRects} from './floorGeometry';
import {geometryKey,roomGroups} from './blueprint';
import {polygonBounds,shapeCovered} from './polygonGeometry';
import {defaultSpecification} from './selectionSchedule';
import {validatePlan} from './planValidation';
import type {KitPreviewRequest} from './FurnitureKitsPanel';
import type {PlanDocumentV1} from './types';

export const assistantGoals=['reading','work','hobby','guests','dining','living'] as const;
export const assistantStyles=['natural','soft','moody'] as const;
export interface DesignBrief {version:1;floorId:string;roomKey?:string;goal:typeof assistantGoals[number];style:typeof assistantStyles[number];householdSize:number;clearanceMm:number;maxPieceWidthMm?:number;maxPieceDepthMm?:number;keepItemIds:string[];budget?:{currency:string;amountMinor:number};manualPrices:Array<{catalogId:string;currency:string;amountMinor:number}>}
export interface AssistantProposal {id:string;title:string;brief:DesignBrief;operations:DesignOperation[];reasons:string[];unmet:string[];cost:{knownMinor:number;unknownCount:number;currency:string|null;overBudget:boolean};preview:KitPreviewRequest}
const definitions=new Map(catalog.map(c=>[c.id,c]));
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=160&&!/[\u0000-\u001f\u007f]/.test(v);
function fail():never{throw new Error('Check the room, needs, dimensions and optional budget in your brief.');}
export function parseDesignBrief(v:unknown,plan:PlanDocumentV1):DesignBrief {
 if(!obj(v)||Object.keys(v).some(k=>!['version','floorId','roomKey','goal','style','householdSize','clearanceMm','maxPieceWidthMm','maxPieceDepthMm','keepItemIds','budget','manualPrices'].includes(k))||v.version!==1||!plan.floors.some(f=>f.id===v.floorId)||!assistantGoals.includes(v.goal)||!assistantStyles.includes(v.style)||!Number.isInteger(v.householdSize)||v.householdSize<1||v.householdSize>8||!Number.isInteger(v.clearanceMm)||v.clearanceMm<0||v.clearanceMm>1200)fail();
 if(v.roomKey!==undefined&&(!text(v.roomKey)||!assistantRooms(plan,v.floorId).some(r=>r.key===v.roomKey)))fail();
 for(const key of ['maxPieceWidthMm','maxPieceDepthMm'])if(v[key]!==undefined&&(!Number.isInteger(v[key])||v[key]<100||v[key]>10000))fail();
 if(!Array.isArray(v.keepItemIds)||v.keepItemIds.length>2000||new Set(v.keepItemIds).size!==v.keepItemIds.length||v.keepItemIds.some((id:unknown)=>!plan.furniture.some(p=>p.id===id&&p.floorId===v.floorId)))fail();
 const price=(p:any,keys:string[])=>{if(!obj(p)||Object.keys(p).some(k=>!keys.includes(k))||!Number.isSafeInteger(p.amountMinor)||p.amountMinor<0||p.amountMinor>100_000_000||typeof p.currency!=='string'||!/^[A-Z]{3}$/.test(p.currency))fail();};
 if(v.budget!==undefined)price(v.budget,['currency','amountMinor']);
 if(!Array.isArray(v.manualPrices)||v.manualPrices.length>24)fail();const ids=new Set<string>();for(const p of v.manualPrices){price(p,['catalogId','currency','amountMinor']);if(!definitions.has(p.catalogId)||ids.has(p.catalogId))fail();ids.add(p.catalogId);}
 return structuredClone(v) as DesignBrief;
}
export function assistantRooms(plan:PlanDocumentV1,floorId:string){const floor=plan.floors.find(f=>f.id===floorId);if(!floor||!floor.blueprint||floor.blueprint.geometryKey!==geometryKey(floor))return [];return roomGroups(floor.blueprint.rooms).map(r=>({key:r.groupId??r.id,name:r.name,kind:r.kind,parts:r.parts}));}
function recipes(goal:DesignBrief['goal']):FurnitureKit[]{
 const starterId={reading:'starter-reading',work:'starter-office',hobby:'starter-hobby',guests:'starter-guest',dining:'starter-dining',living:'starter-first-apartment'}[goal];let base=structuredClone(cozyStarterKits.find(k=>k.id===starterId)!);if(goal==='guests')base=replaceKitPiece(base,1,'cane-nightstand');
 const substitutions:Record<DesignBrief['goal'],Array<Array<[number,string]>>>= {reading:[[[0,'solarium-rocker'],[1,'tray-side-table']],[[0,'loveseat'],[1,'c-side-table']]],work:[[[0,'standing-desk'],[1,'ergonomic-office-chair']],[[0,'desk'],[2,'laptop']]],hobby:[[[0,'desk'],[1,'office-chair']],[[0,'standing-desk'],[4,'cabinet']]],guests:[[[0,'daybed'],[1,'cane-nightstand']],[[0,'queen-bed'],[3,'dresser']]],dining:[[[0,'round-table'],[1,'dining-chair'],[2,'dining-chair']],[[0,'dining-table'],[1,'breakfast-chair'],[2,'breakfast-chair']]],living:[[[0,'midcentury-sofa'],[1,'oval-coffee-table']],[[0,'boneless-loveseat'],[1,'drum-coffee-table']]]};
 return [base,...substitutions[goal].map((changes,i)=>{let kit=structuredClone(base);for(const [index,id]of changes)if(definitions.has(id))kit=replaceKitPiece(kit,index,id);return {...kit,name:i===0?'Alternative construction':'Another way to use the room'};})].map(kit=>{if(goal==='guests'){const [bed,bedside,lamp,storage]=kit.pieces;bedside.x=bed.widthMm/2+bedside.widthMm/2+200;bedside.z=-Math.max(0,bed.depthMm/2-bedside.depthMm/2-120);lamp.x=bedside.x;lamp.z=bedside.z;storage.x=-bed.widthMm/2-storage.widthMm/2-600;}return kit;});
}
function scopeParts(plan:PlanDocumentV1,brief:DesignBrief){return brief.roomKey?assistantRooms(plan,brief.floorId).find(r=>r.key===brief.roomKey)!.parts:floorRects(plan.floors.find(f=>f.id===brief.floorId)!,plan.gridSizeMm);}
function hasScopeFit(plan:PlanDocumentV1,brief:DesignBrief,added:PlanDocumentV1['furniture']){const parts=scopeParts(plan,brief);return added.every(item=>{const corners=footprint(item);return shapeCovered(polygonBounds([corners[0],corners[1],corners[3],corners[2]]),parts);});}
/** Only additive, dimension-preserving furniture operations are allowed through this narrower boundary. */
export function buildAssistantProposal(base:PlanDocumentV1,briefInput:unknown,operationsInput:unknown,title:string):AssistantProposal {
 validatePlan(base);const brief=parseDesignBrief(briefInput,base);validateInput(operationsInput,array(operationSchema,12));const operations=structuredClone(operationsInput) as DesignOperation[];
 for(const op of operations){if(op.action!=='place'||op.floorId!==brief.floorId)throw new Error('The design assistant may only add furniture to the selected floor.');const def=definitions.get(op.catalogId);if(!def||['Doors','Windows','Stairs','Kitchen','Bathroom','Outdoor'].includes(def.category)||def.mount==='wall'||def.mount==='ceiling')throw new Error('Use the manual editor for fixed fixtures or architectural pieces.');for(const key of ['widthMm','depthMm','heightMm'] as const)if(op[key]!==undefined&&op[key]!==def[key])throw new Error('Assistant additions keep the catalog’s exact dimensions.');if(def.widthMm>(brief.maxPieceWidthMm??Infinity)||def.depthMm>(brief.maxPieceDepthMm??Infinity))throw new Error('A piece exceeds your requested size limit.');}
 const result=buildDesign(base,operations),added=result.plan.furniture.filter(p=>result.changedIds.includes(p.id));assertLockedFurnitureUnchanged(base,result.plan);
 if(JSON.stringify(result.plan.floors)!==JSON.stringify(base.floors)||base.furniture.some(p=>JSON.stringify(result.plan.furniture.find(q=>q.id===p.id))!==JSON.stringify(p)))throw new Error('A proposal changed protected geometry or existing furniture.');
 if(!hasScopeFit(base,brief,added))throw new Error('A complete furniture footprint falls outside the chosen measured room.');
 const localKit: FurnitureKit={version:1,id:'assistant-fit',name:'Fit',createdAt:'2026-09-29',updatedAt:'2026-09-29',pieces:added.map(({id:_id,floorId:_floor,...p})=>p)};
 if(!kitFloorFit(base,brief.floorId,localKit,{x:0,z:0,rotation:0}).fits)throw new Error('A piece crosses a floor edge or opening.');
 for(const item of added){if(definitions.get(item.catalogId)?.shape==='rug')continue;const expanded={...item,widthMm:item.widthMm+brief.clearanceMm*2,depthMm:item.depthMm+brief.clearanceMm*2};for(const previous of base.furniture){if(previous.floorId===brief.floorId&&definitions.get(previous.catalogId)?.shape!=='rug'&&overlap(expanded,previous))throw new Error('This arrangement does not leave the requested gap from existing furniture.');}}
 const warnings=result.warnings.filter(w=>w.ids.some(id=>result.changedIds.includes(id)));if(warnings.some(w=>w.kind==='overlap'))throw new Error('New furniture overlaps; remove or reposition a piece before previewing.');
 const currency=brief.budget?.currency??brief.manualPrices[0]?.currency??null;let knownMinor=0,unknownCount=0;
 const priced=result.plan.furniture.map(p=>{if(!result.changedIds.includes(p.id))return p;const quote=brief.manualPrices.find(q=>q.catalogId===p.catalogId&&q.currency===currency);if(!quote){unknownCount++;return p;}knownMinor+=quote.amountMinor;return {...p,specification:{...defaultSpecification(),unitPriceMinor:quote.amountMinor,currency:quote.currency,checkedOn:new Date().toISOString().slice(0,10)}};});
 const seats=added.filter(p=>definitions.get(p.catalogId)?.shape==='seat').reduce((n,p)=>n+(/sofa|loveseat|sectional/.test(p.catalogId)?2:1),0),unmet:string[]=[];
 if(unknownCount)unmet.push(`${unknownCount} new item prices are unknown. A budget fit cannot be confirmed.`);if(brief.budget&&knownMinor>brief.budget.amountMinor)unmet.push('The manually priced additions already exceed your budget.');
 if(['reading','living','dining'].includes(brief.goal)&&seats<brief.householdSize)unmet.push(`This choice provides about ${seats} seats for ${brief.householdSize} people; add or choose more seating.`);
 if(brief.goal==='guests'&&brief.householdSize>1)unmet.push('Sleeping capacity and mattress sizes need manual confirmation.');
 unmet.push('Door swings, walking routes, drawer access and building rules still need a visual check.');
 const plan={...base,furniture:priced};validatePlan(plan);
 return {id:crypto.randomUUID(),title,brief,operations,reasons:[`Uses ${added.length} independent catalog pieces at their authored dimensions.`,`${brief.clearanceMm} mm bounding gap from existing furniture; complete footprints fit the measured floor and chosen room.`,`All ${base.furniture.length} existing pieces, locks, personal belongings and architecture stay unchanged.`,`The ${brief.style} palette is a local styling recipe, with no model call.`],unmet,cost:{knownMinor,unknownCount,currency,overBudget:!!brief.budget&&knownMinor>brief.budget.amountMinor},preview:{base,plan,floorId:brief.floorId,label:title,addedIds:result.changedIds as KitPreviewRequest['addedIds'],changedIds:result.changedIds,warnings}};
}
export function suggestDesigns(plan:PlanDocumentV1,input:unknown):{proposals:AssistantProposal[];conflicts:string[]} {
 const brief=parseDesignBrief(input,plan),parts=scopeParts(plan,brief);if(plan.furniture.length>500)return {proposals:[],conflicts:['This home is too large for a quick local recipe search. Use the manual catalog and arrangements tools for this scene.']};if(!parts.length)return {proposals:[],conflicts:['Draw a measured floor or choose an available room first.']};
 const bounds=parts.reduce((a,r)=>({left:Math.min(a.left,r.x),top:Math.min(a.top,r.z),right:Math.max(a.right,r.x+r.width),bottom:Math.max(a.bottom,r.z+r.depth)}),{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}),proposals:AssistantProposal[]=[],conflicts:string[]=[];
 const palette={natural:['sage','oat','cream'],soft:['clay','cream','oat'],moody:['slate','charcoal','oat']}[brief.style];
 for(const [choice,kit]of recipes(brief.goal).entries()){
  let found:AssistantProposal|undefined,lastError='No clear placement found.';
  for(const rotation of [0,90,180,270]){if(found)break;const extent=kitBounds(kit,rotation);for(const [fx,fz]of [[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const x=bounds.left+(bounds.right-bounds.left)*fx-(extent.left+extent.right)/2,z=bounds.top+(bounds.bottom-bounds.top)*fz-(extent.top+extent.bottom)/2,a=rotation*Math.PI/180;
   const supports=roomRecipeDetails[kit.id]?.supports??[];const operations=kit.pieces.map((piece,i):DesignOperation=>({action:'place',catalogId:piece.catalogId,floorId:brief.floorId,key:'piece-'+i,x:Math.round(x+piece.x*Math.cos(a)+piece.z*Math.sin(a)),z:Math.round(z-piece.x*Math.sin(a)+piece.z*Math.cos(a)),rotation:(piece.rotation+rotation)%360,variant:palette[i%palette.length],...(piece.elevationMm===undefined?{}:{elevationMm:piece.elevationMm}),...(supports.find(([child])=>child===i)?{supportId:'piece-'+supports.find(([child])=>child===i)![1]}:{})}));
   try{found=buildAssistantProposal(plan,brief,operations,choice===0?kit.name:kit.name+' · '+definitions.get(kit.pieces[0].catalogId)!.name);break;}catch(e){lastError=(e as Error).message;}
  }}if(found)proposals.push(found);else conflicts.push(`${kit.name}: ${lastError}`);
 }
 return {proposals,conflicts};
}
