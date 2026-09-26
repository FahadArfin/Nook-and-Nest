import type {WallSegment} from './types';
export function subtractWallCuts(walls:WallSegment[],cuts:WallSegment[]):WallSegment[]{
 return walls.flatMap(w=>{
  if(w.ax===w.bx||w.az===w.bz)return subtractAxisCuts([w],cuts.filter(c=>c.ax===c.bx||c.az===c.bz));
  const dx=w.bx-w.ax,dz=w.bz-w.az,length=Math.hypot(dx,dz);if(!length)return [];
  let spans:[number,number][]=[[0,1]];
  for(const c of cuts){if([{x:c.ax,z:c.az},{x:c.bx,z:c.bz}].some(p=>Math.abs((p.x-w.ax)*dz-(p.z-w.az)*dx)/length>.001))continue;
   const values=[(c.ax-w.ax)*dx+(c.az-w.az)*dz,(c.bx-w.ax)*dx+(c.bz-w.az)*dz].map(v=>v/(length*length)),a=Math.min(...values),b=Math.max(...values);
   spans=spans.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:([[x,Math.max(x,a)],[Math.min(y,b),y]] as [number,number][]).filter(([l,r])=>(r-l)*length>.001));
  }
  if(spans.length===1&&Math.abs(spans[0][0])<1e-9&&Math.abs(spans[0][1]-1)<1e-9)return [w];
  return spans.map(([a,b])=>({...w,id:`cut:${w.ax+dx*a}:${w.az+dz*a}:${w.ax+dx*b}:${w.az+dz*b}`,ax:w.ax+dx*a,az:w.az+dz*a,bx:w.ax+dx*b,bz:w.az+dz*b}));
 });
}

function subtractAxisCuts(walls:WallSegment[],cuts:WallSegment[]):WallSegment[] {
  return walls.flatMap(w=>{
    const horizontal=w.az===w.bz,line=horizontal?w.az:w.ax;
    let spans:[[number,number]]|[number,number][]=[[Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz),Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)]];
    for(const cut of cuts){if((cut.az===cut.bz)!==horizontal||Math.abs((horizontal?cut.az:cut.ax)-line)>.001)continue;
      const a=Math.min(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz),b=Math.max(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz);
      spans=spans.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:([[x,Math.max(x,a)],[Math.min(y,b),y]] as [number,number][]).filter(([l,r])=>r-l>.001));
    }
    if(spans.length===1&&spans[0][0]===Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)&&spans[0][1]===Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz))return [w];
    return spans.map(([a,b])=>({...w,id:`cut:${horizontal?1:0}:${line}:${a}:${b}`,ax:horizontal?a:line,az:horizontal?line:a,bx:horizontal?b:line,bz:horizontal?line:b}));
  });
}
