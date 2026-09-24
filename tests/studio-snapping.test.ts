import {expect,it} from 'vitest';
import {snapPolygon} from '../src/studioSnapping';
import {polygonRooms,roomArea} from '../src/studioTools';

const wall={a:{x:4000,z:0},b:{x:4000,z:4000}};
it('snaps first corners and constrained edges to actual wall segments, not extensions',()=>{
  expect(snapPolygon({x:4130,z:2000},[],[wall],180)).toMatchObject({point:{x:4000,z:2000},kind:'wall'});
  expect(snapPolygon({x:4130,z:2140},[{x:0,z:2000}],[wall],180)).toMatchObject({point:{x:4000,z:2000},kind:'wall'});
  expect(snapPolygon({x:4130,z:6000},[{x:0,z:6000}],[wall],180).kind).toBeUndefined();
  expect(snapPolygon({x:4070,z:4090},[],[wall],180)).toMatchObject({point:wall.b,kind:'corner'});
});
it('uses the same pixel reach at different zoom scales and respects Snap off',()=>{
  for(const pixelsPerMm of [.025,.1,.5]){
    expect(snapPolygon({x:4000+17/pixelsPerMm,z:2000},[],[wall],18/pixelsPerMm).kind).toBe('wall');
    expect(snapPolygon({x:4000+19/pixelsPerMm,z:2000},[],[wall],18/pixelsPerMm).kind).toBeUndefined();
  }
  expect(snapPolygon({x:4100,z:2000},[],[wall],180,false)).toEqual({point:{x:4100,z:2000}});
});
it('aligns an overshooting last corner then closes a valid concave room without diagonal edges',()=>{
  const corners=[{x:0,z:0},{x:4000,z:0},{x:4000,z:2000},{x:6000,z:2000},{x:6000,z:4000}];
  const end=snapPolygon({x:-140,z:4070},corners,[],180);
  expect(end).toMatchObject({point:{x:0,z:4000},kind:'alignment',guide:corners[0]});
  corners.push(end.point);
  expect(snapPolygon({x:100,z:-80},corners,[],180)).toMatchObject({point:corners[0],kind:'close'});
  expect(roomArea(polygonRooms(corners))).toBe(20000000);
  expect(snapPolygon({x:0,z:0},corners.slice(0,-1),[],180).kind).not.toBe('close');
});
it('does not advertise closing for self-intersections or collapse a short edge',()=>{
  const crossed=[{x:0,z:0},{x:4000,z:0},{x:4000,z:4000},{x:2000,z:4000},{x:2000,z:-1000},{x:0,z:-1000}];
  expect(snapPolygon({x:0,z:0},crossed,[],180).kind).not.toBe('close');
  expect(snapPolygon({x:4050,z:2000},[{x:4000,z:2000}],[wall],180).kind).toBeUndefined();
});
