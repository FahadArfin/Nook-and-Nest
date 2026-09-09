/** Stable world-space samples: changing density or camera never reshuffles a patch. */
function random(x:number,z:number,index:number,channel:number){
  let h=Math.imul(x,0x9e3779b1);
  h=Math.imul(h^(h>>>16)^z,0x85ebca77);
  h=Math.imul(h^(h>>>13)^(index+1),0xc2b2ae3d);
  h^=Math.imul(channel+1,0x27d4eb2f);
  h=Math.imul(h^(h>>>16),0x7feb352d);
  h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
}

export function meadowSample(x:number,z:number,index:number){
  return {
    x:x+random(x,z,index,0),
    z:z+random(x,z,index,1),
    rotation:random(x,z,index,2)*360,
    widthScale:.82+random(x,z,index,3)*.36,
    heightScale:.78+random(x,z,index,4)*.44,
  };
}
