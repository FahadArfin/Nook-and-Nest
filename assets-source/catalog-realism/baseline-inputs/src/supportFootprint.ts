import data from './householdSupportFootprints.json';
import garageOutdoorData from './garageOutdoorSupportFootprints.json';
import type {FurniturePlacement} from './types';
interface AuthoredContact {dimensionsMm:number[];x:number;z:number;offset:number;width:number;depth:number;shape:string;hangingClearRadius?:number}
const authored={...data,...garageOutdoorData} as Record<string,AuthoredContact>;
/** Contact planes are distinct from the model's saved lowest-point elevation. */
export function supportFootprint(item:FurniturePlacement){
 const a=authored[item.catalogId];
 if(!a)return {x:0,z:0,offset:0,width:item.widthMm,depth:item.depthMm,hangingClearRadius:undefined};
 return {x:a.x*item.widthMm/a.dimensionsMm[0],z:a.z*item.depthMm/a.dimensionsMm[1],
  offset:a.offset*item.heightMm/a.dimensionsMm[2],width:a.width*item.widthMm/a.dimensionsMm[0],
  depth:a.depth*item.depthMm/a.dimensionsMm[1],hangingClearRadius:a.hangingClearRadius===undefined?undefined:a.hangingClearRadius*Math.min(item.widthMm/a.dimensionsMm[0],item.depthMm/a.dimensionsMm[1])};
}
export function supportCenter(item:FurniturePlacement,x=item.x,z=item.z){
 const f=supportFootprint(item),a=item.rotation*Math.PI/180;
 return {x:x+f.x*Math.cos(a)+f.z*Math.sin(a),z:z-f.x*Math.sin(a)+f.z*Math.cos(a)};
}
export function modelCenterForSupport(item:FurniturePlacement,x:number,z:number){
 const c=supportCenter(item,0,0);return {x:x-c.x,z:z-c.z};
}
