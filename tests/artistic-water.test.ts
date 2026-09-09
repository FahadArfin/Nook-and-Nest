// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {NullEngine,Scene} from '@babylonjs/core';
import {TerrainScene} from '../src/scene/TerrainScene';
import {createSamplePlan,serializePlan} from '../src/domain';
it('updates river geometry live, supplies shoreline depth, and respects reduced motion',()=>{const engine=new NullEngine(),scene=new Scene(engine),terrain=new TerrainScene(scene);try{const plan=createSamplePlan();plan.environment={background:'plain',grass:'off',terrain:[{kind:'river',radius:2,strength:1,points:[{x:-10,z:-10},{x:-5,z:-10}]}]};const saved=serializePlan(plan);terrain.update(plan);const water=scene.getMeshByName('river-surface')!;expect(water).toBeTruthy();const depth=water.getVerticesData('waterDepth')!;expect(depth.length).toBe(water.getTotalVertices());expect(depth.every(v=>v===0)).toBe(true);for(let i=0;i<120;i++)(terrain as any).advanceWater(1/30);expect(water.getVerticesData('waterDepth')!.some(v=>v>.05)).toBe(true);expect(depth.some(v=>v===0)).toBe(true);const material:any=water.material;vi.spyOn(engine,'getDeltaTime').mockReturnValue(16);vi.stubGlobal('matchMedia',()=>({matches:false}));scene.onBeforeRenderObservable.notifyObservers(scene);expect(material._floats.time).toBeGreaterThan(0);const time=material._floats.time;vi.stubGlobal('matchMedia',()=>({matches:true}));scene.onBeforeRenderObservable.notifyObservers(scene);expect(material._floats.time).toBe(time);expect(serializePlan(plan)).toBe(saved);terrain.update({...plan,environment:{...plan.environment,sun:{enabled:true,night:true,azimuth:0,elevation:20}}});expect((scene.getMeshByName('river-surface')!.material as any)._floats.night).toBe(1)}finally{vi.unstubAllGlobals();terrain.dispose();scene.dispose();engine.dispose()}});
it('preserves water through sculpting and expanded terrain bounds',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),terrain=new TerrainScene(scene);
  try{
    const plan=createSamplePlan();plan.environment={background:'plain',grass:'off',terrain:[{kind:'river',radius:2,strength:1,points:[{x:-10,z:-10}]}]};terrain.update(plan);
    for(let i=0;i<120;i++)(terrain as any).advanceWater(1/30);
    const before=(terrain as any).simulation.volume();expect(before).toBeGreaterThan(0);
    plan.environment.terrain!.push({kind:'lower',radius:3,strength:1,points:[{x:-12,z:-10}]});terrain.update(plan);
    expect((terrain as any).simulation.volume()).toBeCloseTo(before,8);
    plan.environment.terrain!.push({kind:'lower',radius:3,strength:1,points:[{x:-60,z:-10}]});terrain.update(plan);
    const sim=(terrain as any).simulation;
    expect(sim.volume()).toBeCloseTo(before,8);
    expect(Array.from(sim.depth as Float64Array).every((d,i)=>!sim.blocked[i]||d===0)).toBe(true);
  }finally{terrain.dispose();scene.dispose();engine.dispose()}
});

import {terrainSampler} from '../src/terrain';
import {validatePlan} from '../src/planValidation';
it('new water sources leave flat and sloped terrain intact and survive saving',()=>{
 const plan=createSamplePlan();plan.environment={background:'plain',grass:'off',terrain:[{kind:'raise',radius:4,strength:1,points:[{x:-10,z:-10}]}]};
 const sample=terrainSampler(plan),before=[-11,-10,-9].map(x=>sample(x,-10).height);
 plan.environment.terrain!.push({kind:'river',carve:false,radius:3,strength:.4,points:[{x:-10,z:-10}]});
 const saved=JSON.parse(serializePlan(plan));validatePlan(saved);const after=terrainSampler(saved);
 expect([-11,-10,-9].map(x=>after(x,-10).height)).toEqual(before);
 expect(after(-10,-10).waterLevel).toBeCloseTo(before[1]+.4);
 plan.environment.terrain=[{kind:'river',carve:false,radius:3,strength:.4,points:[{x:-10,z:-10}]}];expect(terrainSampler(plan)(-10,-10).height).toBe(-.15);
 plan.environment.terrain[0].carve=undefined;expect(terrainSampler(plan)(-10,-10).height).toBeLessThan(-.15);
});
it('water spreads on flat land with a positive local source level',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),terrain=new TerrainScene(scene);try{
 const plan=createSamplePlan();plan.environment={background:'plain',grass:'off',terrain:[{kind:'river',carve:false,radius:1,strength:.3,points:[{x:-10,z:-10}]}]};terrain.update(plan);
 for(let i=0;i<240;i++)(terrain as any).advanceWater(1/30);
 const sim=(terrain as any).simulation;expect(sim.volume()).toBeGreaterThan(0);expect(Array.from(sim.depth as Float64Array).some((d,i)=>d>.001&&!sim.source[i])).toBe(true);
 expect(scene.getMeshByName('river-surface')!.getTotalVertices()).toBe(321*321);
 }finally{terrain.dispose();scene.dispose();engine.dispose()}
});
