import {expect,it} from 'vitest';
import {connectedRoomProposal,roomOutline} from '../src/connectedRooms';
import {roomGroups,type BlueprintDraft} from '../src/blueprint';
import {roomArea} from '../src/studioTools';
const empty:BlueprintDraft={rooms:[],walls:[],omittedWalls:[],fixtures:[]};
const line=(ax:number,az:number,bx:number,bz:number)=>({a:{x:ax,z:az},b:{x:bx,z:bz}});
const box=[line(0,0,6000,0),line(6000,0,6000,6000),line(6000,6000,0,6000),line(0,6000,0,0)];
it('finds four rooms across crossing walls with overshooting tails and no initial footprint',()=>{
  const result=connectedRoomProposal(empty,500,[...box,line(3000,-1000,3000,7000),line(-1000,3000,7000,3000)]);
  expect(result.count).toBe(4);expect(roomArea(result.rooms)).toBe(36e6);
  expect(roomGroups(result.rooms).every(g=>roomArea(g.parts)===9e6)).toBe(true);
});
it('uses an existing room boundary to complete adjoining boxes without duplicating that room',()=>{
  const old={id:'old',name:'Study',kind:'Office' as const,enclosed:true,x:0,z:0,width:3000,depth:3000};
  const draft={...empty,rooms:[old]};
  const result=connectedRoomProposal(draft,500,[line(3000,0,6000,0),line(6000,0,6000,6000),line(0,3000,0,6000),line(0,6000,6000,6000),line(3000,-1000,3000,7000),line(0,3000,6500,3000)]);
  expect(result.count).toBe(3);expect(result.rooms).toContain(old);expect(roomGroups(result.rooms)).toHaveLength(4);expect(roomArea(result.rooms)).toBe(36e6);
});
it('keeps an open gap connected to the exterior and ignores duplicate lines',()=>{
  expect(connectedRoomProposal(empty,500,box.slice(0,3)).count).toBe(0);
  expect(connectedRoomProposal(empty,500,[...box.slice(0,3),line(0,6000,0,100)]).count).toBe(0);
  expect(connectedRoomProposal(empty,500,[...box,...box,line(3000,0,3000,2000)]).count).toBe(1);
});
it('retains concave room area without decomposition seams and splits existing rooms on confirmation',()=>{
  const parts=[{x:0,z:0,width:3000,depth:6000},{x:3000,z:3000,width:3000,depth:3000}];
  const result=connectedRoomProposal(empty,500,roomOutline(parts));
  expect(result.count).toBe(1);expect(roomArea(result.rooms)).toBe(27e6);
  const split=connectedRoomProposal({...empty,rooms:result.rooms},500,[line(0,3000,6000,3000)]);
  expect(split.count).toBe(2);expect(roomArea(split.rooms)).toBe(27e6);
  expect(roomOutline(parts)).not.toContainEqual(line(3000,3000,3000,6000));
});
it('rejects unsafe or excessive input and preserves unrelated metadata',()=>{
  expect(()=>connectedRoomProposal(empty,500,[line(0,0,1000,1000)])).toThrow('horizontal or vertical');
  expect(()=>connectedRoomProposal(empty,500,Array(81).fill(box[0]))).toThrow('80 wall lines');
  const old={id:'remote',name:'Keep me',kind:'Bedroom' as const,enclosed:false,x:20000,z:0,width:3000,depth:3000};
  const result=connectedRoomProposal({...empty,rooms:[old]},500,box);
  expect(result.rooms).toContain(old);expect(result.count).toBe(1);
});
it('does not fill an untouched courtyard or split a remote room along old walls',()=>{
  const ring=[{x:20000,z:0,width:6000,depth:1000},{x:20000,z:1000,width:1000,depth:4000},{x:25000,z:1000,width:1000,depth:4000},{x:20000,z:5000,width:6000,depth:1000}].map((r,i)=>({...r,id:`ring:${i}`,groupId:'ring',name:'Courtyard home',kind:'Hall' as const,enclosed:true}));
  const old={id:'old',name:'Old room',kind:'Bedroom' as const,enclosed:false,x:30000,z:0,width:4000,depth:4000};
  const result=connectedRoomProposal({...empty,rooms:[...ring,old],walls:[{id:'oldwall',ax:64,az:0,bx:64,bz:8}]},500,box);
  expect(result.count).toBe(1);expect(roomArea(result.rooms)).toBe(72e6);expect(result.rooms).toContain(old);
  expect(ring.every(r=>result.rooms.includes(r))).toBe(true);
});
