import {isWallOpening,isKitchenWall,isStairs} from './catalog';
/** Imported Blender furniture fronts point toward editor +Z. */
export function cameraFacingRotation(id:string,camera:{x:number;z:number},point:{x:number;z:number}){
 const angle=(Math.atan2(camera.x-point.x,camera.z-point.z)*180/Math.PI+360)%360;
 return isWallOpening(id)||isKitchenWall(id)?0:isStairs(id)?Math.round(angle/90)*90%360:Math.round(angle*10)/10;
}
