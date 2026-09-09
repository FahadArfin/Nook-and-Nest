export type SunSettings={enabled:boolean;night?:boolean;azimuth:number;elevation:number};
export const defaultSun:SunSettings={enabled:false,azimuth:135,elevation:45};
// Plan north is -Z. Direction points from the sun toward the apartment.
export function sunDirection(s:SunSettings){const a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;return {x:-Math.sin(a)*Math.cos(e),y:-Math.sin(e),z:Math.cos(a)*Math.cos(e)}}
