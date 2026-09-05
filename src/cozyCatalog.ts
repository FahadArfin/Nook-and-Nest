import original from './cozyExpansion.json';
import additions from './homeExpansion.json';
const data=[...original,...additions];
import type {CatalogItem} from './types';
export const cozyRows=data.map(r=>r.slice(0,8)) as Array<[string,string,CatalogItem['category'],number,number,number,CatalogItem['shape'],string]>;
export const cozyMount=(id:string)=>data.find(r=>r[0]===id)?.[8];
export const cozyType=(id:string)=>data.find(r=>r[0]===id)?.[9] as string|undefined;
