import {expect,it} from 'vitest';
import {extractWallCandidates} from '../src/recognitionEvidence';
import {addUnassignedRegions} from '../src/recognitionRegions';
import type {Recognition} from '../src/recognitionContract';
import {draftFromRecognition} from '../src/blueprintRecognition';
import {createSamplePlan} from '../src/domain';
import {roomGroups} from '../src/blueprint';
const image=(size:number)=>{
  const pixels=new Uint8ClampedArray(size*size*4).fill(255);
  const ink=(x:number,y:number,w:number,h:number)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixels.fill(0,(j*size+i)*4,(j*size+i)*4+3);};
  return {pixels,ink};
};
it('retains solid L/T wall strips without turning the open corner into a wall',()=>{
  const {pixels,ink}=image(400);ink(40,40,260,16);ink(200,40,100,45);ink(280,40,20,240);
  const walls=extractWallCandidates(pixels,400,400);
  expect(walls.some(w=>w.solid&&w.x<=220&&w.x+w.width>=280&&w.y<=60&&w.y+w.height>=80)).toBe(true);
  for(const w of walls){expect(w.solid).toBe(true);for(let y=w.y;y<w.y+w.height;y++)for(let x=w.x;x<w.x+w.width;x++)expect(pixels[(y*400+x)*4]).toBe(0);}
  expect(walls.some(w=>w.x<150&&w.x+w.width>150&&w.y<70&&w.y+w.height>70)).toBe(false);
});
it('recovers an L-shaped entry when a main-room edge is inset from a thick exterior wall',()=>{
  const {pixels,ink}=image(400);ink(20,20,280,20);ink(20,20,20,280);ink(280,20,20,280);ink(20,280,280,20);
  const walls=extractWallCandidates(pixels,400,400);
  const part=(name:string,x:number,y:number,width:number,height:number)=>({roomId:name,name,kind:'Hall' as const,x,y,width,height,enclosed:false,note:''});
  const raw:Recognition={rooms:[part('Main',80,40,200,80),part('Bathroom',160,120,120,160),part('Hall',40,200,120,80)],dimensions:[],fixtures:[],warnings:[]};
  const previous=addUnassignedRegions(raw,400,400,walls.map(({solid,...w})=>w));
  expect(previous.rooms).toEqual(raw.rooms);
  const fixed=addUnassignedRegions(raw,400,400,walls),added=fixed.rooms.slice(raw.rooms.length);
  expect(added.length).toBeGreaterThan(0);
  expect(added.reduce((sum,r)=>sum+r.width*r.height,0)).toBe(40*80+120*80);
  expect(added.every(r=>r.x>=40&&r.y>=40&&r.x+r.width<=160&&r.y+r.height<=200)).toBe(true);
  expect(fixed.rooms.slice(0,raw.rooms.length)).toEqual(raw.rooms);
});
it('keeps source-adjacent polygon pieces together when minimum-size rounding makes them overlap',()=>{
  const base=createSamplePlan(),piece={roomId:'entry',name:'Entry',kind:'Hall' as const,enclosed:false,note:''};
  const scan:Recognition={regionReview:true,rooms:[{...piece,x:20,y:20,width:1,height:1},{...piece,x:10,y:21,width:11,height:80}],walls:[],dimensions:[],fixtures:[],warnings:[]};
  const {draft}=draftFromRecognition(base,base.floors[0].id,scan,8.5);
  expect(roomGroups(draft.rooms)).toHaveLength(1);
});
