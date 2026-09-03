import type { PlanDocumentV1 } from "./types";

export function cameraUpdatePolicy(previous:PlanDocumentV1|undefined, next:PlanDocumentV1, previousFloor:string, nextFloor:string) {
  const reframe = !previous || previous.id !== next.id || previousFloor !== nextFloor;
  return { reframe, orient: reframe || previous?.camera.mode !== next.camera.mode };
}
export const closeZoomLimit=.25;
export const closeClipPlane=.005;
export const detailFocusRadius=(widthMm:number,depthMm:number,heightMm:number)=>Math.max(.35,Math.max(widthMm,depthMm,heightMm)/1000*1.9);
export const precisionPanSensitivity=(radius:number)=>Math.max(1200,1200*4/Math.max(.25,radius));
export const comfortableCamera = { panningSensibility:1200, angularSensibilityX:2800, angularSensibilityY:2800, wheelDeltaPercentage:.008, inertia:.8, panningInertia:.8 };
