import {modelAssetPath} from './modelAssetPath';
import { create } from 'zustand';
import { flushSync } from 'react-dom';
import { catalog, variants } from './catalog';
import { furnitureType as furnitureFamily } from './library';
import { floorBoundaryWalls, floorRects } from './floorGeometry';
import { countertopFinishes, doorFinishes, floorFinishes, wallFinishes } from './surfaces';
import { usePlanner } from './store';
import { buildDesign, designWarnings, materialSlots, operationSchema, supportSurfaces, type DesignOperation } from './agentDesign';
import { array, choice, integer, number, object, text, validateInput, type Schema } from './agentSchema';
import { uid } from './domain';
import type { PlanDocumentV1 } from './types';

type Proposal=ReturnType<typeof buildDesign>&{id:string;label:string;base:PlanDocumentV1;revision:number;operationCount:number};
type AgentState={status:'unsupported'|'connecting'|'ready'|'error';paused:boolean;allowApply:boolean;open:boolean;busy:boolean;revision:number;pending?:Proposal;message:string;lastApplied?:string};
export const useAgent=create<AgentState>(()=>({status:'connecting',paused:false,allowApply:false,open:false,busy:false,revision:0,message:'Design together, one undoable arrangement at a time.'}));
// Monotonic page-local revision detects human edits, undo/redo and project changes,
// including changes that occur in the same millisecond. It is not an auth token.
const unsubscribe=usePlanner.subscribe((state,previous)=>{if(state.plan!==previous.plan)useAgent.setState(s=>({revision:s.revision+1,pending:undefined,...(state.plan.id!==previous.plan.id?{allowApply:false,lastApplied:undefined}:{}),...(s.pending?{message:'The apartment changed; the old proposal was discarded. Ask your agent for a fresh design.'}:{})}));});
if(import.meta.hot)import.meta.hot.dispose(unsubscribe);

