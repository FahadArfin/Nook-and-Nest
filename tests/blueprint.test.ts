import { describe,expect,it } from 'vitest';
import { createSamplePlan,parsePlan,serializePlan,encodeShare,decodeShare } from '../src/domain';
import { catalog } from '../src/catalog';
import { autoFurnish, blueprintPlan, blueprintProblems, coveredByFloor, draftFromFloor, fixtureAt, floorFromRooms, footprint, mergeFloorRegions, roomDividers, type BlueprintDraft, type BlueprintRoom } from '../src/blueprint';
import { floorRects,floorBoundaryWalls } from '../src/floorGeometry';
import { checkReferenceFile,MAX_REFERENCE_BYTES } from '../src/blueprintImport';
import { usePlanner } from '../src/store';
const base=()=>{const p=createSamplePlan();p.gridSizeMm=250;p.furniture=[];p.floors=p.floors.slice(0,1);return p;};
const room=(patch:Partial<BlueprintRoom>={}):BlueprintRoom=>({id:'room',name:'Bedroom',kind:'Bedroom',x:0,z:0,width:4000,depth:4000,enclosed:true,...patch});
const draft=(rooms=[room()]):BlueprintDraft=>({rooms,walls:[],omittedWalls:[],fixtures:[]});
const area=(p:ReturnType<typeof base>)=>floorRects(p.floors[0],p.gridSizeMm).reduce((sum,r)=>sum+r.width*r.depth,0);

