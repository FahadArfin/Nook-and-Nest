import studio from './materialStudio.json';
import paints from './paintCollection.json';
import {luxurySinkIds} from './luxuryCollection';
import expansion from './finishExpansion.json';
import { modernCounterIds } from './modernCollection';
import { kitchenTopIds } from "./kitchenCatalog";
export interface SurfaceFinish {
  id: string;
  name: string;
  family: string;
  texture: string;
  scale: number;
  color?:string;
  description?:string;
  repeatMeters?:[number,number];
}

export const wallFinishes: SurfaceFinish[] = [
  { id: "pale-white", name: "Pale white", family: "Paint", texture: "", scale: 1, color: "#f5f4ef" },
  { id: "cream-plaster", name: "Warm cream", family: "Paint", texture: "/textures/cream-plaster.jpg", scale: 1.5 },
  { id: "sage-plaster", name: "Soft sage", family: "Paint", texture: "/textures/sage-plaster.jpg", scale: 1.5 },
  { id: "terracotta-plaster", name: "Dusty clay", family: "Paint", texture: "/textures/terracotta-plaster.jpg", scale: 1.5 },
  { id: "blue-plaster", name: "Mist blue", family: "Paint", texture: "/textures/blue-plaster.jpg", scale: 1.5 },
  { id: "handmade-brick", name: "Old brick", family: "Masonry", texture: "/textures/handmade-brick.jpg", scale: 1 },
  { id: "pale-limestone", name: "Pale stone", family: "Masonry", texture: "/textures/pale-limestone.jpg", scale: 1 },
  { id: "botanical-wallpaper", name: "Little vines", family: "Wallpaper", texture: "/textures/botanical-wallpaper.jpg", scale: 1 },
  { id: "sage-floral-wallpaper", name: "Meadow bloom", family: "Wallpaper", texture: "/textures/sage-floral-wallpaper.jpg", scale: 1 },
];

export const floorFinishes: SurfaceFinish[] = [
  { id: "honey-oak", name: "Honey oak", family: "Wood", texture: "/textures/honey-oak.jpg", scale: 1 },
  { id: "light-oak", name: "Light oak", family: "Wood", texture: "/textures/light-oak.jpg", scale: 1 },
  { id: "walnut-laminate", name: "Walnut", family: "Laminate", texture: "/textures/walnut-laminate.jpg", scale: 1 },
  { id: "whitewashed-wood", name: "Whitewash", family: "Laminate", texture: "/textures/whitewashed-wood.jpg", scale: 1 },
  { id: "terracotta-checker-tile", name: "Cottage check", family: "Tile", texture: "/textures/terracotta-checker-tile.jpg", scale: 1 },
  { id: "blue-encaustic-tile", name: "Blue bloom", family: "Tile", texture: "/textures/blue-encaustic-tile.jpg", scale: 1 },
  { id: "oatmeal-carpet", name: "Oatmeal", family: "Carpet", texture: "/textures/oatmeal-carpet.jpg", scale: 1.5 },
  { id: "moss-carpet", name: "Moss", family: "Carpet", texture: "/textures/moss-carpet.jpg", scale: 1.5 },
];

floorFinishes.push(...studio.floors as SurfaceFinish[],...expansion.floors as SurfaceFinish[]);
wallFinishes.push(...studio.walls as SurfaceFinish[],...expansion.walls as SurfaceFinish[]);

export const countertopFinishes: SurfaceFinish[] = [
  { id: "warm-granite", name: "Warm granite", family: "Stone", texture: "/textures/countertops/warm-granite.jpg", scale: 1.8 },
  { id: "ivory-marble", name: "Ivory marble", family: "Stone", texture: "/textures/countertops/ivory-marble.jpg", scale: 1.25 },
  { id: "clay-laminate", name: "Clay laminate", family: "Laminate", texture: "/textures/countertops/clay-laminate.jpg", scale: 2 },
  { id: "soft-concrete", name: "Soft concrete", family: "Concrete", texture: "/textures/countertops/soft-concrete.jpg", scale: 1.6 },
];

export const doorFinishes: SurfaceFinish[] = [
  { id: "door-cream", name: "Warm cream", family: "Paint", texture: "/textures/cream-plaster.jpg", scale: 1.5 },
  { id: "door-sage", name: "Soft sage", family: "Paint", texture: "/textures/sage-plaster.jpg", scale: 1.5 },
  { id: "door-clay", name: "Dusty clay", family: "Paint", texture: "/textures/terracotta-plaster.jpg", scale: 1.5 },
  { id: "door-oak", name: "Honey oak", family: "Wood", texture: "/textures/honey-oak.jpg", scale: 1 },
  { id: "door-walnut", name: "Walnut", family: "Wood", texture: "/textures/walnut-laminate.jpg", scale: 1 },
];

const countertopCatalogIds = new Set(["console-vanity","reed-double-vanity","base-cabinet", "sink-cabinet", "kitchen-counter", "kitchen-island", "single-bath-vanity", "double-bath-vanity", "floating-bath-vanity"]);
export const supportsCountertopFinish = (catalogId: string) => luxurySinkIds.has(catalogId)||modernCounterIds.has(catalogId)||countertopCatalogIds.has(catalogId)||kitchenTopIds.has(catalogId)||catalogId==="backsplash-slab";

export const defaultWallFinish = wallFinishes[0];
export const defaultFloorFinish = floorFinishes[0];
export const defaultCountertopFinish = countertopFinishes[0];
export const defaultDoorFinish = doorFinishes[0];

export function findWallFinish(id?: string) {
  if(id?.match(/^paint-([0-9a-f]{6})$/i))return {id,name:paints.find(p=>p.color.toLowerCase()==='#'+id.slice(6).toLowerCase())?.name??'Custom paint',family:'Paint',texture:'',scale:1.5,color:'#'+id.slice(6)};
  return wallFinishes.find((finish) => finish.id === id) ?? defaultWallFinish;
}

export function findFloorFinish(id?: string) {
  return floorFinishes.find((finish) => finish.id === id) ?? defaultFloorFinish;
}

export function findCountertopFinish(id?: string) {
  return countertopFinishes.find((finish) => finish.id === id) ?? defaultCountertopFinish;
}

export function findDoorFinish(id?: string) {
  return doorFinishes.find((finish) => finish.id === id) ?? defaultDoorFinish;
}
