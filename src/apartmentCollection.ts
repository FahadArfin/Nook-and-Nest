import rows from './apartmentExpansion.json';
export const apartmentIds=new Set(rows.map(r=>String(r[0])));
export const showerIds=new Set(['corner-shower','walk-in-shower','bath-shower-combo','shower-wetroom']);
export const showerScaleX=(item:{catalogId:string;showerMirrored?:boolean})=>showerIds.has(item.catalogId)&&item.showerMirrored?-1:1;
export const globeAngle=(seconds:number)=>((Math.max(0,seconds)%120)/120)*Math.PI*2;
