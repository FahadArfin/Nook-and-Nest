import {it,expect} from 'vitest';
import {createBlankPlan,serializePlan,parsePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {terrainSampler} from '../src/terrain';
it('shares immutable unchanged furniture across undo snapshots',()=>{const p=createBlankPlan();usePlanner.getState().replacePlan(p);usePlanner.getState().placeFurniture('grass-clump');const before=usePlanner.getState().plan;usePlanner.getState().rename('Beta');expect(usePlanner.getState().past.at(-1)!.plan).toBe(before);expect(usePlanner.getState().plan.furniture).toBe(before.furniture);usePlanner.getState().undo();expect(usePlanner.getState().plan.name).toBe(before.name);usePlanner.getState().redo();expect(usePlanner.getState().plan.name).toBe('Beta');});
it('accepts indented backups within the canonical limit and exports compactly',()=>{const p=createBlankPlan();const raw=serializePlan(p);expect(raw).toBe(JSON.stringify(p));expect(parsePlan(JSON.stringify(p,null,2))).toEqual(p);expect(()=>parsePlan(' '.repeat(32_000_001))).toThrow(/limit/);});
it('keeps ordered overlapping sculpt operations when indexed',()=>{const p=createBlankPlan();p.environment={background:'plain',grass:'off',terrain:[{kind:'raise',radius:2,strength:1,points:[{x:-20,z:-20},{x:-10,z:-20}]},{kind:'river',radius:2,strength:.5,points:[{x:-15,z:-20}]}]};expect(terrainSampler(p)(-15,-20).height).toBeCloseTo(-.65);expect(terrainSampler(p)(-18,-20).height).toBeCloseTo(.85);expect(terrainSampler(p)(100,100).height).toBe(-.15);});

import LZString from 'lz-string';
import {readFileSync} from 'node:fs';
import {decodeBoundedShare} from '../src/boundedLz';
import {imageDimensions} from '../src/imageDimensions';
import {ShallowWater} from '../src/shallowWater';
it('bounds legacy decompression before allocating an oversized result',()=>{const encoded=readFileSync(new URL('./fixtures/oversize-share.txt',import.meta.url),'utf8');expect(()=>decodeBoundedShare(encoded)).toThrow();for(const value of ['','Hello 🌿 中文','a'.repeat(100000)])expect(decodeBoundedShare(LZString.compressToEncodedURIComponent(value))).toBe(value);});
it('reads PNG dimensions before pixel decoding and rejects truncated input',()=>{const bytes=new Uint8Array(24);bytes.set([137,80,78,71]);const view=new DataView(bytes.buffer);view.setUint32(16,100000);view.setUint32(20,100000);expect(imageDimensions(bytes)).toEqual({width:100000,height:100000});expect(()=>imageDimensions(bytes.slice(0,8))).toThrow();});
it('displaces foundation water without losing volume and sleeps at rest',()=>{const water=new ShallowWater(5,1,1);water.depth[12]=2;const blocked=new Uint8Array(25);blocked[12]=1;water.setTerrain(new Float64Array(25),new Uint8Array(25),blocked);expect(water.depth[12]).toBe(0);expect(water.volume()).toBeCloseTo(2);const still=new ShallowWater(5,1,1);still.depth.fill(1);for(let i=0;i<100;i++)still.step();expect(still.asleep).toBe(true);expect(still.step()).toBe(false);still.setTerrain(new Float64Array(25),new Uint8Array(25));expect(still.asleep).toBe(false);});

import {TerrainField} from '../src/terrainField';
it('updates terrain cache after extending, undoing and moving a stroke',()=>{const p=createBlankPlan();p.floors=[];p.environment={background:'plain',grass:'off',terrain:[{kind:'lower',radius:2,strength:.5,points:[{x:0,z:0}]}]};const field=new TerrainField();for(const points of [[{x:0,z:0}],[{x:0,z:0},{x:4,z:0}],[{x:-3,z:-3}],[]]){p.environment.terrain![0].points=points;const samples=field.sample(p,-5,-5,1,1,10),sample=terrainSampler(p);for(let z=0;z<=10;z++)for(let x=0;x<=10;x++)expect(samples[z*11+x]).toEqual(sample(x-5,z-5));}});
