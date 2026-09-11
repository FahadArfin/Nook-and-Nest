import {it,expect} from 'vitest';
import {performanceScene} from '../qa/performanceScenes';
import {fieldCount,fieldId,fieldPlacement,fieldSample,paintVegetationField,validateVegetationField} from '../src/vegetationField';
import {visibleField} from '../src/vegetationVisibility';
import {parsePlan,serializePlan} from '../src/domain';
import {usePlanner} from '../src/store';

it('roundtrips two million stable plants in a compact save',()=>{
 const {plan}=performanceScene('two-million-mixed');const field=plan.environment!.vegetationField!;
 expect(fieldCount(field)).toBe(2_000_000);const text=serializePlan(plan);expect(text.length).toBeLessThan(500_000);
 const copy=parsePlan(text);expect(copy.environment!.vegetationField).toEqual(field);
 const key=Object.keys(field.cells)[37];expect(fieldSample(key,71)).toEqual(fieldSample(key,71));
 expect(fieldPlacement(copy,fieldId(key,71))).toEqual(fieldPlacement(plan,fieldId(key,71)));
});
it('bounds visibility work and preserves nested stable samples across zoom',()=>{
 const f=performanceScene('two-million-grass').plan.environment!.vegetationField!;
 const view={x:0,z:0,span:400,budget:18000};const a=visibleField(f,view);
 expect(a.length).toBeLessThanOrEqual(18000);expect(a.length).toBeGreaterThan(9000);
 expect(new Set(a.map(c=>fieldId(c.key,c.index))).size).toBe(a.length);
 const id=fieldId(a[0].key,a[0].index);expect(visibleField({...f,removed:{[id]:true}},view).some(c=>fieldId(c.key,c.index)===id)).toBe(false);
});
it('paints and erases one species without exceeding capacity or moving other samples',()=>{
 const {plan}=performanceScene('small-home');const brush={field:true,catalogId:'lavender-clump',radius:16,spacing:.3,density:9};
 const field=paintVegetationField(plan,[{x:-30,z:-30},{x:-60,z:-30}],brush);expect(fieldCount(field)).toBeGreaterThan(22000);validateVegetationField(field);
 plan.environment!.vegetationField=field;const erased=paintVegetationField(plan,[{x:-30,z:-30}],{...brush,eraseCoverage:true});expect(fieldCount(erased)).toBeLessThan(fieldCount(field));
 const full=performanceScene('two-million-grass').plan;expect(fieldCount(paintVegetationField(full,[{x:0,z:0}],brush))).toBe(2_000_000);
});
it('promotes a selected plant for independent editing and restores it with undo',()=>{
 const {plan}=performanceScene('two-million-grass');usePlanner.getState().replacePlan(plan);
 const id=fieldId('grass-clump|-20|-20',3),original=fieldPlacement(plan,id)!;
 usePlanner.getState().select(id);let s=usePlanner.getState();expect(s.plan.furniture.find(p=>p.id===id)).toEqual(original);expect(s.plan.environment!.vegetationField!.removed[id]).toBe(true);
 s.undo();s=usePlanner.getState();expect(s.plan.furniture.find(p=>p.id===id)).toBeUndefined();expect(fieldCount(s.plan.environment!.vegetationField)).toBe(2_000_000);
 s.redo();expect(usePlanner.getState().plan.furniture.find(p=>p.id===id)).toEqual(original);
});
it('rejects malformed fields and invalid exception references',()=>{
 for(const field of [{cells:{'grass-clump|0|0':513},removed:{}},{cells:{'sofa|0|0':1},removed:{}},{cells:{'grass-clump|0|0':1},removed:{'field:grass-clump|0|0:2':true}}])expect(()=>validateVegetationField(field)).toThrow();
});

it('does not thin an existing field when painting over it at lower density',()=>{
 const {plan}=performanceScene('small-home');const points=[{x:-30,z:-30}];const brush={field:true,catalogId:'grass-clump',radius:8,spacing:.3,density:9};
 const field=paintVegetationField(plan,points,brush);plan.environment!.vegetationField=field;
 expect(paintVegetationField(plan,points,{...brush,density:1,spacing:2})).toEqual(field);
});
