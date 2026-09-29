import type {CSSProperties} from 'react';
import type {SurfaceFinish} from './surfaces';

/** Match the room's albedo × color, including neutral tintable carpet scans. */
export function finishSwatchStyle(finish:SurfaceFinish):CSSProperties {
 return {backgroundColor:finish.color??'#ffffff',backgroundImage:finish.texture?`url(${finish.texture})`:undefined,backgroundBlendMode:'multiply'};
}

export function FinishSwatch({finish}:{finish:SurfaceFinish}) {
 return <span className="finish-color-preview" style={{backgroundColor:finish.color??'#ffffff',isolation:'isolate',overflow:'hidden'}}>
  {finish.texture&&<img loading="lazy" src={finish.texture} alt="" style={{mixBlendMode:'multiply',width:'100%',height:'100%',maxHeight:'none',objectFit:'cover',display:'block'}}/>}
 </span>;
}
