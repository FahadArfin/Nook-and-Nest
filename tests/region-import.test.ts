import {expect,it} from 'vitest';
import {createSamplePlan,parsePlan,serializePlan} from '../src/domain';
import {draftFromRecognition} from '../src/blueprintRecognition';
import {blueprintPlan,combineBlueprintRooms,draftFromFloor,roomGroups,fixtureAt} from '../src/blueprint';
import {validateRecognition,type Recognition} from '../src/recognitionContract';
import {floorRects} from '../src/floorGeometry';
import {addUnassignedRegions} from '../src/recognitionRegions';
const detection=():Recognition=>({regionReview:true,rooms:[
  {roomId:'main',name:'Bedroom',kind:'Bedroom',x:0,y:0,width:400,height:300,enclosed:false,note:''},
  {roomId:'entry',name:'Entry region',kind:'Hall',x:0,y:300,width:100,height:100,enclosed:false,note:''},
  {roomId:'entry',name:'Entry region',kind:'Hall',x:0,y:400,width:200,height:100,enclosed:false,note:''},
  {roomId:'bath',name:'Bathroom',kind:'Bathroom',x:100,y:300,width:300,height:100,enclosed:false,note:''},
],walls:[{ax:100,ay:300,bx:400,by:300}],fixtures:[],dimensions:[],warnings:[]});
it('imports independent concave regions and combines without filling the bathroom or deleting physical walls',()=>{
  const base=createSamplePlan();base.furniture=[];const id=base.floors[0].id;
  const {draft}=draftFromRecognition(base,id,detection(),10),before=structuredClone(draft);
  expect(roomGroups(draft.rooms)).toHaveLength(3);expect(draft.rooms.every(r=>!r.enclosed)).toBe(true);
  const joined=combineBlueprintRooms(draft,'scan-room-0','scan-room-1',base.gridSizeMm);
  expect(roomGroups(joined.rooms)).toHaveLength(2);expect(roomGroups(joined.rooms)[0].parts).toHaveLength(3);
  expect(joined.walls).toEqual(before.walls);expect(joined.fixtures).toEqual(before.fixtures);expect(draft).toEqual(before);
  const area=(d:typeof draft)=>floorRects(blueprintPlan(base,id,d).floors[0],base.gridSizeMm).reduce((s,r)=>s+r.width*r.depth,0);
  expect(area(joined)).toBe(area(before));expect(joined.rooms[3]).toEqual(before.rooms[3]);
  const saved=blueprintPlan(base,id,joined),reopened=draftFromFloor(parsePlan(serializePlan(saved)),id);
  expect(roomGroups(reopened.rooms)).toHaveLength(2);expect(reopened.walls).toEqual(joined.walls);
});
it('preserves an opening and its generated supporting divider during a label join',()=>{
  const base=createSamplePlan();base.furniture=[];const id=base.floors[0].id;
  const scan=detection();scan.rooms=scan.rooms.slice(0,2);scan.regionReview=false;scan.rooms.forEach(r=>r.enclosed=true);
  const {draft}=draftFromRecognition(base,id,scan,10),plan=blueprintPlan(base,id,draft);
  draft.fixtures=[{...fixtureAt(plan,id,'door-flush',500,3000),x:500,z:3000,rotation:0,widthMm:800}];
  const joined=combineBlueprintRooms(draft,draft.rooms[0].id,draft.rooms[1].id,base.gridSizeMm);
  expect(joined.fixtures).toEqual(draft.fixtures);expect(joined.walls.length).toBeGreaterThan(0);
  expect(blueprintPlan(base,id,joined).floors[0].walls.length).toBeGreaterThan(0);
});
it('rejects malformed wall evidence before it reaches the editor',()=>{
  expect(()=>validateRecognition({...detection(),walls:[{ax:10,ay:10,bx:20,by:20}]},500,500)).toThrow('wall');
  expect(()=>validateRecognition({...detection(),walls:[{ax:-1,ay:0,bx:20,by:0}]},500,500)).toThrow('wall');
});
it('offers an enclosed missing connector without assigning ownership or filling exterior space',()=>{
  const r=detection();r.rooms=[
    {...r.rooms[0],x:20,y:20,width:180,height:80},
    {...r.rooms[1],x:20,y:100,width:40,height:160},
    {...r.rooms[3],x:120,y:100,width:80,height:160},
  ];
  const solved=addUnassignedRegions(r,500,500,[{axis:'h',x:20,y:260,width:180,height:8}]);
  const extra=solved.rooms.filter(p=>p.roomId?.startsWith('unassigned'));
  expect(extra).toHaveLength(1);expect(extra[0]).toMatchObject({x:60,y:100,width:60,height:160,enclosed:false,name:'Unassigned region 1'});
  expect(solved.rooms.slice(0,3)).toEqual(r.rooms);
  expect(addUnassignedRegions(r,500,500,[]).rooms).toEqual(r.rooms);
});