describe('floor plan imports and conversion',()=>{
  it('bounds supported input types and rejects empty/oversized files',()=>{
    for(const name of ['floor.pdf','scan.JPG','scan.webp','floor.png'])expect(()=>checkReferenceFile({name,type:'',size:1024})).not.toThrow();
    for(const [name,size] of [['floor.svg',10],['data.html',20],['floor.pdf',0],['floor.pdf',MAX_REFERENCE_BYTES+1]] as const)expect(()=>checkReferenceFile({name,type:'',size})).toThrow();
  });
  it('retains measured edges and arbitrary origins to the millimetre',()=>{
    const p=base(),r=room({x:137,z:-273,width:3811,depth:2877});const result=blueprintPlan(p,p.floors[0].id,draft([r]));
    expect(area(result)).toBeCloseTo(3811*2877,3);
    const edges=floorBoundaryWalls(result.floors[0],250);expect(Math.max(...edges.flatMap(w=>[w.ax,w.bx]))*250).toBeCloseTo(3948,5);
    expect(Math.min(...edges.flatMap(w=>[w.az,w.bz]))*250).toBeCloseTo(-273,5);
    expect(parsePlan(serializePlan(result))).toEqual(result);expect(decodeShare(encodeShare(result)).floors).toEqual(result.floors);
  });
  it('unions overlapping room areas without filling an L-shaped missing corner',()=>{
    const p=base(),rooms=[room({width:4000,depth:2000}),room({id:'r2',width:2000,depth:4000})],result=blueprintPlan(p,p.floors[0].id,draft(rooms));
    expect(area(result)).toBe(12_000_000);expect(coveredByFloor({x:3000,z:3000,width:200,depth:200},result.floors[0],250)).toBe(false);
    expect(mergeFloorRegions(floorRects(result.floors[0],250)).reduce((s,r)=>s+r.width*r.depth,0)).toBe(12_000_000);
  });
  it('creates one shared divider with partial room adjacency and no doubled outer walls',()=>{
    const p=base(),rooms=[room(),room({id:'r2',x:4000,depth:2000})],f=floorFromRooms(p.floors[0],250,rooms),walls=roomDividers(f,250,rooms);
    expect(walls).toHaveLength(1);expect(walls[0]).toMatchObject({ax:16,bx:16,az:0,bz:8});
    const result=blueprintPlan(p,p.floors[0].id,{...draft(rooms),omittedWalls:[walls[0].id]});expect(result.floors[0].walls).toHaveLength(0);
  });
  it('uses open room areas without adding internal partitions',()=>{
    const p=base(),rooms=[room({enclosed:false}),room({id:'r2',x:4000,enclosed:false})],result=blueprintPlan(p,p.floors[0].id,draft(rooms));expect(result.floors[0].walls).toHaveLength(0);
  });
  it('does not duplicate generated dividers when reopening the studio',()=>{
    const p=base(),rooms=[room(),room({id:'r2',x:4000})],result=blueprintPlan(p,p.floors[0].id,draft(rooms));
    const reopened=draftFromFloor(result,p.floors[0].id),second=blueprintPlan(result,p.floors[0].id,reopened);
    expect(second.floors[0].walls).toEqual(result.floors[0].walls);expect(reopened.rooms.map(r=>r.kind)).toEqual(['Bedroom','Bedroom']);
  });
  it('rebuilds stale room zones after geometry was edited in 3D',()=>{
    const p=base(),result=blueprintPlan(p,p.floors[0].id,draft());result.floors[0].cells=[];result.floors[0].cellRects={};
    expect(draftFromFloor(result,p.floors[0].id).rooms).toEqual([]);
  });
  it('validates room input before creating any plan mutation',()=>{
    const p=base(),before=structuredClone(p);
    for(const patch of [{width:NaN},{width:Infinity},{width:99},{depth:60001},{x:100001},{name:''},{kind:'Fake' as any}])expect(()=>blueprintPlan(p,p.floors[0].id,draft([room(patch)]))).toThrow();
    expect(()=>blueprintPlan(p,p.floors[0].id,draft([]))).toThrow();expect(p).toEqual(before);
  });
  it('keeps other floors and only removes inbound stair connections',()=>{
    const p=base(),id=p.floors[0].id,other={...structuredClone(p.floors[0]),id:'upper',elevationMm:3000,stairs:[{id:'s',kind:'straight' as const,x:0,z:0,rotation:0,widthMm:1000,lengthMm:3000,toFloorId:id}]};p.floors.push(other);
    const result=blueprintPlan(p,id,draft());expect(result.floors[1]).toEqual({...other,stairs:[]});expect(p.floors[1].stairs).toHaveLength(1);
  });
  it('starts with fixed kitchen, bathroom, laundry and openings only',()=>{
    const p=createSamplePlan(),id=p.floors[0].id;
    for(const cid of ['sofa','washer','dryer','door-flush']){const c=catalog.find(c=>c.id===cid)!;p.furniture.push({id:cid,catalogId:cid,floorId:id,x:1000,z:1000,rotation:0,widthMm:c.widthMm,depthMm:c.depthMm,heightMm:c.heightMm,variant:'sage'});}
    const d=draftFromFloor(p,id);expect(d.fixtures.some(f=>f.catalogId==='sofa')).toBe(false);expect(d.fixtures.some(f=>f.catalogId==='washer')).toBe(true);expect(d.fixtures.some(f=>f.catalogId==='dryer')).toBe(true);expect(d.fixtures.some(f=>f.catalogId==='door-flush')).toBe(true);
  });
  it('snaps catalog doors into walls and flags orphaned fixtures after room changes',()=>{
    const p=base(),id=p.floors[0].id,result=blueprintPlan(p,id,draft()),door=fixtureAt(result,id,'door-flush',2000,20);
    expect(door.z).toBe(0);result.furniture=[door];expect(blueprintProblems(result,id)).toEqual([]);
    const washer=fixtureAt(result,id,'washer',8000,8000);result.furniture.push(washer);expect(blueprintProblems(result,id).join()).toMatch(/outside the floor/);
    expect(()=>fixtureAt(result,id,'sofa',1000,1000)).toThrow();
  });
  it('commits conversion atomically with one undo and rejects a stale base',()=>{
    const p=base(),s=usePlanner.getState();s.replacePlan(p);const original=usePlanner.getState().plan,result=blueprintPlan(original,p.floors[0].id,draft());
    s.commitDesign(original,result);expect(usePlanner.getState().past).toHaveLength(1);s.undo();expect(usePlanner.getState().plan).toEqual(original);s.redo();expect(usePlanner.getState().plan.floors).toEqual(result.floors);
    expect(()=>s.commitDesign(original,result)).toThrow(/changed/);
  });
  it('rejects malformed persisted room metadata',()=>{
    const p=base(),result=blueprintPlan(p,p.floors[0].id,draft());result.floors[0].blueprint!.rooms[0].width=NaN;expect(()=>parsePlan(JSON.stringify(result))).toThrow();
  });
});

