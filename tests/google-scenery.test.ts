import {describe,it,expect} from 'vitest';
import {PerformanceConfigurator} from '@babylonjs/core/Engines/performanceConfigurator';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {torontoFrame} from '../src/scene/googleCoordinates';
import {googleFrameAllowed} from '../src/googleScenery';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
describe('Google scenery',()=>{
  it('maps ECEF to the apartment without mirroring or large-coordinate jitter',()=>{
    PerformanceConfigurator.SetMatrixPrecision(true);
    const {origin,matrix}=torontoFrame(12,8,180);
    expect(Vector3.TransformCoordinates(origin,matrix).subtract(new Vector3(12,0,8)).length()).toBeLessThan(.00001);
    const lon=-79.3855*Math.PI/180,east=new Vector3(-Math.sin(lon),Math.cos(lon),0);
    expect(Vector3.TransformCoordinates(origin.add(east),matrix).subtract(new Vector3(13,0,8)).length()).toBeLessThan(.00001);
    const higher=torontoFrame(12,8,190);expect(Vector3.TransformCoordinates(origin,higher.matrix).y).toBeCloseTo(-10,5);
    expect(matrix.determinant()).toBeCloseTo(1,5);
  });
  it('blocks all new work while paused, hidden, inactive or expired',()=>{
    expect(googleFrameAllowed(true,false,false,false)).toBe(true);
    for(const args of [[false,false,false,false],[true,true,false,false],[true,false,true,false],[true,false,false,true]])expect(googleFrameAllowed(...args as [boolean,boolean,boolean,boolean])).toBe(false);
  });
  it('preserves old saves and validates new settings without saving runtime sessions',()=>{
    const plan=createSamplePlan();expect(()=>validatePlan(plan)).not.toThrow();
    plan.environment={background:'city',grass:'off',citySource:'google',cityHeight:180};
    const result=parsePlan(serializePlan(plan));expect(result.environment).toEqual(plan.environment);
    expect(serializePlan(plan)).not.toContain('sessionToken');
    expect(()=>validatePlan({...plan,environment:{...plan.environment,cityHeight:0}})).toThrow();
    expect(()=>validatePlan({...plan,environment:{...plan.environment,citySource:'unknown'}})).toThrow();
  });
});
