import type {Units} from './types';
export function fraction(value:number){const n=Math.round(value*16),whole=Math.floor(n/16),remainder=n%16;if(!remainder)return String(whole);let d=16,r=remainder;while(r%2===0){r/=2;d/=2;}return `${whole?whole+' ':''}${r}/${d}`;}
export function parseFraction(text:string){if(!text.trim())return NaN;const match=text.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);return match?Number(match[1]||0)+Number(match[2])/Number(match[3]):Number(text);}
export function readableLength(mm:number,units:Units){if(units==='metric')return `${Number((mm/1000).toFixed(3))} m`;const sign=mm<0?'−':'',sixteenths=Math.round(Math.abs(mm)/25.4*16);return `${sign}${Math.floor(sixteenths/192)}′ ${fraction((sixteenths%192)/16)}″`;}
export function readableArea(squareMetres:number,units:Units){return `${Number((squareMetres*(units==='imperial'?10.7639104:1)).toFixed(1))} ${units==='imperial'?'ft²':'m²'}`;}
