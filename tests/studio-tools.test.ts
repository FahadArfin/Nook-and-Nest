import {describe,it,expect} from 'vitest';
import {polygonRooms,lRoom,roomArea,areaLabel} from '../src/studioTools';
import {createSamplePlan} from '../src/domain';
import {validatePlan} from '../src/planValidation';
import {scaleWallFirst} from '../src/wallFirstGeometry';

describe('drafting geometry and annotations',()=>{
  it('decomposes a concave entry without filling its missing corner',()=>{
    const parts=polygonRooms([{x:0,z:0},{x:4000,z:0},{x:4000,z:2000},{x:6000,z:2000},{x:6000,z:4000},{x:0,z:4000}]);
    expect(roomArea(parts)).toBe(20e6);
    expect(parts.some(r=>5000>r.x&&5000<r.x+r.width&&1000>r.z&&1000<r.z+r.depth)).toBe(false);
    expect(areaLabel(roomArea(parts),false)).toBe('20 m²');
  });
  it('rejects crossing, diagonal, and degenerate custom outlines',()=>{
    expect(()=>polygonRooms([{x:0,z:0},{x:3000,z:0},{x:3000,z:3000},{x:1000,z:3000},{x:1000,z:-1000},{x:0,z:-1000}])).toThrow(/cross/);
    expect(()=>polygonRooms([{x:0,z:0},{x:3000,z:1000},{x:3000,z:3000},{x:0,z:3000}])).toThrow(/horizontal/);
    expect(()=>polygonRooms([{x:0,z:0},{x:0,z:0},{x:3000,z:3000},{x:0,z:3000}])).toThrow();
  });
  it('creates exact L-shaped area in either drag direction and unions overlaps for area',()=>{
    expect(lRoom({x:4000,z:4000},{x:0,z:0})).toEqual(lRoom({x:0,z:0},{x:4000,z:4000}));
    expect(roomArea(lRoom({x:0,z:0},{x:4000,z:4000}))).toBe(12e6);
    expect(roomArea([{x:0,z:0,width:2000,depth:2000},{x:1000,z:0,width:2000,depth:2000}])).toBe(6e6);
  });
  it('validates persisted annotations and scales both endpoints with the reference',()=>{
    const p=createSamplePlan(),draft={rooms:[],walls:[],fixtures:[],omittedWalls:[],annotations:[{id:'a',kind:'dimension' as const,a:{x:100,z:200},b:{x:300,z:400},text:''}]};
    p.studioDrafts={[p.floors[0].id]:{draft,savedAt:new Date().toISOString(),imageScale:10,calibrated:true,view:{x:0,z:0,width:10000,height:10000}}};
    expect(()=>validatePlan(p)).not.toThrow();
    expect(scaleWallFirst(draft,2).annotations![0].b).toEqual({x:600,z:800});
    draft.annotations[0].a.x=Infinity;expect(()=>validatePlan(p)).toThrow();
  });
});
