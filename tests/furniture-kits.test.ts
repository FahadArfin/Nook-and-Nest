import {describe, expect, it} from 'vitest';
import {catalog, variants} from '../src/catalog';
import {createSamplePlan, rectangleCells} from '../src/domain';
import {buildKitPlacement, cozyStarterKits, createFurnitureKit, initialKitPosition, kitPieceProblem, parseFurnitureKit} from '../src/furnitureKits';
import {usePlanner} from '../src/store';
import type {FurniturePlacement} from '../src/types';

const room = () => {
  const plan = createSamplePlan('Kit test', 'metric'); plan.gridSizeMm = 1000;
  plan.floors = plan.floors.map(f => ({...f, cells: rectangleCells(8,8)}));
  return plan;
};
const piece = (floorId: string, id: string, catalogId = 'side-table', extra: Partial<FurniturePlacement> = {}): FurniturePlacement => {
  const item = catalog.find(c => c.id === catalogId)!;
  return {id, floorId, catalogId, x: 2500, z: 2500, rotation: 0, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, variant: 'sage', ...extra};
};

describe('private furniture snapshots and reusable placement', () => {
  it('copies only explicitly selected active-floor pieces, retaining exact editable fields without shared references', () => {
    const plan = room(), floor = plan.floors[0].id;
    plan.furniture = [piece(floor,'desk','compact-computer-desk',{x:2030.125,z:1718.75,rotation:12.5,widthMm:1111.5,depthMm:555.25,heightMm:770,elevationMm:12.5,moduleRun:true,surfaceVariant:'marble',materialColors:{wood:'#A1b2C3'}}), piece(floor,'monitor','desktop-monitor',{elevationMm:782.5}), piece(plan.floors[1].id,'upstairs')];
    const before = structuredClone(plan), kit = createFurnitureKit(plan,floor,['desk'],'  My work corner  ');
    expect(kit.name).toBe('My work corner'); expect(kit.pieces).toHaveLength(1);
    expect(kit.pieces[0]).toMatchObject({catalogId:'compact-computer-desk',x:0,z:0,rotation:12.5,widthMm:1111.5,depthMm:555.25,heightMm:770,elevationMm:12.5,moduleRun:true,surfaceVariant:'marble',materialColors:{wood:'#A1b2C3'}});
    expect(kit.pieces[0]).not.toHaveProperty('id'); expect(kit.pieces[0]).not.toHaveProperty('floorId');
    kit.pieces[0].materialColors!.wood = '#000000'; expect(plan).toEqual(before);
    for (const ids of [[],['upstairs'],['missing'],['desk','desk']]) expect(() => createFurnitureKit(plan,floor,ids,'Invalid')).toThrow();
  });

  it('reuses relative transforms, dimensions, colors and height as independent new pieces without touching the source', () => {
    const plan = room(), floor = plan.floors[0].id;
    plan.furniture = [piece(floor,'a','side-table',{x:2020.25,z:2010.5,rotation:22.5,widthMm:511.75}),piece(floor,'b','desktop-monitor',{x:2250.75,z:2110.75,rotation:-15,elevationMm:520,materialColors:{body:'#123456'}})];
    const before = structuredClone(plan), kit = createFurnitureKit(plan,floor,['a','b'],'Desk and screen');
    const result = buildKitPlacement(plan,plan.floors[1].id,kit,{x:5000.125,z:4000.5,rotation:90});
    const [a,b] = result.plan.furniture.slice(2);
    expect(a.x).toBe(5000.125); expect(a.z).toBe(4000.5); expect(a.rotation).toBe(112.5); expect(a.widthMm).toBe(511.75);
    expect(b.x).toBeCloseTo(5100.375,8); expect(b.z).toBeCloseTo(3770,8); expect(b.rotation).toBe(75); expect(b.elevationMm).toBe(520); expect(b.materialColors).toEqual({body:'#123456'});
    expect(new Set([...plan.furniture.map(p=>p.id),...result.addedIds]).size).toBe(4);
    expect(result.plan.floors).toBe(plan.floors); expect(result.plan.furniture[0]).toBe(plan.furniture[0]); expect(plan).toEqual(before);
    b.materialColors!.body = '#000000'; expect(kit.pieces[1].materialColors!.body).toBe('#123456');
  });

  it('keeps preview out of history, applies all kit pieces in one undo and rejects a stale base', () => {
    usePlanner.getState().replacePlan(room());
    const base = usePlanner.getState().plan, floor = base.floors[0].id;
    const proposed = buildKitPlacement(base,floor,cozyStarterKits[0],initialKitPosition(base,floor,cozyStarterKits[0]));
    expect(usePlanner.getState().plan).toBe(base); expect(usePlanner.getState().past).toHaveLength(0);
    usePlanner.getState().commitDesign(base,proposed.plan); expect(usePlanner.getState().past).toHaveLength(1); expect(usePlanner.getState().plan.furniture).toHaveLength(3);
    usePlanner.getState().undo(); expect(usePlanner.getState().plan).toEqual(base);
    usePlanner.getState().rename('Changed while reviewing'); const changed = usePlanner.getState().plan;
    expect(() => usePlanner.getState().commitDesign(base,proposed.plan)).toThrow(); expect(usePlanner.getState().plan).toBe(changed);
  });

  it('keeps unsupported catalog entries recoverable but refuses to place them or architecture', () => {
    const unknown = structuredClone(cozyStarterKits[0]); unknown.pieces[0].catalogId = 'retired-catalog-piece';
    expect(parseFurnitureKit(unknown).pieces[0].catalogId).toBe('retired-catalog-piece');
    const plan = room(); expect(() => buildKitPlacement(plan,plan.floors[0].id,unknown,{x:2000,z:2000,rotation:0})).toThrow('retired-catalog-piece');
    for (const item of catalog.filter(c => c.mount === 'wall' || c.mount === 'ceiling').slice(0,2)) expect(kitPieceProblem({catalogId:item.id})).toBeTruthy();
    expect(kitPieceProblem({catalogId:'side-table',terrainAnchored:true})).toContain('Terrain');
    expect(kitPieceProblem({catalogId:'side-table',toFloorId:'other'})).toContain('stairs');
  });

  it('rejects invalid saved snapshots and preview coordinates before creating a proposed plan', () => {
    const kit = cozyStarterKits[0];
    for (const value of [
      {...kit,pieces:[]}, {...kit,name:' '}, {...kit,version:2},
      {...kit,pieces:[{...kit.pieces[0],x:NaN}]}, {...kit,pieces:[{...kit.pieces[0],heightMm:0}]},
      {...kit,pieces:[{...kit.pieces[0],toFloorId:'hidden-link'}]},
      {...kit,pieces:[{...kit.pieces[0],materialColors:JSON.parse('{"__proto__":"#112233"}')}]},
    ]) expect(() => parseFurnitureKit(value)).toThrow();
    const plan = room(); expect(() => buildKitPlacement(plan,plan.floors[0].id,kit,{x:Infinity,z:0,rotation:0})).toThrow('valid');
    plan.floors[0].cells = []; expect(() => initialKitPosition(plan,plan.floors[0].id,kit)).toThrow('Draw a floor');
  });

  it('offers correctly facing independent starters that fit a room, with the monitor resting on its desk', () => {
    const plan = room(), floor = plan.floors[0].id;
    for (const kit of cozyStarterKits) {
      for (const p of kit.pieces) expect(Object.hasOwn(variants,p.variant)).toBe(true);
      const result = buildKitPlacement(plan,floor,kit,initialKitPosition(plan,floor,kit));
      expect(result.warnings).toEqual([]); expect(result.addedIds).toHaveLength(kit.pieces.length);
    }
    const dining = cozyStarterKits.find(k=>k.id==='starter-dining')!;
    for (const chair of dining.pieces.filter(p=>p.catalogId==='breakfast-nook-chair')) expect(Math.cos(chair.rotation*Math.PI/180) * -chair.z).toBeGreaterThan(0);
    const office = cozyStarterKits.find(k=>k.id==='starter-office')!, chair = office.pieces.find(p=>p.catalogId==='office-chair')!, desk = office.pieces.find(p=>p.catalogId==='compact-computer-desk')!, monitor = office.pieces.find(p=>p.catalogId==='desktop-monitor')!;
    expect(Math.cos(chair.rotation*Math.PI/180) * -chair.z).toBeGreaterThan(0); expect(monitor.elevationMm).toBe(desk.heightMm);
  });

  it('warns about existing furniture without moving it or blocking deliberate arrangement overlaps', () => {
    const plan = room(), floor = plan.floors[0].id; plan.furniture = [piece(floor,'existing','armchair')];
    const one = {...cozyStarterKits[0],pieces:[cozyStarterKits[0].pieces[0]]};
    const result = buildKitPlacement(plan,floor,one,{x:2500,z:2500,rotation:0});
    expect(result.warnings.some(w=>w.kind==='overlap' && w.ids.includes('existing'))).toBe(true); expect(plan.furniture).toHaveLength(1);
  });
});
