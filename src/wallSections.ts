import type { WallPiece } from "./windows";
export function wallPaintKey(wallId:string,alongMm:number,grid:number) { return `${wallId}|${Math.floor((alongMm+.001)/grid)}`; }
export function splitWallSections(wallId:string,pieces:WallPiece[],grid:number) {
  return pieces.flatMap(piece=>{
    const result:Array<WallPiece&{paintKey:string}>=[];let start=piece.start;
    while(start<piece.end-.01){const boundary=(Math.floor((start+.001)/grid)+1)*grid,end=Math.min(piece.end,boundary);result.push({...piece,start,end,paintKey:wallPaintKey(wallId,(start+end)/2,grid)});start=end;}
    return result;
  });
}
