export function angularStep(previous:number,next:number){return ((next-previous+540)%360)-180;}
export function pointerAngle(x:number,y:number,cx:number,cy:number):number|undefined {
  if(![x,y,cx,cy].every(Number.isFinite))return;
  return Math.hypot(x-cx,y-cy)<18?undefined:Math.atan2(y-cy,x-cx)*180/Math.PI;
}
