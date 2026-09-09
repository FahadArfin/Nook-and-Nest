import {expect,it} from 'vitest';
import {meadowSample} from '../src/meadowScatter';

it('keeps samples stable across camera traversal and density changes',()=>{
  const before=Array.from({length:8},(_,i)=>meadowSample(-17,23,i));
  for(let x=-5;x<5;x++)for(let i=0;i<22;i++)meadowSample(x,4,i);
  expect(Array.from({length:22},(_,i)=>meadowSample(-17,23,i)).slice(0,8)).toEqual(before);
});

it('does not repeat the same rows in neighbouring metre tiles',()=>{
  const offsets=new Set<string>();
  for(let x=-10;x<10;x++)for(let z=-10;z<10;z++){
    const p=meadowSample(x,z,0);
    offsets.add(`${(p.x-x).toFixed(6)}:${(p.z-z).toFixed(6)}`);
    expect(p.x).toBeGreaterThanOrEqual(x);expect(p.x).toBeLessThan(x+1);
    expect(p.z).toBeGreaterThanOrEqual(z);expect(p.z).toBeLessThan(z+1);
    expect(p.widthScale).toBeGreaterThanOrEqual(.82);expect(p.widthScale).toBeLessThan(1.18);
    expect(p.heightScale).toBeGreaterThanOrEqual(.78);expect(p.heightScale).toBeLessThan(1.22);
  }
  expect(offsets.size).toBe(400);
});
