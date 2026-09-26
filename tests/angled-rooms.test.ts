import {it,expect} from 'vitest';
import {polygonRooms} from '../src/studioTools';
import {blueprintPlan,draftFromFloor,coveredByFloor,roomOverlapPairs} from '../src/blueprint';
import {createSamplePlan,parsePlan} from '../src/domain';
import {floorRects,floorBoundaryWalls} from '../src/floorGeometry';
import {polygonPrism,shapeArea,shapeIntersection} from '../src/polygonGeometry';
import {connectedRoomProposal} from '../src/connectedRooms';
import {snapPolygon} from '../src/studioSnapping';
const triangle=[{x:0,z:0},{x:4000,z:0},{x:0,z:3000}];
const room=(points=triangle)=>({...polygonRooms(points)[0],id:'angle',name:'Angled room',kind:'Bedroom' as const,enclosed:true});
it('preserves an exact triangular floor and diagonal walls through conversion, JSON and reopening',()=>{
 const base=createSamplePlan(),id=base.floors[0].id;
 const p=blueprintPlan(base,id,{rooms:[room()],walls:[],omittedWalls:[],fixtures:[]}),f=p.floors[0];
 expect(floorRects(f,p.gridSizeMm).reduce((s,r)=>s+shapeArea(r),0)).toBeCloseTo(6000000,2);
 expect(floorBoundaryWalls(f,p.gridSizeMm).some(w=>w.ax!==w.bx&&w.az!==w.bz)).toBe(true);
 expect(coveredByFloor({x:3200,z:2300,width:200,depth:200},f,p.gridSizeMm)).toBe(false);
 expect(coveredByFloor({x:200,z:200,width:200,depth:200},f,p.gridSizeMm)).toBe(true);
 expect(draftFromFloor(parsePlan(JSON.stringify(p)),id).rooms[0].polygon).toEqual(triangle);
});
it('triangulates a concave angled floor without filling the missing corner',()=>{
 const points=[{x:0,z:0},{x:4000,z:0},{x:5000,z:2000},{x:2000,z:1500},{x:0,z:3000}],r=room(points),mesh=polygonPrism(points);
 const n=points.length;let area=0;for(let i=0;i<mesh.indices.length;i+=6){const t=mesh.indices.slice(i,i+3);if(t.some(j=>j>=n))break;const [a,b,c]=t.map(j=>points[j]);area+=Math.abs((b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z))/2;}
 expect(area).toBeCloseTo(shapeArea(r),2);
 expect(mesh.positions.every(Number.isFinite)).toBe(true);
});
it('creates triangular rooms automatically and splits an angled room into named faces',()=>{
 const empty={rooms:[],walls:[],omittedWalls:[],fixtures:[]};
 const strokes=[...triangle,triangle[0]].slice(1).map((b,i)=>({a:triangle[i],b}));
 const first=connectedRoomProposal(empty,500,strokes);
 expect(first.count).toBe(1);expect(shapeArea(first.rooms[0])).toBe(6000000);
 const split=connectedRoomProposal({...empty,rooms:[room()]},500,[{a:{x:0,z:1000},b:{x:4000,z:1000}}]);
 expect(split.count).toBe(2);expect(split.rooms.reduce((s,r)=>s+shapeArea(r),0)).toBeCloseTo(6000000,2);
 expect(roomOverlapPairs(split.rooms)).toHaveLength(0);
});
it('closes an angled extension against an existing sloped wall',()=>{
 const draft={rooms:[room()],walls:[],omittedWalls:[],fixtures:[]};
 const points=[{x:4000,z:0},{x:5000,z:3000},{x:0,z:3000}];
 const result=connectedRoomProposal(draft,500,points.slice(1).map((b,i)=>({a:points[i],b})));
 expect(result.count).toBe(1);expect(result.rooms).toHaveLength(2);
 expect(shapeIntersection([result.rooms[0]],[result.rooms[1]])).toBeLessThan(1);
});
it('keeps arbitrary angles and snaps to diagonal walls, endpoints and triangle closure',()=>{
 expect(snapPolygon({x:2100,z:1500},[{x:0,z:0}],[],50,true,true).point).toEqual({x:2100,z:1500});
 const snap=snapPolygon({x:2010,z:2010},[],[{a:{x:0,z:0},b:{x:4000,z:4000}}],50,true,true);
 expect(snap.kind).toBe('wall');expect(snap.point.x).toBe(snap.point.z);
 expect(snapPolygon({x:10,z:10},triangle,[],50,true,true).kind).toBe('close');
 expect(()=>polygonRooms([{x:0,z:0},{x:3000,z:3000},{x:0,z:3000},{x:3000,z:0}])).toThrow();
});

import {snapWindow,windowProblem,windowWallPieces} from '../src/windows';
it('snaps a door onto a diagonal wall and cuts a correctly measured aperture',()=>{
 const base=createSamplePlan(),id=base.floors[0].id,p=blueprintPlan(base,id,{rooms:[room()],walls:[],omittedWalls:[],fixtures:[]});
 const door=snapWindow(p,{id:'door',floorId:id,catalogId:'door-flush',x:2000,z:1500,rotation:0,widthMm:900,depthMm:150,heightMm:2000,elevationMm:0,variant:'cream'});
 expect(door.x).toBeCloseTo(2000);expect(door.z).toBeCloseTo(1500);expect(windowProblem(p,door)).toBeUndefined();
 const wall=floorBoundaryWalls(p.floors[0],p.gridSizeMm).find(w=>w.ax!==w.bx&&w.az!==w.bz)!;
 const pieces=windowWallPieces(wall,p.gridSizeMm,2800,[door]);
 expect(pieces.some(s=>s.bottom>0)).toBe(true);expect(pieces.some(s=>s.start===0)).toBe(true);expect(Math.max(...pieces.map(s=>s.end))).toBeCloseTo(5000,1);
});

it('partitions a closed angled room inside another room without overlapping floor',()=>{
 const draft={rooms:[{...room(),...polygonRooms([{x:0,z:0},{x:10000,z:0},{x:12000,z:10000},{x:0,z:10000}])[0]}],walls:[],omittedWalls:[],fixtures:[]};
 const points=[{x:2000,z:2000},{x:4000,z:2000},{x:3000,z:4000},{x:2000,z:2000}];
 const result=connectedRoomProposal(draft,500,points.slice(1).map((b,i)=>({a:points[i],b})));
 expect(result.count).toBe(2);expect(roomOverlapPairs(result.rooms)).toHaveLength(0);expect(result.rooms.reduce((s,r)=>s+shapeArea(r),0)).toBeCloseTo(110000000,1);
});
