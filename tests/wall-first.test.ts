import {expect,it} from 'vitest';
import {regionsFromWalls,scaleWallFirst,wallFirstProposal} from '../src/wallFirstGeometry';
import {blueprintPlan,combineBlueprintRooms,roomGroups,type BlueprintDraft} from '../src/blueprint';
import {createSamplePlan,parsePlan,serializePlan} from '../src/domain';
const draft=():BlueprintDraft=>({wallFirst:true,rooms:[{id:'home',name:'Home footprint',kind:'Hall',enclosed:false,x:0,z:0,width:6000,depth:6000}],walls:[
  {id:'bath-top',ax:2000,az:3000,bx:6000,bz:3000},
  {id:'bath-left',ax:2000,az:3000,bx:2000,bz:5000},
  {id:'bath-bottom',ax:2000,az:5000,bx:6000,bz:5000},
  {id:'hall-door-left',ax:0,az:5000,bx:1000,bz:5000},
],omittedWalls:[],fixtures:[],regionDividers:[]});
const at=(d:BlueprintDraft,x:number,z:number)=>d.rooms.find(r=>x>r.x&&x<r.x+r.width&&z>r.z&&z<r.z+r.depth)?.groupId;
const area=(d:BlueprintDraft)=>d.rooms.reduce((s,r)=>s+r.width*r.depth,0);
it('keeps the full L-shaped entry connected until the user closes the actual hallway doorway',()=>{
  const d=draft(),open=regionsFromWalls(d,1,d.walls);
  expect(roomGroups(open.rooms)).toHaveLength(2);expect(at(open,1500,4000)).toBe(at(open,3000,1000));expect(at(open,1500,4000)).toBe(at(open,3000,5500));
  d.regionDividers=[{id:'doorway',ax:1000,az:5000,bx:2000,bz:5000}];
  const closed=regionsFromWalls(d,1,d.walls);expect(roomGroups(closed.rooms)).toHaveLength(3);
  expect(at(closed,1500,4000)).toBe(at(closed,3000,1000));expect(at(closed,1500,4000)).not.toBe(at(closed,3000,5500));expect(at(closed,3000,4000)).not.toBe(at(closed,3000,1000));
  expect(area(closed)).toBe(36000000);expect(closed.walls).toEqual(d.walls);expect(closed.fixtures).toEqual(d.fixtures);
  const master=closed.rooms.find(r=>r.groupId===at(closed,3000,1000))!,hall=closed.rooms.find(r=>r.groupId===at(closed,3000,5500))!;
  const joined=combineBlueprintRooms(closed,master.id,hall.id,1);expect(area(joined)).toBe(area(closed));expect(roomGroups(joined.rooms)).toHaveLength(2);expect(joined.walls).toEqual(d.walls);
});
it('never turns a region divider into a physical 3D wall and persists the editable draft',()=>{
  const d=draft();d.regionDividers=[{id:'doorway',ax:1000,az:5000,bx:2000,bz:5000}];const base=createSamplePlan();base.furniture=[];base.floors=base.floors.slice(0,1);const grid=base.gridSizeMm;
  const scaled={...d,walls:d.walls.map(w=>({...w,ax:w.ax/grid,az:w.az/grid,bx:w.bx/grid,bz:w.bz/grid})),regionDividers:d.regionDividers.map(w=>({...w,ax:w.ax/grid,az:w.az/grid,bx:w.bx/grid,bz:w.bz/grid}))};
  const regions=regionsFromWalls(scaled,grid,scaled.walls),plan=blueprintPlan(base,base.floors[0].id,regions);
  expect(plan.floors[0].walls.some(w=>w.id==='doorway')).toBe(false);
  plan.studioDrafts={[base.floors[0].id]:{draft:regions,savedAt:new Date().toISOString(),imageScale:10,calibrated:true,view:{x:0,z:0,width:6000,height:6000}}};
  expect(parsePlan(serializePlan(plan)).studioDrafts?.[base.floors[0].id].draft.regionDividers).toEqual(scaled.regionDividers);
});
it('keeps holes and disconnected footprint parts rather than filling or dropping them',()=>{
  const d=draft();d.walls=[];d.rooms=[{...d.rooms[0],width:2000},{...d.rooms[0],id:'right',x:4000,width:2000},{...d.rooms[0],id:'top',x:2000,width:2000,depth:2000},{...d.rooms[0],id:'bottom',x:2000,z:4000,width:2000,depth:2000},{...d.rooms[0],id:'island',x:8000,width:1000,depth:1000}];
  const regions=regionsFromWalls(d,1,[]);expect(at(regions,3000,3000)).toBeUndefined();expect(roomGroups(regions.rooms)).toHaveLength(2);expect(area(regions)).toBe(area(d));
});
it('offers one local footprint across window interruptions, with no room-name guesses',()=>{
  const proposal=wallFirstProposal([{axis:'h',x:20,y:20,width:260,height:12},{axis:'h',x:20,y:280,width:260,height:12},{axis:'v',x:20,y:20,width:12,height:180},{axis:'v',x:268,y:20,width:12,height:80},{axis:'v',x:268,y:220,width:12,height:72}],320,320);
  expect(roomGroups(proposal.rooms)).toHaveLength(1);expect(proposal.rooms.some(r=>150>r.x&&150<r.x+r.width&&250>r.z&&250<r.z+r.depth)).toBe(true);expect(proposal.rooms.every(r=>r.name==='Home footprint'&&!r.enclosed)).toBe(true);
  expect(scaleWallFirst(proposal,2).rooms[0].width).toBe(proposal.rooms[0].width*2);
});
it('rejects tiny conflicting boundaries without silently deleting floor area',()=>{const d=draft();expect(()=>regionsFromWalls(d,1,[{id:'a',ax:0,az:0,bx:0,bz:6000},{id:'b',ax:1,az:0,bx:1,bz:6000}])).toThrow('10 mm');});
it('preserves the original footprint under calibration and rendered-boundary roundoff',()=>{const d=scaleWallFirst(draft(),.854434250764526);const result=regionsFromWalls(d,1,[...d.walls,{id:'rounded-edge',ax:0,az:0,bx:0,bz:5126.6055}]);expect(area(result)).toBeCloseTo(area(d),5);expect(result.rooms.every(r=>r.width>=10&&r.depth>=10)).toBe(true);});
