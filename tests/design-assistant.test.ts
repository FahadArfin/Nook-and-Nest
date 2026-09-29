import {describe,expect,it} from 'vitest';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {assistantGoals,assistantStyles,buildAssistantProposal,suggestDesigns,type DesignBrief} from '../src/designAssistant';
import {catalog} from '../src/catalog';
const room=()=>{const p=createSamplePlan('Measured room','metric');p.gridSizeMm=1000;p.floors=p.floors.slice(0,1).map(f=>({...f,cells:rectangleCells(10,10)}));return p;};
const brief=(floorId:string):DesignBrief=>({version:1,floorId,goal:'reading',style:'natural',householdSize:2,clearanceMm:300,keepItemIds:[],manualPrices:[],budget:{currency:'USD',amountMinor:100000}});
describe('bounded local design proposals',()=>{
 it('can furnish every offered room purpose and palette with at least one complete supported recipe',()=>{
  const plan=room();for(const goal of assistantGoals)for(const style of assistantStyles){const result=suggestDesigns(plan,{...brief(plan.floors[0].id),goal,style});expect(result.proposals.length,goal+' / '+style+': '+result.conflicts.join('; ')).toBeGreaterThan(0);}
 });
 it('offers distinct catalog constructions while preserving all original dimensions, locks, geometry and private metadata',()=>{
  const plan=room(),floorId=plan.floors[0].id;plan.furniture=[{id:'owned',catalogId:'desk',floorId,x:800,z:800,rotation:0,widthMm:1234,depthMm:657,heightMm:760,variant:'oat',personalItem:{version:1,itemId:'mine',name:'My desk',representation:'catalog-proxy',status:'keep',notes:'Private'}}];plan.furnitureGroups={version:1,groups:[],lockedItemIds:['owned']};const before=structuredClone(plan),result=suggestDesigns(plan,brief(floorId));expect(result.proposals.length).toBeGreaterThan(1);expect(new Set(result.proposals.map(p=>JSON.stringify(p.operations.map(o=>o.action==='place'?o.catalogId:null)))).size).toBe(result.proposals.length);
  for(const p of result.proposals){expect(p.preview.plan.furniture.find(f=>f.id==='owned')).toEqual(before.furniture[0]);expect(p.preview.plan.floors).toEqual(before.floors);expect(p.preview.plan.furnitureGroups).toEqual(before.furnitureGroups);expect(p.cost.unknownCount).toBeGreaterThan(0);expect(p.unmet.join(' ')).toContain('cannot be confirmed');expect(p.operations.every(o=>o.action==='place')).toBe(true);}expect(plan).toEqual(before);
 });
 it('rejects architectural edits, resized pieces, unknown fields, floor holes and conflicting support removal',()=>{
  const plan=room(),floorId=plan.floors[0].id,b=brief(floorId),place={action:'place',catalogId:'armchair',floorId,x:5000,z:5000};
  for(const ops of [[{action:'remove',ids:['anything']}],[{action:'add_room',floorId,origin:{x:0,z:0},widthMm:2000,depthMm:2000}],[{...place,widthMm:12}],[{...place,sendTo:'https://example.com'}],[{...place,catalogId:'door-flush'}]])expect(()=>buildAssistantProposal(plan,b,ops,'Invalid')).toThrow();
  plan.floors[0].cells=plan.floors[0].cells.filter(c=>c.x!==5||c.z!==5);expect(()=>buildAssistantProposal(plan,b,[{...place,x:5500,z:5500}],'Hole')).toThrow();
  const supportPlan=room(),supportFloor=supportPlan.floors[0].id;expect(()=>buildAssistantProposal(supportPlan,brief(supportFloor),[{action:'place',catalogId:'laptop',floorId:supportFloor,x:5000,z:5000,supportId:'removed-desk'}],'Missing support')).toThrow(/support/i);
 });
 it('uses only manually supplied prices, reports known overages, and returns actionable conflicts for impossible sizes',()=>{
  const plan=room(),floorId=plan.floors[0].id,b=brief(floorId),first=suggestDesigns(plan,b).proposals[0],chosen=first.operations.filter(o=>o.action==='place');const priced={...b,budget:{currency:'USD',amountMinor:1},manualPrices:chosen.map(o=>({catalogId:o.catalogId,currency:'USD',amountMinor:12500}))};
  const rebuilt=buildAssistantProposal(plan,priced,first.operations,'Priced');expect(rebuilt.cost.unknownCount).toBe(0);expect(rebuilt.cost.knownMinor).toBe(chosen.length*12500);expect(rebuilt.cost.overBudget).toBe(true);expect(rebuilt.preview.plan.furniture[0].specification?.match).toBe('unspecified');expect(rebuilt.unmet.join(' ')).toContain('exceed');
  const impossible=suggestDesigns(plan,{...b,maxPieceWidthMm:100,maxPieceDepthMm:100});expect(impossible.proposals).toEqual([]);expect(impossible.conflicts).toHaveLength(3);expect(catalog.length).toBeGreaterThan(0);
 });
});
