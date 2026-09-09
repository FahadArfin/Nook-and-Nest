import {describe,it,expect} from 'vitest';
import {performanceScene,sceneIds} from '../qa/performanceScenes';
import {parsePlan,serializePlan} from '../src/domain';
describe('repeatable performance fixtures',()=>{
 for(const id of sceneIds)it(id+' is deterministic and survives save validation',()=>{const a=performanceScene(id);expect(a).toEqual(performanceScene(id));expect(parsePlan(serializePlan(a.plan))).toEqual(a.plan);expect(new Set(a.plan.furniture.map(p=>p.id)).size).toBe(a.plan.furniture.length);});
 it('covers a large dense meadow independently of individual placement limits',()=>expect(Object.keys(performanceScene('dense-meadow').plan.environment!.grassCoverage!).length).toBe(39970));
 it('exercises mixed model batching at meaningful density',()=>expect(performanceScene('mixed-vegetation').plan.furniture).toHaveLength(2000));
});
