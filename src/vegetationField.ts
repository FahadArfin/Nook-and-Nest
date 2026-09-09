import {catalog} from './catalog';
import {isVegetation} from './vegetation';
import {floorRects} from './floorGeometry';
import {terrainSampler} from './terrain';
import {furnitureGrassMask} from './grassCoverage';
import type {PlantingBrush} from './planting';
import type {PlanDocumentV1,FurniturePlacement} from './types';

/** Four metre cells, per species. Counts are persistent; render budgets are not. */
export interface VegetationField { cells:Record<string,number>; removed:Record<string,true> }
const definitions=new Map(catalog.map(c=>[c.id,c]));
export const FIELD_LIMIT=2_000_000;
export const FIELD_CELL=4;
export function fieldCount(field?:VegetationField){return field?Object.values(field.cells).reduce((a,b)=>a+b,0)-Object.keys(field.removed).length:0;}
export function fieldKey(species:string,x:number,z:number){return `${species}|${x}|${z}`;}
export function fieldSample(key:string,index:number){
 let seed=2166136261;for(let i=0;i<key.length;i++)seed=Math.imul(seed^key.charCodeAt(i),16777619);
 const random=(salt:number)=>{let n=(seed+Math.imul(index+1,374761393)+Math.imul(salt,668265263))|0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296;};
 const [,x,z]=key.split('|');return {x:(+x+random(11))*FIELD_CELL,z:(+z+random(83))*FIELD_CELL,rotation:random(157)*360,scale:.85+random(293)*.3};
}
export function fieldId(key:string,index:number){return `field:${key}:${index}`;}
export function fieldPlacement(plan:PlanDocumentV1,id:string){return id.startsWith('field:')?fieldResolver(plan)(id):undefined;}
export function fieldResolver(plan:PlanDocumentV1){
 const floor=[...plan.floors].sort((a,b)=>a.elevationMm-b.elevationMm)[0];
 const sample=terrainSampler(plan),mask=furnitureGrassMask(plan),rects=plan.floors.flatMap(f=>floorRects(f,plan.gridSizeMm));
 return (id:string):FurniturePlacement|undefined=>{
 const match=/^field:(.+):(\d+)$/.exec(id);if(!match)return;const [,key,raw]=match,index=+raw,field=plan.environment?.vegetationField;
 if(!field||index>=(field.cells[key]??0)||field.removed[id])return;
 const c=definitions.get(key.split('|')[0]);if(!c||!floor)return;
 const s=fieldSample(key,index),ground=sample(s.x,s.z);
 if(ground.water||mask(s.x,s.z,.1)||rects.some(r=>s.x*1000>=r.x&&s.x*1000<=r.x+r.width&&s.z*1000>=r.z&&s.z*1000<=r.z+r.depth))return;
 return {id,catalogId:c.id,floorId:floor.id,x:s.x*1000,z:s.z*1000,rotation:s.rotation,widthMm:Math.round(c.widthMm*s.scale),heightMm:Math.round(c.heightMm*s.scale),depthMm:Math.round(c.depthMm*s.scale),variant:'sage',terrainAnchored:true,elevationMm:ground.height*1000-floor.elevationMm-50};
}
}
export function paintVegetationField(plan:PlanDocumentV1,points:Array<{x:number;z:number}>,brush:PlantingBrush):VegetationField{
 const previous=plan.environment?.vegetationField,cells={...previous?.cells},removed={...previous?.removed};
 if(!isVegetation(brush.catalogId))return {cells,removed};
 let total=Object.values(cells).reduce((a,b)=>a+b,0);
 const radius=Math.max(2,Math.min(32,brush.radius)),count=Math.max(1,Math.min(512,Math.round(16*Math.max(1,Math.min(9,brush.density??1))/Math.max(.3,brush.spacing)**2)));
 for(let i=0;i<points.length;i++){
  const b=points[i],a=points[i-1]??b;if(!Number.isFinite(a.x+a.z+b.x+b.z))continue;
  const steps=Math.min(800,Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)));
  for(let j=1;j<=steps;j++){const px=a.x+(b.x-a.x)*j/steps,pz=a.z+(b.z-a.z)*j/steps;
   for(let x=Math.max(-50,Math.floor((px-radius)/4));x<Math.min(50,Math.ceil((px+radius)/4));x++)for(let z=Math.max(-50,Math.floor((pz-radius)/4));z<Math.min(50,Math.ceil((pz+radius)/4));z++){
    if(Math.hypot(x*4+2-px,z*4+2-pz)>radius)continue;const key=fieldKey(brush.catalogId,x,z),old=cells[key]??0;
    const next=brush.eraseCoverage?0:Math.max(old,Math.min(count,FIELD_LIMIT-total+old));total+=next-old;if(next)cells[key]=next;else delete cells[key];
   }
  }
 }
 for(const id of Object.keys(removed)){const m=/^field:(.+):(\d+)$/.exec(id);if(!m||+m[2]>=(cells[m[1]]??0))delete removed[id];}
 return {cells,removed};
}
export function validateVegetationField(value:unknown){
 const f=value as VegetationField;if(!f||typeof f!=='object'||!f.cells||!f.removed||typeof f.cells!=='object'||typeof f.removed!=='object'||Array.isArray(f.cells)||Array.isArray(f.removed))throw Error('Invalid vegetation field');
 const entries=Object.entries(f.cells);if(entries.length>40000)throw Error('Too many vegetation cells');let total=0;
 for(const [key,count] of entries){const parts=key.split('|');if(parts.length!==3||!isVegetation(parts[0])||!parts.slice(1).every(v=>/^-?\d{1,2}$/.test(v)&&+v>=-50&&+v<50)||!Number.isInteger(count)||count<1||count>512)throw Error('Invalid vegetation cell');total+=count;}
 if(total>FIELD_LIMIT||Object.keys(f.removed).length>22000)throw Error('Vegetation field capacity exceeded');
 for(const [id,v] of Object.entries(f.removed)){const m=/^field:(.+):(\d+)$/.exec(id);if(v!==true||!m||+m[2]>=(f.cells[m[1]]??0))throw Error('Invalid vegetation edit');}
}
