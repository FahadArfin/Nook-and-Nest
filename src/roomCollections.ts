import {furnitureType} from './library';
import type {CatalogItem} from './types';

// Room collections cross catalog categories without hiding the original filters.
export const roomCollections = [
  {id:'living',name:'Living room',categories:['Living'],types:['Coffee tables','Side tables','TV & media','Rugs','Table & floor lamps']},
  {id:'bedroom',name:'Bedroom',categories:['Bedroom'],types:['Beds','Side tables','Dressers & chests','Closet modules','Table & floor lamps']},
  {id:'dining',name:'Dining room',categories:['Dining'],types:['Pendant lights','Sideboards']},
  {id:'kitchen',name:'Kitchen',categories:['Kitchen'],types:['Pendant lights','Countertop appliances']},
  {id:'workspace',name:'Work corner',categories:['Office'],types:['Desks','Computers & screens','Table & floor lamps','Shelves & books']},
  {id:'bathroom',name:'Bathroom',categories:['Bathroom'],types:[]},
  {id:'outdoor',name:'Outdoors',categories:['Outdoor'],types:[]},
];
export function inRoomCollection(item:CatalogItem,id:string){const room=roomCollections.find(r=>r.id===id);return !room||room.categories.includes(item.category)||room.types.includes(furnitureType(item));}
