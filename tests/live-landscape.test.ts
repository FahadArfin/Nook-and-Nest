import {describe,it,expect} from 'vitest';
import {basinWater} from '../src/basinWater';
import {scatterPlants} from '../src/planting';
import {createSamplePlan,serializePlan,parsePlan} from '../src/domain';
import {usePlanner} from '../src/store';
const grid=(n:number,height:(x:number,z:number)=>number)=>Array.from({length:(n+1)**2},(_,i)=>[i%(n+1),height(i%(n+1),Math.floor(i/(n+1))),Math.floor(i/(n+1))]).flat();
describe('connected river basins',()=>{
 it('fills a connected hollow beyond the river brush',()=>{const n=6,p=grid(n,()=>-1),seed=Array(n*n).fill(false);seed[0]=true;const water=basinWater(p,n,seed);expect([...water.wet].filter(Boolean)).toHaveLength(36);expect(water.positions.filter((_,i)=>i%3===1).every(y=>y===-.2)).toBe(true)});
 it('stops at a ridge and leaves a disconnected hollow dry',()=>{const n=6,p=grid(n,x=>x===3?1:-1),seed=Array(n*n).fill(false);seed[0]=true;const water=basinWater(p,n,seed);expect(water.wet[0]).toBe(1);expect(water.wet[5]).toBe(0);expect(Math.max(...water.positions.filter((_,i)=>i%3===0))).toBeLessThan(3)});
 it('clips the shoreline instead of drawing water over the bank',()=>{const p=grid(1,x=>x===0?-1:1),water=basinWater(p,1,[true],.2);expect(water.indices.length).toBeGreaterThan(0);expect(Math.max(...water.positions.filter((_,i)=>i%3===0))).toBeCloseTo(.6);expect(basinWater(p,1,[false],.2).indices).toHaveLength(0)});
});
it('offers denser planting beyond the old 64-piece cap',()=>{const p=createSamplePlan(),points=[{x:-10,z:-10}],brush={catalogId:'grass-clump',radius:2,spacing:.5};const sparse=scatterPlants(p,points,brush),dense=scatterPlants(p,points,{...brush,density:9});expect(dense.length).toBeGreaterThan(64);expect(dense.length).toBeGreaterThan(sparse.length);expect(dense.length).toBeLessThanOrEqual(512)});
it('saves full and half walls independently with one undo per wall',()=>{const s=usePlanner.getState();s.replacePlan(createSamplePlan());const height=usePlanner.getState().plan.floors[0].heightMm;s.setWallDrawHeight(Math.round(height/2));s.addWall({ax:2,az:2,bx:4,bz:2});s.setWallDrawHeight(0);s.addWall({ax:2,az:3,bx:4,bz:3});const plan=usePlanner.getState().plan;expect(plan.floors[0].heightMm).toBe(height);expect(plan.floors[0].walls.at(-2)?.heightMm).toBe(Math.round(height/2));expect(plan.floors[0].walls.at(-1)?.heightMm).toBeUndefined();expect(parsePlan(serializePlan(plan))).toEqual(plan);s.undo();expect(usePlanner.getState().plan.floors[0].walls.at(-1)?.heightMm).toBe(Math.round(height/2))});
