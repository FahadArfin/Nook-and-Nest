import type {WallSegment} from './types';
export function subtractWallCuts(walls:WallSegment[],cuts:WallSegment[]):WallSegment[] {
  return walls.flatMap(w=>{
    const horizontal=w.az===w.bz,line=horizontal?w.az:w.ax;
    let spans:[[number,number]]|[number,number][]=[[Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz),Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)]];
    for(const cut of cuts){if((cut.az===cut.bz)!==horizontal||Math.abs((horizontal?cut.az:cut.ax)-line)>.001)continue;
      const a=Math.min(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz),b=Math.max(horizontal?cut.ax:cut.az,horizontal?cut.bx:cut.bz);
      spans=spans.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:([[x,Math.max(x,a)],[Math.min(y,b),y]] as [number,number][]).filter(([l,r])=>r-l>.001));
    }
    if(spans.length===1&&spans[0][0]===Math.min(horizontal?w.ax:w.az,horizontal?w.bx:w.bz)&&spans[0][1]===Math.max(horizontal?w.ax:w.az,horizontal?w.bx:w.bz))return [w];
    return spans.map(([a,b])=>({id:`cut:${horizontal?1:0}:${line}:${a}:${b}`,ax:horizontal?a:line,az:horizontal?line:a,bx:horizontal?b:line,bz:horizontal?line:b}));
  });
}
