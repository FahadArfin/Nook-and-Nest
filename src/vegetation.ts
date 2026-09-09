import {catalog} from './catalog';
export const vegetationIds=new Set(catalog.filter(c=>c.category==='Outdoor'&&c.shape==='plant').map(c=>c.id));
export const isVegetation=(id:string)=>vegetationIds.has(id);
export const vegetationLimit=22000;
