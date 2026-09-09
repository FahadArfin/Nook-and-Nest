import {it,expect} from 'vitest';
import {ShallowWater} from '../src/shallowWater';
it('adds water gradually and keeps disconnected hollows dry behind a bank',()=>{
 const s=new ShallowWater(12,1,1);s.bed.fill(-1);for(let z=0;z<12;z++)s.bed[z*12+6]=2;s.source[26]=1;
 s.step();expect(s.volume()).toBeGreaterThan(0);expect(s.volume()).toBeLessThan(.01);
 for(let i=0;i<600;i++)s.step();expect(s.depth[25]).toBeGreaterThan(0);expect(s.depth[32]).toBe(0);
 expect([...s.depth].every(v=>Number.isFinite(v)&&v>=-1e-12)).toBe(true);
});
it('flows into newly lowered ground and displaces existing water without creating volume',()=>{
 const s=new ShallowWater(10,.5,.5);s.bed.fill(-1);s.depth.fill(.6);const volume=s.volume();
 s.bed[55]=-2;expect(s.volume()).toBe(volume);const before=s.depth[55];
 for(let i=0;i<120;i++)s.step(1/30,0);expect(s.depth[55]).toBeGreaterThan(before);expect(s.volume()).toBeCloseTo(volume,8);
 const wet=s.depth[55];s.bed[55]=0;for(let i=0;i<120;i++)s.step(1/30,0);
 expect(s.depth[55]).toBeLessThan(wet);expect(s.volume()).toBeCloseTo(volume,8);expect([...s.depth].every(v=>v>=-1e-12)).toBe(true);
});
it('keeps a level lake at rest and bounds long frame timesteps',()=>{
 const s=new ShallowWater(20,.25,.25);s.bed.fill(-1);s.depth.fill(.8);const volume=s.volume();
 for(let i=0;i<100;i++)s.step(10,0);expect(s.volume()).toBeCloseTo(volume,10);expect([...s.flow].every(v=>v===0)).toBe(true);
});

it('keeps protected foundations dry even when surrounding water is displaced upward',()=>{
 const s=new ShallowWater(10,1,1);s.bed.fill(-1);s.depth.fill(.8);s.blocked[55]=1;s.depth[55]=0;s.bed[54]=2;
 for(let i=0;i<120;i++)s.step(1/30,0);expect(s.depth[55]).toBe(0);
});
