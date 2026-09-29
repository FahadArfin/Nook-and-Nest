import type {FurniturePlacement} from './types';

// Catalog-safe geometry constants: no runtime catalog/domain imports.
export const isRoofSkylight=(id:string)=>id==='roof-skylight';
export const isStormDoor=(id:string)=>id==='secondary-storm-screen-door';
export const isGarageDoor=(id:string)=>['sectional-garage-door','garage-door-full-view','garage-door-carriage','garage-door-slatted'].includes(id);
export const isSpiralStair=(id:string)=>id==='spiral-staircase';
export const isStormDoorHostId=(id:string)=>['door-flush','door-shaker','door-six-panel','door-slim'].includes(id);

/** Source geometry is centered on the complete 2700 mm overhead-track envelope. */
export function garageWallOffsetMm(item:FurniturePlacement){return isGarageDoor(item.catalogId)?item.depthMm*(1259/2700):0;}
export function architectureWallAnchor(item:FurniturePlacement):FurniturePlacement {
  const offset=garageWallOffsetMm(item),a=item.rotation*Math.PI/180;
  return offset?{...item,x:item.x+Math.sin(a)*offset,z:item.z+Math.cos(a)*offset}:item;
}
export function placementFromWallAnchor(item:FurniturePlacement):FurniturePlacement {
  const offset=garageWallOffsetMm(item),a=item.rotation*Math.PI/180;
  return offset?{...item,x:item.x-Math.sin(a)*offset,z:item.z-Math.cos(a)*offset}:item;
}
/** Aperture excludes the side tracks and overhead springs. */
export function garageDoorAperture(item:FurniturePlacement){return {width:item.widthMm*(2700/2850),height:item.heightMm*(2130/2400),offset:0};}
