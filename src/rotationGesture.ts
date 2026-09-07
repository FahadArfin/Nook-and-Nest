export function angularStep(previous:number,next:number){return ((next-previous+180)%360+360)%360-180;}
/** Keep the raw gesture continuous; only the displayed/committed angle sticks. */
export function stickyRotation(angle:number,previous?:number,free=false,precise=false){
  if(free)return angle;
  if(precise)return Math.round(angle/15)*15;
  const target=Math.round(angle/45)*45;
  const held=previous!==undefined&&Math.abs(previous/45-Math.round(previous/45))<.0001;
  if(held&&Math.abs(angularStep(previous!,angle))<=7)return angle-angularStep(previous!,angle);
  return Math.abs(target-angle)<=4?target:angle;
}
export function pointerAngle(x:number,y:number,cx:number,cy:number):number|undefined {
  if(![x,y,cx,cy].every(Number.isFinite))return;
  return Math.hypot(x-cx,y-cy)<18?undefined:Math.atan2(y-cy,x-cx)*180/Math.PI;
}
