// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {createSamplePlan,rectangleCells} from '../src/domain';
import {geometryKey} from '../src/blueprint';
import {floorBoundaryWalls} from '../src/floorGeometry';
import {floorQuantityGeometry} from '../src/surfaceGeometry';
import {defaultTakeoffSettings,evaluateSurfaceQuantities,parseSurfaceTakeoffSettings,purchasingQuantity,stripSurfaceTakeoffSettings,updateSurfaceTakeoffSettings,type TakeoffPlan,type QuantitySurface} from '../src/surfaceTakeoff';
import {wallElevation,wallElevationSvg} from '../src/wallElevation';
import {elevationPrintHtml,surfaceQuantitiesCsv,surfaceQuantitiesHtml} from '../src/surfaceExports';
import {windowProblem} from '../src/windows';
import type {FurniturePlacement} from '../src/types';

export function rectangularPlan():TakeoffPlan {const p=createSamplePlan('Measured home','metric');p.gridSizeMm=1000;p.floors=[{...p.floors[0],id:'ground',name:'Ground',heightMm:2500,elevationMm:0,cells:rectangleCells(4,3),walls:[],openings:[],stairs:[]}];p.furniture=[];return p;}
const item=(patch:Partial<FurniturePlacement>={}):FurniturePlacement=>({id:'window',catalogId:'window-casement',floorId:'ground',x:3000,z:0,widthMm:1000,depthMm:220,heightMm:1000,rotation:0,elevationMm:1000,variant:'cream',...patch});
const total=(p:TakeoffPlan,surface:QuantitySurface,settings=defaultTakeoffSettings())=>evaluateSurfaceQuantities(p,settings).rows.filter(r=>r.surface===surface).reduce((sum,r)=>{expect(r.netM2).not.toBeNull();return sum+r.netM2!;},0);

