import {describe,expect,it} from 'vitest';
import {catalog} from '../src/catalog';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {createFitReviewEvaluator,defaultFitReviewSettings,footprintGap,normalizeFitReviewSettings} from '../src/fitReview';
import type {FurniturePlacement} from '../src/types';

const room=()=>{const p=createSamplePlan('Fit tests','metric');p.gridSizeMm=1000;p.floors=p.floors.map(f=>({...f,cells:rectangleCells(20,20)}));return p;};
const piece=(floorId:string,id:string,extra:Partial<FurniturePlacement>={}):FurniturePlacement=>({id,floorId,catalogId:'side-table',x:5000,z:5000,rotation:0,widthMm:500,depthMm:500,heightMm:500,variant:'oat',...extra});
const settings={...defaultFitReviewSettings,enabled:true,checkGaps:false,checkChairs:false};

describe('optional practical fit review',()=>{
  it('measures the shortest rotated footprint gap and respects the user threshold',()=>{
    const rotate=(x:number,z:number)=>({x:(x+z)/Math.sqrt(2),z:(z-x)/Math.sqrt(2)});
    const a=[[-500,-200],[500,-200],[500,200],[-500,200]].map(([x,z])=>rotate(x,z));
    const b=[[-500,-200],[500,-200],[500,200],[-500,200]].map(([x,z])=>rotate(x+1600,z));
    expect(footprintGap(a,b).distance).toBeCloseTo(600,6);
    const plan=room(),floor=plan.floors[0].id;plan.furniture=[piece(floor,'a'),piece(floor,'b',{x:5750})];
    const evaluator=createFitReviewEvaluator(),first=evaluator.evaluate(plan,floor,{...settings,checkGaps:true,passageMm:300});
    const gap=first.issues.find(i=>i.kind==='gap'&&i.itemIds.includes('b'))!;
    expect(gap.measuredMm).toBe(250);expect(gap.requiredMm).toBe(300);expect(gap.itemIds).toEqual(['a','b']);
    expect(evaluator.evaluate(plan,floor,{...settings,checkGaps:true,passageMm:200}).issues.some(i=>i.kind==='gap')).toBe(false);
  });
  it('keeps chair pull-out separate from passage width and measures the free reach behind the seat',()=>{
    const p=room(),floor=p.floors[0].id;p.furniture=[piece(floor,'chair',{catalogId:'dining-chair'}),piece(floor,'cabinet',{z:4350,depthMm:300})];
    const result=createFitReviewEvaluator().evaluate(p,floor,{...settings,checkChairs:true,chairPulloutMm:600,passageMm:1200});
    const warning=result.issues.find(i=>i.kind==='chair-pullout'&&i.itemIds.includes('cabinet'))!;
    expect(warning.measuredMm).toBe(250);expect(warning.requiredMm).toBe(600);expect(warning.approximate).toBe(true);
    expect(result.issues.some(i=>i.kind==='gap')).toBe(false);
  });
  it('uses opt-in authored door envelopes, allows changing the swing side, and omits doorless openings',()=>{
    const p=room(),floor=p.floors[0].id;p.floors[0].walls=[{id:'partition',ax:2,az:4,bx:8,bz:4}];
    p.furniture=[piece(floor,'door',{catalogId:'door-flush',x:5000,z:4000,widthMm:950,depthMm:160,heightMm:2150}),piece(floor,'blocker',{x:5100,z:4300,widthMm:200,depthMm:200})];
    const evaluator=createFitReviewEvaluator();expect(evaluator.evaluate(p,floor,settings).issues.some(i=>i.kind==='door-swing')).toBe(false);
    const active=evaluator.evaluate(p,floor,{...settings,checkDoors:true});const warning=active.issues.find(i=>i.kind==='door-swing'&&i.itemIds.includes('blocker'))!;
    expect(warning.requiredMm).toBe(822);expect(warning.measuredMm).toBeGreaterThan(400);expect(warning.approximate).toBe(true);expect(warning.message).toContain('hinge');
    const flipped=evaluator.evaluate(p,floor,{...settings,checkDoors:true,doorOverrides:{door:{side:'back',hinge:'left'}}});expect(flipped.issues.some(i=>i.kind==='door-swing')).toBe(false);
    const open={...p,furniture:p.furniture.map(i=>i.id==='door'?{...i,doorless:true}:i)};
    expect(evaluator.evaluate(open,floor,{...settings,checkDoors:true}).issues.some(i=>i.kind==='door-swing')).toBe(false);
  });
  it('checks only a metadata-supported drawer construction and labels its assumed extension',()=>{
    const p=room(),floor=p.floors[0].id;p.furniture=[piece(floor,'filing',{catalogId:'office-filing-cabinet',widthMm:510,depthMm:450,heightMm:1200}),piece(floor,'blocker',{z:5500,depthMm:200}),piece(floor,'unlisted',{catalogId:'nightstand',x:8500})];
    const r=createFitReviewEvaluator().evaluate(p,floor,{...settings,checkDrawers:true});const warning=r.issues.find(i=>i.kind==='drawer-opening')!;
    expect(warning.itemIds).toEqual(['filing','blocker']);expect(warning.measuredMm).toBe(175);expect(warning.requiredMm).toBe(416);expect(warning.message).toContain('approximate planning allowance');
    expect(r.issues.filter(i=>i.kind==='drawer-opening').every(i=>i.itemIds[0]==='filing')).toBe(true);
  });
  it('preserves a door aperture and refreshes wall collisions when that doorway is removed',()=>{
    const p=room(),floor=p.floors[0].id;p.floors[0].walls=[{id:'partition',ax:2,az:4,bx:8,bz:4}];
    p.furniture=[piece(floor,'door',{catalogId:'door-flush',x:5000,z:4000,widthMm:950,depthMm:160,heightMm:2150}),piece(floor,'at-opening',{x:5000,z:4000,widthMm:300,depthMm:300})];
    const evaluator=createFitReviewEvaluator();expect(evaluator.evaluate(p,floor,settings).issues.some(i=>i.kind==='overlap')).toBe(false);
    const closed={...p,furniture:p.furniture.filter(i=>i.id!=='door')};const result=evaluator.evaluate(closed,floor,settings);
    expect(result.issues.some(i=>i.kind==='overlap'&&i.title.includes('wall'))).toBe(true);expect(result.stats.recomputedIds).toEqual(['at-opening']);
  });
  it('finds concave interior holes, diagonal edge crossings and existing stair openings',()=>{
    const p=room(),floor=p.floors[0];floor.cells=rectangleCells(3,3).filter(c=>c.x!==1||c.z!==1);p.furniture=[piece(floor.id,'bridge',{x:1500,z:1500,widthMm:2400,depthMm:2400})];
    const evaluator=createFitReviewEvaluator();const hole=evaluator.evaluate(p,floor.id,settings).issues.find(i=>i.kind==='floor-edge')!;expect(hole.outsideAreaMm2).toBeCloseTo(1_000_000);
    const angled={...p,floors:[{...floor,cells:[{x:0,z:0}],cellRects:{'0,0':[{x:0,z:0,width:1000,depth:1000,polygon:[{x:0,z:0},{x:1000,z:0},{x:0,z:1000}]}]}}],furniture:[piece(floor.id,'outside',{x:800,z:800,widthMm:200,depthMm:200})]};
    expect(evaluator.evaluate(angled,floor.id,settings).issues.some(i=>i.kind==='floor-edge')).toBe(true);
    const stairs=room(),[lower,upper]=stairs.floors;stairs.furniture=[piece(lower.id,'stairs',{catalogId:'stairs-traditional',x:5000,z:5000,widthMm:1000,depthMm:2000,toFloorId:upper.id}),piece(upper.id,'over-hole')];
    expect(evaluator.evaluate(stairs,upper.id,settings).issues.some(i=>i.kind==='floor-edge'&&i.itemIds.includes('over-hole'))).toBe(true);
  });
  it('recomputes affected neighbors after movement/removal, while reusing distant and material-only results',()=>{
    const p=room(),floor=p.floors[0].id;p.furniture=[piece(floor,'a'),piece(floor,'b',{x:5750}),piece(floor,'far',{x:15000,z:15000}),piece(floor,'far-neighbor',{x:15750,z:15000})];
    const evaluator=createFitReviewEvaluator(),s={...settings,checkGaps:true,passageMm:400};const first=evaluator.evaluate(p,floor,s),far=first.issues.find(i=>i.itemIds.includes('far'));
    const moved={...p,furniture:p.furniture.map(i=>i.id==='b'?{...i,x:6500}:i)};const next=evaluator.evaluate(moved,floor,s);
    expect(next.stats.recomputedIds.sort()).toEqual(['a','b']);expect(next.issues.find(i=>i.itemIds.includes('far'))).toBe(far);expect(next.issues.some(i=>i.itemIds.includes('a'))).toBe(false);
    const recolored={...moved,furniture:moved.furniture.map(i=>({...i,variant:'rose'}))};expect(evaluator.evaluate(recolored,floor,s).stats.recomputed).toBe(0);
    const removed={...recolored,furniture:recolored.furniture.filter(i=>i.id!=='far-neighbor')};const final=evaluator.evaluate(removed,floor,s);expect(final.issues.some(i=>i.itemIds.includes('far-neighbor'))).toBe(false);expect(final.stats.recomputedIds).toContain('far');
  });
  it('skips dense outdoor vegetation, clears overlays when off and never mutates the source',()=>{
    const p=room(),floor=p.floors[0].id,plant=catalog.find(c=>c.category==='Outdoor'&&c.shape==='plant')!;
    p.furniture=[piece(floor,'chair'),...Array.from({length:10000},(_,i)=>piece(floor,`plant-${i}`,{catalogId:plant.id}))];const original=JSON.stringify(p),evaluator=createFitReviewEvaluator();
    const result=evaluator.evaluate(p,floor,settings);expect(result.stats.checked).toBe(1);expect(result.stats.skippedVegetation).toBe(10000);
    const off=evaluator.evaluate(p,floor,{...settings,enabled:false});expect(off.overlays).toEqual([]);expect(off.issues).toEqual([]);expect(JSON.stringify(p)).toBe(original);
  });
  it('bounds malformed preferences without storing them in the plan',()=>{
    expect(normalizeFitReviewSettings({passageMm:Infinity,chairPulloutMm:20000}).passageMm).toBe(900);expect(normalizeFitReviewSettings({chairPulloutMm:20000}).chairPulloutMm).toBe(1500);
  });
});
