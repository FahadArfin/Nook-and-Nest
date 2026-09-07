import {floorRects} from './floorGeometry';
import {roomGroups,draftFromFloor} from './blueprint';
import type {PlanDocumentV1} from './types';
export type HomeShot={name:string;x:number;z:number;y:number;radius:number;alpha:number;beta:number};
export function homeShots(plan:PlanDocumentV1,floorId:string):HomeShot[]{
 const floor=plan.floors.find(f=>f.id===floorId);if(!floor)return [];
 const rects=floorRects(floor,plan.gridSizeMm);if(!rects.length)return [];
 const x=Math.min(...rects.map(r=>r.x)),z=Math.min(...rects.map(r=>r.z));
 const width=Math.max(...rects.map(r=>r.x+r.width))-x,depth=Math.max(...rects.map(r=>r.z+r.depth))-z;
 const shot=(name:string,r:{x:number;z:number;width:number;depth:number},i=0):HomeShot=>({name,x:(r.x+r.width/2)/1000,z:(r.z+r.depth/2)/1000,y:floor.elevationMm/1000+.5,radius:Math.max(3,Math.max(r.width,r.depth)/1000*1.7),alpha:Math.PI/2+i*Math.PI/2,beta:.65});
 const rooms=roomGroups(draftFromFloor(plan,floorId).rooms).slice(0,20);
 return [shot(floor.name+' · Overview',{x,z,width,depth}),...(rooms.length?rooms.map(r=>shot(r.name,r)): [1,2,3].map(i=>shot(['','East view','South view','West view'][i],{x,z,width,depth},i)))];
}
