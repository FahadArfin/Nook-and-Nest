import {expect,it} from 'vitest';
import {missingFloorRegions,traceMissingFloor,type MissingFloorInput} from '../src/missingFloorGeometry';
import {applyMissingFloorRepair} from '../src/doorBoundaryCorrections';
import {createSamplePlan} from '../src/domain';
import type {BlueprintDraft} from '../src/blueprint';
import {validateRegionRequest,validateRegionAnswer} from '../src/regionReviewContract';
function input():MissingFloorInput {
  const width=240,height=200,walls=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<3||x>=237||y<3||y>=197||(x>=97&&x<=102&&(y<140||y>=170))||(y>=80&&x>=139&&x<=142)||(y>=79&&y<=82&&x>=140))walls[y*width+x]=1;
  const room=[{x:100,y:0,width:140,height:80}],hall=[{x:0,y:0,width:100,height:200},{x:100,y:120,width:40,height:80}];
  return {width,height,sourceWidth:width,sourceHeight:height,walls,lines:[],room,hall,all:[...room,...hall,{x:140,y:80,width:100,height:120}],door:{ax:100,ay:140,bx:100,by:170}};
}
it('discovers the missing connector and follows the L-shaped entry to its closed door',()=>{const i=input(),r=traceMissingFloor(i);expect(r.regions).toEqual([{id:'region-1',added:true,rects:[{x:100,y:80,width:40,height:40}]},{id:'region-transfer',added:false,rects:[{x:100,y:120,width:40,height:80}]}]);});
it('rejects exterior-connected voids, solid ink, and holes unrelated to the selected pair',()=>{const i=input();expect(missingFloorRegions({...i,all:i.all.slice(0,-1)})).toEqual([]);for(let y=80;y<120;y++)for(let x=100;x<140;x++)i.walls[y*240+x]=1;expect(missingFloorRegions(i)).toEqual([]);expect(missingFloorRegions({...input(),room:[{x:10,y:10,width:20,height:20}]})).toEqual([]);});
it('preserves subpixel measured edges without letting floating point cracks leak outside',()=>{const i=input(),factor=8.9064935065,convert=(r:typeof i.room[0])=>({x:r.x/factor,y:r.y/factor,width:r.width/factor,height:r.height/factor});const r=missingFloorRegions({...i,all:i.all.map(convert),room:i.room.map(convert),hall:i.hall.map(convert),sourceWidth:240/factor,sourceHeight:200/factor,door:{ax:100/factor,ay:140/factor,bx:100/factor,by:170/factor}});expect(r).toHaveLength(1);});
it('adds only reviewed floor, protects the bathroom, and leaves the original draft untouched',()=>{const i=input(),base=createSamplePlan();base.furniture=[];const draft:BlueprintDraft={rooms:i.all.map((r,n)=>({id:`r${n}`,groupId:n===1||n===2?'hall':`r${n}`,name:n===0?'Bedroom':n===3?'Bathroom':'Hall',kind:n===0?'Bedroom':n===3?'Bathroom':'Hall',enclosed:n===0||n===3,x:r.x*10,z:r.y*10,width:r.width*10,depth:r.height*10})),walls:[],fixtures:[],omittedWalls:[]};
  const before=structuredClone(draft),regions=traceMissingFloor(i).regions,added=regions[0].rects,transfer=regions[1].rects;
  const next=applyMissingFloorRepair(base,base.floors[0].id,draft,'r0','r1',added,transfer,i.door,10);
  expect(draft).toEqual(before);expect(next.rooms.find(r=>r.id==='r3')).toEqual(draft.rooms[3]);expect(next.fixtures).toHaveLength(1);expect(next.rooms.reduce((n,r)=>n+r.width*r.depth,0)-draft.rooms.reduce((n,r)=>n+r.width*r.depth,0)).toBe(160000);
  expect(()=>applyMissingFloorRepair(base,base.floors[0].id,draft,'r0','r1',[{x:130,y:80,width:40,height:40}],transfer,i.door,10)).toThrow(/overlap/);
});
it('rejects invented IDs, duplicates and oversized or out-of-bounds requests',()=>{const regions=traceMissingFloor(input()).regions,request={version:'region-review-v1',room:'Bedroom',hall:'Hall',regions,door:input().door,annotated:'data:image/jpeg;base64,YQ=='};expect(validateRegionRequest(request,240,200)).toEqual(request);expect(()=>validateRegionRequest({...request,regions:[...regions,...regions]},240,200)).toThrow();expect(()=>validateRegionRequest({...request,door:{ax:300,ay:0,bx:300,by:20}},240,200)).toThrow();for(const selectedIds of [['invented'],['region-1','region-1']])expect(()=>validateRegionAnswer({selectedIds,confidence:'high',note:'test'},regions)).toThrow();});
