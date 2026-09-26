import {expect,it} from 'vitest';
import {snapPolygon} from '../src/studioSnapping';
import {polygonRooms,roomArea} from '../src/studioTools';

const wall={a:{x:4000,z:0},b:{x:4000,z:4000}};
it('snaps first corners and constrained edges to actual wall segments, not extensions',()=>{
  expect(snapPolygon({x:4130,z:2000},[],[wall],180)).toMatchObject({point:{x:4000,z:2000},kind:'wall'});
  expect(snapPolygon({x:4130,z:2140},[{x:0,z:2000}],[wall],180)).toMatchObject({point:{x:4000,z:2000},kind:'wall'});
  expect(snapPolygon({x:4130,z:6000},[{x:0,z:6000}],[wall],180)).toMatchObject({kind:'alignment',point:{x:4000,z:6000}});
  expect(snapPolygon({x:4070,z:4090},[],[wall],180)).toMatchObject({point:wall.b,kind:'corner'});
});
it('shows a horizontal guide from an existing room corner while drawing a separate return edge',()=>{
  const corners=[{x:4000,z:4000},{x:4000,z:9000},{x:7000,z:9000}];
  expect(snapPolygon({x:7080,z:4130},corners,[wall],180)).toMatchObject({kind:'alignment',point:{x:7000,z:4000},guide:{x:4000,z:4000}});
  expect(snapPolygon({x:7080,z:4300},corners,[wall],180).kind).toBeUndefined();
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

it('restores the returning-wall guide in angled mode without changing the previous sloping wall',()=>{
  const corners=[{x:1000,z:1000},{x:1000,z:4000},{x:5000,z:5300}];
  const snap=snapPolygon({x:5040,z:1070},corners,[],180,true,true);
  expect(snap.point.x).toBeCloseTo(5000);expect(snap.point.z).toBe(1000);
  expect(snap.guides).toContainEqual({a:corners[0],b:snap.point});
  expect(snap.matchedWall).toBeUndefined(); // Same height does not falsely mean same length.
});
it('makes opposite rectangle walls exactly equal and advertises both the guide and right angle',()=>{
  const corners=[{x:0,z:0},{x:0,z:3000},{x:4000,z:3000}];
  const snap=snapPolygon({x:4060,z:90},corners,[],180,true,true);
  expect(snap.point.x).toBeCloseTo(4000);expect(snap.point.z).toBe(0);
  expect(snap.guides).toContainEqual({a:corners[0],b:snap.point});
  expect(snap.matchedWall).toEqual({a:corners[0],b:corners[1]});expect(snap.rightAngle).toBe(true);
  corners.push(snap.point);
  expect(snapPolygon({x:40,z:50},corners,[],180,true,true).kind).toBe('close');
  expect(roomArea(polygonRooms(corners))).toBeCloseTo(12000000);
});
it('matches length along an arbitrary direction without forcing a rectangle',()=>{
  const corners=[{x:0,z:0},{x:3000,z:0}];
  const snap=snapPolygon({x:3000+1740,z:2320},corners,[],150,true,true);
  expect(snap.kind).toBe('length');expect(snap.point.x).toBeCloseTo(4800);expect(snap.point.z).toBeCloseTo(2400);
  expect(snap.rightAngle).toBe(false);expect(snap.matchedWall).toEqual({a:corners[0],b:corners[1]});
});
it('supports a right angle to a diagonal wall and releases guides when the pointer leaves their reach',()=>{
  const corners=[{x:0,z:0},{x:3000,z:2000}];
  const snap=snapPolygon({x:1020,z:5030},corners,[],100,true,true);
  expect(snap.rightAngle).toBe(true);
  const free=snapPolygon({x:8000,z:5600},corners,[],100,true,true);
  expect(free.point).toEqual({x:8000,z:5600});expect(free.guides).toEqual([]);
});
it('aligns to existing room levels at consistent screen distance across zoom levels',()=>{
  for(const pixelsPerMm of [.025,.1,.5]){
    const corners=[{x:9000,z:9000}];
    const snap=snapPolygon({x:9000,z:4000+17/pixelsPerMm},corners,[wall],18/pixelsPerMm,true,true);
    expect(snap.point.z).toBe(4000);expect(snap.guides).toContainEqual({a:wall.b,b:snap.point});
    const outside=snapPolygon({x:9000,z:4000+19/pixelsPerMm},corners,[wall],18/pixelsPerMm,true,true);
    expect(outside.guides).toEqual([]);
  }
});
it('prioritizes a real wall over inferred alignment and disables all guides with Snap off',()=>{
  const corners=[{x:0,z:0},{x:0,z:3000},{x:4000,z:3000}];
  const target={a:{x:3500,z:100},b:{x:5000,z:100}};
  expect(snapPolygon({x:4010,z:80},corners,[target],180,true,true)).toMatchObject({kind:'wall',point:{x:4000,z:100}});
  expect(snapPolygon({x:4060,z:90},corners,[],180,false,true)).toEqual({point:{x:4060,z:90}});
});
