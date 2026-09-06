import type {Recognition,ScanRoom} from './recognitionContract';

// Hall labels are weaker evidence than detected enclosed room boundaries.
// Cut only the conflicting hall footprint; never move/resize the enclosed room.
export function trimHallOverlaps(result:Recognition,minimumSize=1):Recognition {
  const obstacles=result.rooms.filter(r=>r.kind!=='Hall'&&r.enclosed);
  const tooComplex=()=>({...result,warnings:['Hall overlaps could not be safely simplified. Check room overlaps before creating 3D.',...result.warnings].slice(0,30)});
  let changed=false;
  const rooms:ScanRoom[]=[];
  for(const room of result.rooms){
    let parts=[room];
    if(room.kind==='Hall')for(const obstacle of obstacles){
      parts=parts.flatMap(part=>{
        const left=Math.max(part.x,obstacle.x),top=Math.max(part.y,obstacle.y),right=Math.min(part.x+part.width,obstacle.x+obstacle.width),bottom=Math.min(part.y+part.height,obstacle.y+obstacle.height);
        if(right<=left||bottom<=top)return [part];
        changed=true;
        return [
          {...part,height:top-part.y},
          {...part,y:bottom,height:part.y+part.height-bottom},
          {...part,y:top,width:left-part.x,height:bottom-top},
          {...part,x:right,y:top,width:part.x+part.width-right,height:bottom-top},
        ].filter(r=>r.width>=minimumSize&&r.height>=minimumSize);
      });
      if(rooms.length+parts.length>100)return tooComplex();
    }
    rooms.push(...parts);
    if(rooms.length>100)return tooComplex();
  }
  return changed?{...result,rooms,warnings:['Trimmed hallway overlaps against detected enclosed rooms. Check the resulting corridor edges against the image.',...result.warnings].slice(0,30)}:result;
}
