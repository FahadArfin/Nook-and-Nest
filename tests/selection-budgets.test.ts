import {expect,it} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {compareSelectionBudgets,parseSelectionBudgets,updateSelectionBudget} from '../src/selectionBudgets';
import {buildSelectionSchedule,defaultSpecification,stripSelectionSpecifications,type SelectionPlan} from '../src/selectionSchedule';
it('compares only one currency, flags missing prices and retains orphaned budgets',()=>{
  const plan:SelectionPlan=createBlankPlan('Budget','metric'),floorId=plan.floors[0].id;
  plan.furniture=['USD','CAD',null].map((currency,i)=>({id:String(i),floorId,catalogId:'side-table',x:0,z:0,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'sage',specification:{...defaultSpecification(),currency,unitPriceMinor:currency?15000:null,checkedOn:currency?'2026-09-29':null}}));
  const budgets=parseSelectionBudgets({version:1,targets:[{scope:'project',currency:'USD',amountMinor:10000},{scope:'room',floorId:'removed',roomKey:'old',currency:'CAD',amountMinor:9000}]});
  const result=compareSelectionBudgets(plan,buildSelectionSchedule(plan),budgets);expect(result[0]).toMatchObject({knownMinor:15000,overTargetMinor:5000,unknownPrices:1,orphaned:false});expect(result[1].orphaned).toBe(true);
  const next=updateSelectionBudget(plan,plan,budgets.targets[0],false,validatePlan);expect(next.selectionBudgets?.targets).toHaveLength(1);expect(()=>updateSelectionBudget(plan,next,budgets.targets[0],false,validatePlan)).toThrow('changed');
  expect(stripSelectionSpecifications(next)).not.toHaveProperty('selectionBudgets');expect(()=>parseSelectionBudgets({version:1,targets:[budgets.targets[0],budgets.targets[0]]})).toThrow();
});
it('prefers an explicit product name over the personal item name and the personal name over the proxy catalog label',()=>{
  const plan:SelectionPlan=createBlankPlan('Owned','metric');plan.furniture=[{id:'one',floorId:plan.floors[0].id,catalogId:'side-table',x:0,z:0,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'sage',personalItem:{name:'My inherited table'}} as SelectionPlan['furniture'][number]];
  expect(buildSelectionSchedule(plan).rows[0].name).toBe('My inherited table');plan.furniture[0].specification={...defaultSpecification(),productName:'Chosen product'};expect(buildSelectionSchedule(plan).rows[0].name).toBe('Chosen product');
});