describe('model surface quantities',()=>{
  it('counts each floor union once and exposes explicit one/two wall-face choices',()=>{
    const p=rectangularPlan(),s=defaultTakeoffSettings();
    expect(total(p,'floor')).toBe(12);expect(total(p,'wall')).toBe(35);
    expect(total(p,'wall',{...s,wallFaces:'exterior'})).toBe(35);
    expect(total(p,'wall',{...s,wallFaces:'both'})).toBe(70);
    expect(evaluateSurfaceQuantities(p).rows.find(r=>r.surface==='ceiling')?.netM2).toBeNull();
    expect(total(p,'ceiling',{...s,ceiling:'floor-projection'})).toBe(12);
    const cached=floorQuantityGeometry(p,'ground'),repriced=evaluateSurfaceQuantities(p,{...s,rates:{...s.rates,wall:{...s.rates.wall,wastePercent:30}}});expect(repriced.rows.find(r=>r.surface==='wall')?.requiredM2).toBe(45.5);expect(floorQuantityGeometry(p,'ground')).toBe(cached);
  });
  it('deducts the actual trimmed model apertures and preserves gross-only mode',()=>{
    const p=rectangularPlan();p.furniture=[item(),item({id:'door',catalogId:'door-flush',x:1000,heightMm:2000,elevationMm:0})];
    for(const opening of p.furniture)expect(windowProblem(p,opening)).toBeUndefined();
    // 1 m window has a 0.95 × 0.95 m clear opening; door is 0.95 × 1.975 m.
    expect(total(p,'wall')).toBeCloseTo(35-.95*.95-.95*1.975,6);
    expect(total(p,'wall',{...defaultTakeoffSettings(),deductOpenings:false})).toBe(35);
  });
  it('measures L-shaped outlines, a removed boundary section, and an explicit short partition',()=>{
    const p=rectangularPlan();p.floors[0].cells=[{x:0,z:0},{x:1,z:0},{x:0,z:1}];
    expect(total(p,'floor')).toBe(3);expect(total(p,'wall')).toBe(20);
    const cut=structuredClone(p);cut.floors[0].wallCuts=[{id:'cut',ax:0,az:0,bx:1,bz:0}];expect(total(cut,'wall')).toBe(17.5);
    const partition=rectangularPlan();partition.floors[0].walls=[{id:'half-height',ax:1,az:0,bx:1,bz:2,heightMm:1250}];expect(total(partition,'wall')).toBe(40);
  });
  it('unions repeated triangular shapes and measures their diagonal boundary without snapping',()=>{
    const p=rectangularPlan(),triangle={x:0,z:0,width:1000,depth:1000,polygon:[{x:0,z:0},{x:1000,z:0},{x:0,z:1000}]};p.floors[0].cells=[{x:0,z:0}];p.floors[0].cellRects={'0,0':[triangle,structuredClone(triangle)]};
    expect(total(p,'floor')).toBeCloseTo(.5,8);expect(total(p,'wall')).toBeCloseTo((2+Math.SQRT2)*2.5,5);
    const cut=structuredClone(p);cut.floors[0].wallCuts=[{id:'diagonal-cut',ax:1,az:0,bx:.5,bz:.5}];expect(total(cut,'wall')).toBeCloseTo((2+Math.SQRT2/2)*2.5,5);
  });
  it('counts room overlaps once and keeps courtyards distinguishable from verified exterior',()=>{
    const p=rectangularPlan(),floor=p.floors[0];floor.blueprint={geometryKey:geometryKey(floor),rooms:[{id:'a',name:'A',kind:'Living',enclosed:true,x:0,z:0,width:3000,depth:3000},{id:'b',name:'B',kind:'Living',enclosed:true,x:2000,z:0,width:2000,depth:3000}]};
    const rooms=evaluateSurfaceQuantities(p).rows.filter(r=>r.surface==='floor');expect(rooms.map(r=>[r.roomName,r.netM2])).toEqual([['A',6],['B',3],['Overlapping rooms',3]]);
    const courtyard=rectangularPlan();courtyard.floors[0].cells=rectangleCells(3,3).filter(c=>c.x!==1||c.z!==1);
    expect(total(courtyard,'floor')).toBe(8);expect(total(courtyard,'wall',{...defaultTakeoffSettings(),wallFaces:'exterior'})).toBe(40);
    expect(evaluateSurfaceQuantities(courtyard,{...defaultTakeoffSettings(),wallFaces:'exterior'}).rows.find(r=>r.surface==='wall')?.warnings.join(' ')).toContain('courtyard');
  });
  it('deducts inbound stair voids on their receiving floor only',()=>{
    const p=rectangularPlan();p.floors.push({...structuredClone(p.floors[0]),id:'upper',name:'Upper',elevationMm:2800});p.furniture=[item({catalogId:'stairs-traditional',id:'stairs',x:2000,z:1500,widthMm:1000,depthMm:2000,heightMm:2800,elevationMm:0,toFloorId:'upper',stairRiseMm:2800})];
    const rows=evaluateSurfaceQuantities(p).rows.filter(r=>r.surface==='floor');expect(rows.find(r=>r.floorId==='ground')?.netM2).toBe(12);expect(rows.find(r=>r.floorId==='upper')?.netM2).toBe(10);
  });
  it('separates floor and wall finishes and coverage overrides without changing geometry',()=>{
    const p=rectangularPlan(),f=p.floors[0],host=floorBoundaryWalls(f,1000).find(w=>w.az===0&&w.bz===0)!;f.cellFinishes={'0,0':'moss-carpet'};f.wallFinishes={[host.id]:'sage-plaster'};const before=JSON.stringify(p),s=defaultTakeoffSettings();s.finishRates=[{surface:'floor',finishId:'moss-carpet',wastePercent:20,coats:1,coverageM2PerUnit:.5,unitLabel:'tile pack'}];
    const rows=evaluateSurfaceQuantities(p,s).rows;expect(rows.find(r=>r.finishId==='moss-carpet')).toMatchObject({netM2:1,requiredM2:1.2,purchaseUnits:3});expect(rows.find(r=>r.finishId==='honey-oak')?.netM2).toBe(11);expect(rows.find(r=>r.finishId==='sage-plaster')?.netM2).toBe(2.5);expect(JSON.stringify(p)).toBe(before);
  });
  it('never substitutes zero for absent legacy opening or wall heights',()=>{
    const p=rectangularPlan(),floor=p.floors[0],host=floorBoundaryWalls(floor,1000)[0];floor.openings=[{id:'legacy',kind:'door',wallKey:host.id,offset:.5,widthMm:600}];
    expect(evaluateSurfaceQuantities(p).rows.find(r=>r.surface==='wall')?.netM2).toBeNull();
    const measured={...defaultTakeoffSettings(),legacyOpenings:[{floorId:'ground',openingId:'legacy',heightMm:2000,sillMm:0}]};expect(total(p,'wall',measured)).toBeCloseTo(33.8,8);
    expect(total(p,'wall',{...defaultTakeoffSettings(),deductOpenings:false})).toBe(35);
    const bad=rectangularPlan();bad.floors[0].heightMm=NaN;expect(evaluateSurfaceQuantities(bad).rows.find(r=>r.surface==='wall')?.netM2).toBeNull();
    const orphan=structuredClone(p);orphan.floors[0].openings[0].wallKey='removed-wall';expect(evaluateSurfaceQuantities(orphan,measured).rows.find(r=>r.surface==='wall')?.netM2).toBeNull();
  });
  it('rounds purchased coverage per line, rejects invalid assumptions and stale edits, and strips private settings',()=>{
    const rate={wastePercent:10,coats:2,coverageM2PerUnit:5,unitLabel:'pack'};expect(purchasingQuantity(10,rate)).toEqual({requiredM2:22,purchaseUnits:5});expect(purchasingQuantity(10,{...rate,coverageM2PerUnit:null}).purchaseUnits).toBeNull();expect(purchasingQuantity(null,rate).requiredM2).toBeNull();
    const p=rectangularPlan(),s=defaultTakeoffSettings();expect(()=>parseSurfaceTakeoffSettings({...s,rates:{...s.rates,wall:{...rate,coats:1.5}}})).toThrow();expect(()=>updateSurfaceTakeoffSettings(p,structuredClone(p),s,()=>{})).toThrow(/changed/);
    const next=updateSurfaceTakeoffSettings(p,p,s,()=>{});expect(p.surfaceTakeoffSettings).toBeUndefined();expect(stripSurfaceTakeoffSettings(next).surfaceTakeoffSettings).toBeUndefined();expect(next.floors).toBe(p.floors);
  });
});

