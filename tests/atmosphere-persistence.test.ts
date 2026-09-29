import {expect,it} from 'vitest';
import {createBlankPlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {applyLayoutAlternative,publicLayoutPlan,saveLayoutAlternative} from '../src/layoutAlternatives';
import {personalPhotoIds} from '../src/personalItems';
import {defaultSceneAtmosphere,publicSceneAtmosphere,resolveAtmosphere} from '../src/sceneAtmosphere';
import {defaultTakeoffSettings} from '../src/surfaceTakeoff';
import {personalSurfaceSlots as slots} from '../src/personalSurfaceSlots';
import materials from '../src/modelMaterials.json';
it('keeps lightweight startup validation aligned with the authored material slots',()=>{
 const expected=Object.fromEntries(Object.entries(materials).map(([id,parts])=>[id,parts.filter(p=>/upholstery|fabric|linen|cloth|cotton|wool|carpet|leather|velvet/i.test(p.id)&&!p.id.includes('artwork')).map(p=>p.id)]).filter(([,ids])=>ids.length));expect(slots).toEqual(expected);
});
it('round-trips private boards, images, assumptions and atmosphere in independent layout snapshots',()=>{
 let plan=createBlankPlan('Private design','metric');const assetId='sha256:'+'a'.repeat(64),floorId=plan.floors[0].id;
 plan.moodboards={version:1,boards:[{id:'board',name:'Private board',createdAt:'2026-09-29',updatedAt:'2026-09-29',palette:[],bindings:[],pins:[{id:'pin',kind:'image',assetId,label:'Private photo'}]}]};
 plan.surfaceTakeoffSettings=defaultTakeoffSettings();plan.environment={background:'plain',grass:'off',atmosphere:defaultSceneAtmosphere('2026-09-29')};
 plan=saveLayoutAlternative(plan,'Idea',floorId,validatePlan,{id:'idea',now:'2026-09-29T12:00:00Z'});
 const working={...plan,moodboards:undefined,surfaceTakeoffSettings:undefined,environment:undefined};expect(personalPhotoIds(working)).toEqual([assetId]);
 const restored=applyLayoutAlternative(working,'idea',floorId,validatePlan).plan;expect(restored.moodboards).toEqual(plan.moodboards);expect(restored.surfaceTakeoffSettings).toEqual(plan.surfaceTakeoffSettings);expect(restored.environment).toEqual(plan.environment);
 const publicPlan=publicLayoutPlan(restored);expect(publicPlan.moodboards).toBeUndefined();expect(publicPlan.surfaceTakeoffSettings).toBeUndefined();expect(JSON.stringify(publicPlan)).not.toContain(assetId);validatePlan(publicPlan);
});
it('public sunlight retains the resolved light direction without sharing site coordinates, dates or private names',()=>{
 const value=defaultSceneAtmosphere('2026-09-29');value.mode='sun-study';value.study={latitude:40.7128,longitude:-74.006,northDegrees:19,date:'2026-09-29',minutesLocal:840,utcOffsetMinutes:-300,daylightSaving:true};value.comparisons=[{id:'study',name:'Private home address',settings:{...value.study}}];
 const safe=publicSceneAtmosphere(value),before=resolveAtmosphere(value)!,after=resolveAtmosphere(safe)!;
 expect(safe.mode).toBe('mood');expect(safe.study.latitude).toBeNull();expect(safe.study.longitude).toBeNull();expect(safe.study.date).toBe('2000-01-01');expect(safe.comparisons).toEqual([]);
 expect(after.direction.x).toBeCloseTo(before.direction.x,8);expect(after.direction.y).toBeCloseTo(before.direction.y,8);expect(after.direction.z).toBeCloseTo(before.direction.z,8);
 expect(JSON.stringify(safe)).not.toContain('Private home address');expect(value.comparisons).toHaveLength(1);
});
it('rejects malformed image surfaces, boards, assumptions and atmosphere before plan acceptance',()=>{
 const plan=createBlankPlan('Validation','metric');expect(()=>validatePlan({...plan,moodboards:{version:1,boards:[{name:'bad'}]}})).toThrow();
 expect(()=>validatePlan({...plan,surfaceTakeoffSettings:{...defaultTakeoffSettings(),wallFaces:'invented'}})).toThrow();
 expect(()=>validatePlan({...plan,environment:{background:'plain',grass:'off',atmosphere:{...defaultSceneAtmosphere(),mode:'invented'}}})).toThrow();
});