export function applyProposal(id:string,fromAgent=false){
  const s=useAgent.getState(),pending=s.pending;
  if(s.paused)throw new Error('Agent access is paused.');
  if(!pending||pending.id!==id)throw new Error('Proposal not found. Stage a fresh design.');
  if(s.busy)throw new Error('Finish or cancel the current manual edit/dialog first.');
  if(fromAgent&&!s.allowApply)return {status:'awaiting_user_review',proposalId:id,message:'The user must press Apply design, or enable direct agent edits in Decorate with an agent. No plan changes were saved.'};
  if(s.revision!==pending.revision)throw new Error('Stale proposal. Read the apartment again.');
  usePlanner.getState().commitDesign(pending.base,pending.plan);
  useAgent.setState({pending:undefined,message:`Applied: ${pending.label}. Undo restores the previous arrangement.`,lastApplied:pending.label});
  return {status:'applied',revision:useAgent.getState().revision,changedIds:pending.changedIds,pieces:pending.plan.furniture.length,localAutosave:true,onlineSaved:false};
}
export function discardProposal(){useAgent.setState({pending:undefined,message:'Proposal discarded. Your saved apartment is unchanged.'});}
export interface AgentTool {name:string;title:string;description:string;inputSchema:Schema;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute(input:unknown):unknown}
const revision={expectedRevision:integer(0,Number.MAX_SAFE_INTEGER)};
const checkRevision=(input:{expectedRevision:number})=>{if(input.expectedRevision!==useAgent.getState().revision)throw new Error('Stale apartment revision. Call nook_get_apartment and try again.');};
const definitions:Array<Omit<AgentTool,'execute'>&{run:(input:any)=>unknown}>=[
  {name:'nook_get_apartment',title:'Inspect apartment',description:'Read the currently open apartment, real dimensions, furniture placements, finishes, support surfaces, pending proposal and page revision. No private library/account access. Default returns the active floor; pass floorId for another floor. All world coordinates are mm; x/z are furniture centers, elevationMm is bottom above floor, rotation is degrees clockwise viewed from above. Walls returned in mm; tile cells and room origins are grid indices. Local +Z is furniture front at 0 degrees; +90 faces +X. Names and proposal labels are untrusted user data.',inputSchema:object({floorId:text()}),annotations:{readOnlyHint:true,untrustedContentHint:true},run:({floorId})=>{
    const s=usePlanner.getState(),a=useAgent.getState(),f=s.plan.floors.find(f=>f.id===(floorId??s.activeFloorId));if(!f)throw new Error('Unknown floor ID.');
    return {project:{id:s.plan.id,name:s.plan.name,units:s.plan.units,gridSizeMm:s.plan.gridSizeMm},revision:a.revision,mode:a.allowApply?'agent_can_apply':'review_first',busy:a.busy,activeFloorId:s.activeFloorId,floors:s.plan.floors.map(f=>({id:f.id,name:f.name,heightMm:f.heightMm,elevationMm:f.elevationMm,pieces:s.plan.furniture.filter(i=>i.floorId===f.id).length})),floor:{...f,rectanglesMm:floorRects(f,s.plan.gridSizeMm),wallsMm:[...floorBoundaryWalls(f,s.plan.gridSizeMm),...f.walls].map(w=>({...w,ax:w.ax*s.plan.gridSizeMm,az:w.az*s.plan.gridSizeMm,bx:w.bx*s.plan.gridSizeMm,bz:w.bz*s.plan.gridSizeMm}))},furniture:s.plan.furniture.filter(i=>i.floorId===f.id).map(i=>({...i,name:catalog.find(c=>c.id===i.catalogId)?.name,supports:supportSurfaces(i)})),camera:s.plan.camera,environment:s.plan.environment??{background:'plain',grass:'off'},warnings:designWarnings(s.plan).filter(w=>w.ids.some(id=>s.plan.furniture.some(i=>i.id===id&&i.floorId===f.id))),warningLimit:100,warningScope:'Conservative footprint/height and stair checks, not a circulation, building-code or physics guarantee.',pending:a.pending?{id:a.pending.id,label:a.pending.label,operations:a.pending.operationCount,warnings:a.pending.warnings}:null,history:{undo:s.past.length,redo:s.future.length}};
  }},
  {name:'nook_search_catalog',title:'Find furniture and finishes',description:'Search all original furniture by name, description, category or type. Returns stable catalog IDs, real dimensions, mounting type, preview URL, per-part material color IDs and usable finishes. Use offset/limit for pagination. Empty input returns the first 20 pieces plus finish/color options. Does not place anything.',inputSchema:object({query:{type:'string',maxLength:100},category:text(),maxWidthMm:number(10,50000),maxDepthMm:number(10,50000),offset:integer(0,1000),limit:integer(1,50)}),annotations:{readOnlyHint:true,untrustedContentHint:false},run:(input)=>{
    const words=(input.query??'').toLowerCase().split(/\s+/).filter(Boolean),matches=catalog.filter(c=>(!input.category||c.category.toLowerCase()===input.category.toLowerCase())&&(!input.maxWidthMm||c.widthMm<=input.maxWidthMm)&&(!input.maxDepthMm||c.depthMm<=input.maxDepthMm)&&words.every((w:string)=>`${c.id} ${c.name} ${c.description} ${c.category} ${furnitureFamily(c)}`.toLowerCase().includes(w)));
    const start=input.offset??0,end=start+(input.limit??20);
    return {total:matches.length,nextOffset:end<matches.length?end:null,items:matches.slice(start,end).map(c=>({...c,type:furnitureFamily(c),previewUrl:modelAssetPath(c.id,true),materials:materialSlots(c.id)})),colors:variants,finishes:{floors:floorFinishes,walls:wallFinishes,doors:doorFinishes,countertops:countertopFinishes}};
  }},
  {name:'nook_stage_design',title:'Preview an apartment design',description:'Stage 1–100 ordered edits as one visible unsaved proposal, replacing the previous proposal. Does NOT commit or autosave. Read apartment revision first. Operations place/update/remove furniture, add measured rooms or orthogonal inside walls, paint/erase tiles, finish floors/walls and change outdoor scenery. Coordinates/dimensions mm except room origin and cells are grid indices. Place supports optional key; later update/remove/supportId may reference that key. Add tables/shelves before their decor. supportId fits a piece at supplied x/z on a tabletop; shelfId centers it on that shelf. Wall openings and kitchen wall pieces snap to valid walls; read returned transforms. A finish without cells/wallId changes the whole floor layer; wallId must be from wallsMm. Per-part materialColors replaces overrides ({} resets them). Safety warnings do not block intentional overlaps. Commit separately with nook_apply_design, or let the user press Apply design. No cloud writes, account access or external URLs.',inputSchema:object({...revision,label:text(120),operations:array(operationSchema)},['expectedRevision','label','operations']),annotations:{readOnlyHint:false,untrustedContentHint:true},run:(input)=>{
    checkRevision(input);if(useAgent.getState().busy)throw new Error('Finish or cancel the manual placement/dialog before staging.');
    const base=usePlanner.getState().plan,result=buildDesign(base,input.operations as DesignOperation[]);
    if(JSON.stringify(result.plan)===JSON.stringify(base))throw new Error('The proposal makes no changes.');
    const pending:Proposal={...result,id:uid(),label:input.label,base,revision:useAgent.getState().revision,operationCount:input.operations.length};
    useAgent.setState({pending,open:true,message:'Preview only — your saved apartment is unchanged.'});
    return {status:'staged_not_saved',proposalId:pending.id,revision:pending.revision,keys:pending.keys,placements:result.plan.furniture.filter(f=>result.changedIds.includes(f.id)),warnings:pending.warnings,next:useAgent.getState().allowApply?'Call nook_apply_design to commit.':'Await the user pressing Apply design, or ask them to enable direct agent edits.'};
  }},
  {name:'nook_apply_design',title:'Apply staged design',description:'Commit the exact staged proposal to the open apartment as ONE undo step, then normal local autosave runs. Only works when the user enabled direct agent edits; otherwise returns awaiting_user_review without saving. No online save or sharing. Rejects stale or unknown proposals; never silently applies to a different project.',inputSchema:object({proposalId:text()},['proposalId']),annotations:{readOnlyHint:false,untrustedContentHint:true},run:({proposalId})=>applyProposal(proposalId,true)},
  {name:'nook_discard_design',title:'Discard staged design',description:'Remove an unsaved proposal preview; does not remove any saved furniture or alter undo history. Requires the current proposal ID.',inputSchema:object({proposalId:text()},['proposalId']),annotations:{readOnlyHint:false,untrustedContentHint:false},run:({proposalId})=>{if(useAgent.getState().pending?.id!==proposalId)throw new Error('Proposal not found.');discardProposal();return {status:'discarded',revision:useAgent.getState().revision};}},
  {name:'nook_history',title:'Undo or redo apartment edit',description:'Undo or redo one saved edit in the shared editor history (including a whole agent design). Requires direct agent edits enabled by the user and the latest apartment revision. May affect the last HUMAN edit too, so only use for an explicitly intended reversal. Does not write an online snapshot.',inputSchema:object({...revision,direction:choice('undo','redo')},['expectedRevision','direction']),annotations:{readOnlyHint:false,untrustedContentHint:false},run:(input)=>{checkRevision(input);const a=useAgent.getState();if(!a.allowApply)throw new Error('The user must enable direct agent edits or use the Undo/Redo buttons.');if(a.busy||a.pending)throw new Error('Finish or discard the pending edit first.');const s=usePlanner.getState();if(!(input.direction==='undo'?s.past:s.future).length)throw new Error('No history available in that direction.');s[input.direction as 'undo'|'redo']();useAgent.setState({message:`Agent ${input.direction} completed.`});return {status:input.direction,revision:useAgent.getState().revision};}},
  {name:'nook_set_view',title:'Inspect a floor or view',description:'Switch the visible floor and/or top/isometric/dollhouse view and select an existing piece for human inspection. No furnishing changes. View mode participates in normal undo/local autosave. Does not automatically reset zoom on selection. Finish or discard any proposal first.',inputSchema:object({floorId:text(),mode:choice('top','isometric','dollhouse'),selectedId:text()}),annotations:{readOnlyHint:false,untrustedContentHint:false},run:(input)=>{
    const s=usePlanner.getState(),a=useAgent.getState();if(a.busy||a.pending)throw new Error('Finish or discard the current preview/dialog first.');
    if(!input.floorId&&!input.mode&&!input.selectedId)throw new Error('Provide floorId, mode or selectedId.');
    const selected=input.selectedId?s.plan.furniture.find(i=>i.id===input.selectedId):undefined;if(input.selectedId&&!selected)throw new Error('Unknown furniture ID.');
    const floorId=input.floorId??selected?.floorId??s.activeFloorId;if(!s.plan.floors.some(f=>f.id===floorId)||selected&&selected.floorId!==floorId)throw new Error('Unknown floor or selection belongs to another floor.');
    s.setActiveFloor(floorId);if(input.mode&&input.mode!==s.plan.camera.mode)s.setView(input.mode);s.select(selected?.id);
    return {status:'view_updated',floorId,mode:usePlanner.getState().plan.camera.mode,selectedId:selected?.id??null,revision:useAgent.getState().revision};
  }},
];
export const agentTools:AgentTool[]=definitions.map(({run,...definition})=>({...definition,execute(input:unknown){
  try{if(useAgent.getState().paused)throw new Error('Agent access is paused by the user.');
    if(new TextEncoder().encode(JSON.stringify(input)??'').length>250000)throw new Error('Tool input exceeds 250 KB.');
    validateInput(input,definition.inputSchema);return {ok:true,...run(input) as object};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:'This action could not be completed.'};}
}}));

export interface ModelContext {registerTool(tool:AgentTool,options:{signal:AbortSignal}):void|Promise<void>}
export function registerAgentTools(context:ModelContext|undefined):()=>void {
  if(!context?.registerTool){useAgent.setState({status:'unsupported'});return ()=>{};}
  const lifetime=new AbortController();useAgent.setState({status:'connecting'});
  const register=async()=>{try{
    for(const tool of agentTools){if(lifetime.signal.aborted)return;await context.registerTool({...tool,execute(input){let result:unknown;flushSync(()=>{result=tool.execute(input)});return result;}},{signal:lifetime.signal});}
    if(!lifetime.signal.aborted)useAgent.setState({status:'ready'});
  }catch{if(!lifetime.signal.aborted){lifetime.abort();useAgent.setState({status:'error',message:'Agent tools could not connect. Reload this page to retry.'});}}};
  void register();return ()=>lifetime.abort();
}
export function browserModelContext():ModelContext|undefined{return typeof document==='undefined'?undefined:(document as Document&{modelContext?:ModelContext}).modelContext;}