describe('wall drawings and portable exports',()=>{
  it('shows opposite fixture faces, mirrors openings, and writes a physical 1:50 scale bar with escaped notes',()=>{
    const p=rectangularPlan();p.name='<script>bad()</script>';p.furniture=[item({x:1000}),item({id:'cabinet',catalogId:'base-cabinet',x:2200,z:350,widthMm:600,depthMm:600,heightMm:900,elevationMm:0})];
    const plate=floorQuantityGeometry(p,'ground').plates.find(w=>w.ux===1&&w.line===0)!;
    const front=wallElevation(p,'ground',plate.key,undefined,{face:'front',scale:50,notes:'<img src=x onerror=alert(1)>'}),back=wallElevation(p,'ground',plate.key,undefined,{face:'back'});
    expect(front.fixtures).toHaveLength(1);expect(back.fixtures).toHaveLength(0);expect(front.openings[0].x).toBe(525);expect(back.openings[0].x).toBe(2525);
    for(const polygon of back.openings.flatMap(o=>o.polygon?[o.polygon]:[]))expect(Math.min(...polygon.map(p=>p.x))).toBeGreaterThan(2500);
    const svg=wallElevationSvg(front),doc=new DOMParser().parseFromString(svg,'image/svg+xml'),bar=doc.querySelector('[data-scale-bar-mm="1000"]')!;
    expect(doc.querySelector('parsererror')).toBeNull();expect(doc.documentElement.getAttribute('width')).toMatch(/mm$/);expect(Number(bar.getAttribute('x2'))-Number(bar.getAttribute('x1'))).toBe(20);expect(doc.querySelectorAll('script,img')).toHaveLength(0);expect(doc.documentElement.textContent).toContain('<script>bad()</script>');expect(svg).toContain('sill 1025 mm');expect(elevationPrintHtml(front)).toContain('@page{size:');
  });
  it('escapes spreadsheet formulas and HTML and identifies the model revision and unknown quantities',()=>{
    const p=rectangularPlan();p.name=' =HYPERLINK("evil")<script>';const report=evaluateSurfaceQuantities(p),csv=surfaceQuantitiesCsv(report),html=surfaceQuantitiesHtml(report);
    expect(csv).toContain('"\' =HYPERLINK(""evil"")<script>"');expect(csv).toContain(report.revision);expect(csv).toContain('Unknown');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('Unavailable');
  });
});
