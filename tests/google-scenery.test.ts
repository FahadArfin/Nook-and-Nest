import {describe,it,expect,vi,afterEach} from 'vitest';
import {PerformanceConfigurator} from '@babylonjs/core/Engines/performanceConfigurator';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {torontoFrame} from '../src/scene/googleCoordinates';
import {googleFrameAllowed,useGoogleScenery} from '../src/googleScenery';
import {googleQualitySettings,nearbyDetailWeight,defaultGoogleQuality} from '../src/googleSceneryQuality';
import {LRUCache} from '3d-tiles-renderer/core';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
describe('Google scenery',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('keeps sharp detail near the apartment and relaxes it smoothly toward the skyline',()=>{
    expect(nearbyDetailWeight(0)).toBe(1);expect(nearbyDetailWeight(600)).toBe(1);
    expect(nearbyDetailWeight(1500)).toBeCloseTo(2.5);
    expect(nearbyDetailWeight(2400)).toBe(4);expect(nearbyDetailWeight(3500)).toBe(4);
    expect(defaultGoogleQuality(4)).toBe('economy');expect(defaultGoogleQuality(8)).toBe('balanced');
    expect(defaultGoogleQuality()).toBe('balanced');
    expect(googleQualitySettings('retained').errorTarget).toBe(googleQualitySettings('balanced').errorTarget);
    expect(googleQualitySettings('retained').minBytesSize).toBeGreaterThan(800*1024*1024);
  });
  it('retains a previously viewed 300 MiB neighbourhood in balanced mode',()=>{
    vi.stubGlobal('requestAnimationFrame',()=>0);
    const cache=new LRUCache();cache.unloadPriorityCallback=(_a:unknown,_b:unknown)=>0;
    Object.assign(cache,googleQualitySettings('balanced'));
    // The package exposes these methods at runtime but its declarations are incomplete.
    const c=cache as any,removed:number[]=[];
    for(let i=0;i<30;i++){const tile={};c.add(tile,()=>removed.push(i));c.setMemoryUsage(tile,10*1024*1024);c.setLoaded(tile,true);}
    c.markAllUnused();c.unloadUnusedContent();
    expect(removed).toHaveLength(0);expect(c.cachedBytes).toBe(300*1024*1024);
    Object.assign(cache,googleQualitySettings('economy'));c.unloadPercent=1;c.unloadUnusedContent();
    expect(removed.length).toBeGreaterThan(0);expect(c.cachedBytes).toBeLessThanOrEqual(256*1024*1024);
  });
  it('changes quality without unpausing or starting a new paid session',()=>{
    const before=useGoogleScenery.getState();before.pause();before.setQuality('high');
    expect(useGoogleScenery.getState().restart).toBe(before.restart);
    expect(useGoogleScenery.getState().paused).toBe(true);
    expect(googleQualitySettings('high').maxBytesSize).toBe(1024*1024*1024);
    useGoogleScenery.setState({quality:before.quality,paused:before.paused});
  });
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