describe('automatic furnishing from the real library',()=>{
  it('creates a reviewable bedroom arrangement without mutating the home or model sizes',()=>{
    const p=base(),rooms=[room({width:5000,depth:5000})],plan=blueprintPlan(p,p.floors[0].id,draft(rooms)),before=structuredClone(plan),result=autoFurnish(plan,p.floors[0].id,rooms);
    expect(result.added.length).toBe(3);expect(plan).toEqual(before);
    for(const item of result.added){const c=catalog.find(c=>c.id===item.catalogId)!;expect([item.widthMm,item.depthMm,item.heightMm]).toEqual([c.widthMm,c.depthMm,c.heightMm]);expect(coveredByFloor(footprint(item),plan.floors[0],250)).toBe(true);}
    expect(autoFurnish(result.plan,p.floors[0].id,rooms).added).toHaveLength(0);
  });
  it('keeps fixtures and door clearance clear and does not fill service rooms',()=>{
    const p=base(),rooms=[room({width:5000,depth:5000}),room({id:'k',name:'Kitchen',kind:'Kitchen',x:5000,width:3000,depth:5000})],plan=blueprintPlan(p,p.floors[0].id,draft(rooms));
    plan.furniture=[fixtureAt(plan,p.floors[0].id,'door-flush',2500,0),fixtureAt(plan,p.floors[0].id,'washer',5500,500)];
    const result=autoFurnish(plan,p.floors[0].id,rooms);expect(result.plan.furniture.slice(0,2)).toEqual(plan.furniture);expect(result.added.every(f=>f.x<5000)).toBe(true);
    for(const f of result.added){const rect=footprint(f);expect(rect.z>=1100||rect.x+rect.width<=1900||rect.x>=3100).toBe(true);}
  });
  it('skips furniture that cannot fit a tiny room instead of scaling or clipping it',()=>{
    const p=base(),rooms=[room({width:600,depth:600})],plan=blueprintPlan(p,p.floors[0].id,draft(rooms)),result=autoFurnish(plan,p.floors[0].id,rooms);expect(result.added).toHaveLength(0);expect(result.skipped).toHaveLength(3);
  });
  it('never crosses inside walls even when room labels overlap them',()=>{
    const p=base(),rooms=[room({width:5000,depth:5000})],d=draft(rooms);d.walls=[{id:'divider',ax:10,az:0,bx:10,bz:20}];const plan=blueprintPlan(p,p.floors[0].id,d),result=autoFurnish(plan,p.floors[0].id,rooms);
    for(const f of result.added){const r=footprint(f);expect(r.x+r.width<=2440||r.x>=2560).toBe(true);}
  });
  it('places dining chairs around the table as separate selectable objects',()=>{
    const p=base(),rooms=[room({kind:'Dining',width:6000,depth:6000})],plan=blueprintPlan(p,p.floors[0].id,draft(rooms)),result=autoFurnish(plan,p.floors[0].id,rooms);
    expect(result.added.filter(f=>f.catalogId==='dining-chair')).toHaveLength(4);expect(new Set(result.added.map(f=>f.id)).size).toBe(5);
    const table=result.added.find(f=>f.catalogId==='dining-table')!;expect(table.x).toBe(3000);expect(table.z).toBe(3000);
  });
});
