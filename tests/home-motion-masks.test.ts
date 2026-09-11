import {it,expect} from 'vitest';
import {motionPatches,motionMaskAlpha} from '../src/homeMotionMasks';
it('excludes the cat pillow, curtain plants and shelf from every moving mask',()=>{
 const protectedPixels={rain:[[1100,532],[1199,534],[1068,565]],morning:[[787,316],[808,406],[1233,191],[1270,230],[1310,290]],fire:[[940,427],[1062,443],[1160,682]]};
 for(const [scene,points] of Object.entries(protectedPixels))for(const [x,y] of points)
  for(const p of motionPatches[scene as keyof typeof motionPatches])expect(motionMaskAlpha(p,x,y),`${scene}: ${x},${y}`).toBe(0);
});
it('retains the moving interiors and feathers only inward',()=>{
 for(const [scene,x,y] of [['rain',1142,583],['morning',808,170],['fire',1190,643]] as const)
  expect(motionPatches[scene].some(p=>motionMaskAlpha(p,x,y)===1)).toBe(true);
 for(const patches of Object.values(motionPatches))for(const p of patches){
  for(const [x,y] of p.outline)expect(motionMaskAlpha(p,x,y)).toBe(0);
  expect(motionMaskAlpha(p,p.x-1,p.y-1)).toBe(0);
 }
});
