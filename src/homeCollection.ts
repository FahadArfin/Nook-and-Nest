import rows from './homeExpansion.json';
import {householdWindowTreatmentIds} from './householdCollection';
import type {FurniturePlacement} from './types';
import {isGarageDoor,garageDoorAperture} from './householdArchitectureGeometry';
export const homeIds=rows.map(r=>r[0] as string);
export const windowTreatmentIds=new Set([...rows.filter(r=>r[2]==='Windows'&&r[6]==='decor').map(r=>r[0] as string),...householdWindowTreatmentIds]);
export const wallFixtureIds=new Set(rows.filter(r=>r[8]==='wall'&&r[6]!=='window'&&r[2]!=='Doors').map(r=>r[0] as string));
export const slidingDoorIds=new Set([...rows.filter(r=>r[2]==='Doors').map(r=>r[0] as string),'door-closet-sliding']);
export function doorAperture(item:FurniturePlacement,horizontal:boolean){
 if(isGarageDoor(item.catalogId))return garageDoorAperture(item);
 const barn=item.catalogId.startsWith('door-barn-'),angle=item.rotation*Math.PI/180;
 return {width:item.widthMm*(barn ? .48 : 1),offset:barn?item.widthMm*.25*(horizontal?Math.cos(angle):-Math.sin(angle)):0,height:item.heightMm*(barn ? .93 : 1)};
}
