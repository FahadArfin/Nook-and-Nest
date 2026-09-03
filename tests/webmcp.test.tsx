// @vitest-environment jsdom
import React from 'react';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { agentTools, applyProposal, registerAgentTools, useAgent, type AgentTool } from '../src/webmcp';
import { buildDesign, overlap, type DesignOperation } from '../src/agentDesign';
import { AgentControls } from '../src/AgentControls';
import { createSamplePlan, parsePlan, serializePlan } from '../src/domain';
import { loadPlan, savePlan, usePlanner } from '../src/store';
import { catalog } from '../src/catalog';

const call=(name:string,input:unknown):any=>agentTools.find(t=>t.name===name)!.execute(input);
const rev=()=>useAgent.getState().revision;
const floor=()=>usePlanner.getState().activeFloorId;
const place=(catalogId='sofa',extra:object={}):DesignOperation=>({action:'place',catalogId,floorId:floor(),x:1700,z:1700,...extra});
const stage=(operations:DesignOperation[]=[place()])=>call('nook_stage_design',{expectedRevision:rev(),label:'Warm reading room',operations});
beforeEach(()=>{usePlanner.getState().replacePlan(createSamplePlan('WebMCP test','metric'));useAgent.setState({paused:false,allowApply:false,pending:undefined,busy:false,open:false,message:'Ready'});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('registers all seven schemas and annotations, then aborts all registrations',async()=>{
 const tools:AgentTool[]=[],signals:AbortSignal[]=[];const stop=registerAgentTools({registerTool(tool,options){tools.push(tool);signals.push(options.signal);}});
 await waitFor(()=>expect(tools).toHaveLength(7));expect(new Set(tools.map(t=>t.name)).size).toBe(7);expect(tools.every(t=>t.inputSchema.additionalProperties===false)).toBe(true);
 expect(tools.find(t=>t.name==='nook_get_apartment')?.annotations).toEqual({readOnlyHint:true,untrustedContentHint:true});stop();expect(signals.every(s=>s.aborted)).toBe(true);
});
it('handles unsupported browsers and registration failure without breaking the editor',async()=>{
 registerAgentTools(undefined)();expect(useAgent.getState().status).toBe('unsupported');const stop=registerAgentTools({registerTool(){throw Error('unsupported');}});await waitFor(()=>expect(useAgent.getState().status).toBe('error'));stop();expect(usePlanner.getState().plan.furniture).toHaveLength(0);
});
it('inspects current floor in mm, without account or cloud library data',()=>{const r=call('nook_get_apartment',{});expect(r.ok).toBe(true);expect(r.floor.wallsMm.length).toBeGreaterThan(0);expect(r.floor.rectanglesMm[0].width).toBe(250);expect(r.mode).toBe('review_first');expect(r.email).toBeUndefined();expect(call('nook_get_apartment',{floorId:'nope'}).ok).toBe(false);});
it('searches the full catalog with types, dimensions, materials and pagination',()=>{
 const r=call('nook_search_catalog',{query:'sofas',limit:2});expect(r.items).toHaveLength(2);expect(r.nextOffset).toBe(2);expect(r.items[0].materials.length).toBeGreaterThan(0);expect(r.colors.sage).toBe('#97a67c');expect(call('nook_search_catalog',{query:'not-a-real-piece'}).total).toBe(0);expect(call('nook_search_catalog',{limit:0}).ok).toBe(false);
});
it('stages a live proposal without changing plan, history or persisted data',async()=>{const original=usePlanner.getState().plan;await savePlan(original);const r=stage();expect(r.status).toBe('staged_not_saved');expect(usePlanner.getState().plan).toBe(original);expect(usePlanner.getState().past).toHaveLength(0);expect((await loadPlan())!.furniture).toHaveLength(0);expect(useAgent.getState().pending!.plan.furniture).toHaveLength(1);});
it('requires human review by default and supports human Apply design',()=>{const r=stage();expect(call('nook_apply_design',{proposalId:r.proposalId}).status).toBe('awaiting_user_review');expect(usePlanner.getState().plan.furniture).toHaveLength(0);expect(applyProposal(r.proposalId).status).toBe('applied');expect(usePlanner.getState().plan.furniture).toHaveLength(1);});
it('applies multiple changes as one undo step and round trips exact placements',async()=>{
 useAgent.setState({allowApply:true});const original=structuredClone(usePlanner.getState().plan),r=stage([place(),place('armchair',{x:3000,z:1000,rotation:45,variant:'clay'})]);expect(call('nook_apply_design',{proposalId:r.proposalId}).status).toBe('applied');const applied=usePlanner.getState().plan;expect(usePlanner.getState().past).toHaveLength(1);await savePlan(applied);expect((await loadPlan())!.furniture).toEqual(applied.furniture);expect(parsePlan(serializePlan(applied)).furniture).toEqual(applied.furniture);
 expect(call('nook_history',{expectedRevision:rev(),direction:'undo'}).ok).toBe(true);expect(usePlanner.getState().plan).toEqual(original);expect(call('nook_history',{expectedRevision:rev(),direction:'redo'}).ok).toBe(true);expect(usePlanner.getState().plan).toEqual(applied);
});
it('does not apply twice on retries',()=>{useAgent.setState({allowApply:true});const r=stage();call('nook_apply_design',{proposalId:r.proposalId});expect(call('nook_apply_design',{proposalId:r.proposalId}).ok).toBe(false);expect(usePlanner.getState().past).toHaveLength(1);});
it('rejects stale revisions and invalidates proposals on human edits',()=>{const r=stage(),revision=rev();usePlanner.getState().rename('Human edit');expect(useAgent.getState().pending).toBeUndefined();expect(call('nook_apply_design',{proposalId:r.proposalId}).ok).toBe(false);expect(call('nook_stage_design',{expectedRevision:revision,label:'Stale',operations:[place()]}).ok).toBe(false);});
it('resets direct-edit permission on project switch and stops all tools when paused',()=>{useAgent.setState({allowApply:true});usePlanner.getState().replacePlan(createSamplePlan('Different project'));expect(useAgent.getState().allowApply).toBe(false);useAgent.setState({paused:true});expect(call('nook_get_apartment',{}).ok).toBe(false);expect(stage().ok).toBe(false);});
it('rejects malformed, oversized, unknown and nonfinite input without partial writes',()=>{
 const before=usePlanner.getState().plan;for(const op of [place('nonexistent'),place('sofa',{widthMm:-1}),place('sofa',{x:NaN}),place('sofa',{variant:'rainbow'}),place('sofa',{materialColors:{fabric:'red'}}),place('sofa',{url:'https://example.com'}),place('sofa',{floorId:'missing'}),place('sofa',{materialColors:{nonexistent:'#aabbcc'}})]){expect(stage([place(),op]).ok).toBe(false);expect(usePlanner.getState().plan).toBe(before);expect(useAgent.getState().pending).toBeUndefined();}
 expect(call('nook_stage_design',{expectedRevision:rev(),label:'x'.repeat(250001),operations:[place()]}).ok).toBe(false);expect(stage(Array.from({length:101},()=>place())).ok).toBe(false);
});
it('rejects prototype keys and unknown fields',()=>{expect(stage([place('sofa',{key:'__proto__'})]).ok).toBe(false);const r=call('nook_search_catalog',JSON.parse('{"__proto__":{"polluted":true}}'));expect(r.ok).toBe(false);expect(({} as any).polluted).toBeUndefined();});
it('keeps a previous proposal when a replacement fails validation',()=>{const first=stage();expect(stage([place('missing')]).ok).toBe(false);expect(useAgent.getState().pending?.id).toBe(first.proposalId);});
it('supports discard without changing history and rejects missing proposal IDs',()=>{const r=stage();expect(call('nook_discard_design',{proposalId:'missing'}).ok).toBe(false);expect(call('nook_discard_design',{proposalId:r.proposalId}).status).toBe('discarded');expect(usePlanner.getState().past.length).toBe(0);});
it('blocks conflicting manual drafts and handles invalid view/history atomically',()=>{useAgent.setState({busy:true});expect(stage().ok).toBe(false);expect(call('nook_set_view',{mode:'top'}).ok).toBe(false);useAgent.setState({busy:false,allowApply:true});expect(call('nook_history',{direction:'undo',expectedRevision:rev()}).ok).toBe(false);const before=usePlanner.getState();expect(call('nook_set_view',{floorId:'missing',mode:'top'}).ok).toBe(false);expect(usePlanner.getState()).toBe(before);expect(call('nook_set_view',{mode:'top'}).mode).toBe('top');});
it('fits a monitor on a desk added earlier in the same batch',()=>{
 const r=stage([place('desk',{key:'desk'}),place('desktop-monitor',{supportId:'desk'})]);expect(r.ok).toBe(true);expect(r.placements[1].elevationMm).toBe(760);expect(r.keys.desk).toBe(r.placements[0].id);
 expect(stage([place('desk',{key:'desk'}),place('desktop-monitor',{supportId:'desk',x:9000})]).ok).toBe(false);
});
it('fits shelf decorations with actual cubby geometry and rejects unknown shelves',()=>{
 const r=stage([place('display-bookcase',{key:'shelf'}),place('adventurer-figurine',{supportId:'shelf',shelfId:'level-2'})]);expect(r.ok).toBe(true);expect(r.placements[1].elevationMm).toBe(740);
 expect(stage([place('display-bookcase',{key:'shelf'}),place('adventurer-figurine',{supportId:'shelf',shelfId:'level-9'})]).ok).toBe(false);
});
it('supports precise rooms, wall geometry, regional finishes and optional environment',()=>{
 const r=stage([{action:'add_room',floorId:floor(),origin:{x:0,z:0},widthMm:6033,depthMm:4505},{action:'add_wall',floorId:floor(),ax:3000,az:0,bx:3000,bz:4000},{action:'finish',floorId:floor(),kind:'floor',finishId:'light-oak',cells:[{x:0,z:0}]},{action:'environment',background:'rural',grass:'off'}]);expect(r.ok).toBe(true);const p=useAgent.getState().pending!.plan;expect(p.floors[0].walls[0].bx).toBe(12);expect(p.floors[0].cellFinishes!['0,0']).toBe('light-oak');expect(p.environment?.background).toBe('rural');
 expect(stage([{action:'add_wall',floorId:floor(),ax:0,az:0,bx:1000,bz:1000}]).ok).toBe(false);expect(stage([{action:'finish',floorId:floor(),kind:'wall',finishId:'bad'}]).ok).toBe(false);
});
it('supports per-part recolors, removal and returns normalized rotations',()=>{
 const info=call('nook_search_catalog',{query:'refrigerator'}).items[0],slot=info.materials[0].id;
 const r=stage([place('refrigerator',{key:'fridge'}),{action:'update',id:'fridge',rotation:-15,materialColors:{[slot]:'#123abc'}}]);expect(r.ok).toBe(true);expect(r.placements[0].rotation).toBe(345);expect(r.placements[0].materialColors[slot]).toBe('#123abc');
 const p=buildDesign(usePlanner.getState().plan,[place(),place('desk')]).plan;expect(buildDesign(p,[{action:'remove',ids:[p.furniture[0].id]}]).plan.furniture).toHaveLength(1);
});
it('uses wall snapping and prevents impossible openings',()=>{expect(stage([place('window-casement',{x:1500,z:0})]).ok).toBe(true);expect(stage([place('window-casement',{widthMm:20000})]).ok).toBe(false);});
it('checks overlaps at arbitrary rotations without blocking design freedom',()=>{
 const def=catalog.find(c=>c.id==='desk')!,a={...def,id:'a',catalogId:def.id,floorId:floor(),x:0,z:0,rotation:45,variant:'sage'};expect(overlap(a,{...a,id:'b',x:40})).toBe(true);expect(overlap(a,{...a,id:'b',x:5000})).toBe(false);expect(stage([place(),place()]).warnings.some((w:any)=>w.kind==='overlap')).toBe(true);
});
it('offers accessible human approval, pause and session-only direct-edit controls',()=>{
 render(<AgentControls busy={false}/>);fireEvent.click(screen.getByRole('button',{name:'Decorate with an agent'}));const control=screen.getByRole('checkbox',{name:/Let my agent apply designs/});expect((control as HTMLInputElement).checked).toBe(false);fireEvent.click(control);expect(useAgent.getState().allowApply).toBe(true);fireEvent.click(screen.getByRole('checkbox',{name:'Pause agent tools'}));expect(useAgent.getState().paused).toBe(true);expect(useAgent.getState().allowApply).toBe(false);
});
