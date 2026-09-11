export type MotionPatch={x:number;y:number;w:number;h:number;kind:'fire'|'breath'|'curtain';phase?:number;outline:readonly (readonly [number,number])[]};
// Hand-traced interior regions, in the original artwork's coordinates. A rectangle
// is only an allocation bound: it must never define which scene pixels can move.
export const motionPatches:Record<'fire'|'rain'|'morning',MotionPatch[]>={
 fire:[
  {x:944,y:399,w:100,h:101,kind:'fire',outline:[[949,495],[955,473],[965,459],[977,435],[985,440],[993,401],[1003,413],[1008,455],[1017,450],[1023,479],[1040,495]]},
  {x:1133,y:609,w:118,h:65,kind:'breath',phase:.5,outline:[[1138,635],[1153,620],[1180,615],[1208,617],[1230,628],[1244,650],[1236,667],[1191,667],[1159,657]]},
 ],
 rain:[{x:1070,y:542,w:146,h:78,kind:'breath',outline:[[1076,583],[1088,562],[1116,550],[1148,549],[1176,554],[1200,568],[1207,590],[1194,609],[1161,615],[1114,613],[1084,602]]}],
 morning:[
  // Stop the left mask above the foliage, with only a narrow fabric tail beside it.
  {x:765,y:61,w:79,h:318,kind:'curtain',outline:[[773,68],[838,72],[838,246],[833,286],[837,324],[836,370],[823,358],[822,293],[797,270],[778,244]]},
  // The diagonal edge follows the cloth, excluding the shelf and plants behind it.
  {x:1158,y:96,w:154,h:280,kind:'curtain',phase:1.3,outline:[[1164,103],[1199,107],[1207,176],[1216,226],[1232,269],[1256,311],[1298,364],[1230,367],[1203,319],[1186,269],[1171,207]]},
 ],
};

/** Feather inward only: protected pixels outside the traced outline stay exact. */
export function motionMaskAlpha(p:MotionPatch,x:number,y:number){
 let inside=false,distance=Infinity;
 for(let i=0,j=p.outline.length-1;i<p.outline.length;j=i++){
  const [ax,ay]=p.outline[j],[bx,by]=p.outline[i];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
 }
 return inside?Math.min(1,distance/(p.kind==='fire'?4:10)):0;
}
