import {fieldId,fieldSample,type VegetationField} from './vegetationField';
export interface FieldView {x:number;z:number;span:number;budget:number}
export interface FieldCandidate {key:string;index:number;weight:number;distance:number}
/** Work scales with cells and the visible budget, never the total plant count. */
export function visibleField(field:VegetationField,view:FieldView):FieldCandidate[]{
 const ranked=Object.entries(field.cells).map(([key,count])=>{const [,x,z]=key.split('|');return {key,count,distance:Math.hypot(+x*4+2-view.x,+z*4+2-view.z)};}).filter(c=>c.distance<view.span*1.5+8).sort((a,b)=>a.distance-b.distance);
 const result:FieldCandidate[]=[];let remaining=Math.max(0,Math.floor(view.budget));
 const desired=ranked.map(c=>Math.max(1,Math.min(c.count,Math.ceil(c.count*Math.min(1,64/Math.max(1,c.distance*c.distance))))));
 const total=desired.reduce((a,b)=>a+b,0),ratio=Math.min(1,remaining/Math.max(1,total));
 for(let n=0;n<ranked.length&&remaining;n++){
  const c=ranked[n],samples=Math.min(remaining,Math.max(1,Math.floor(desired[n]*ratio)));
  for(let i=0;i<samples;i++){const index=i;if(field.removed[fieldId(c.key,index)])continue;result.push({key:c.key,index,weight:c.count/samples,distance:c.distance});remaining--;}
 }
 return result;
}
