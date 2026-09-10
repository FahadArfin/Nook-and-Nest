import {wallSupport} from './wallSupport';
import {extractWallCandidates} from './recognitionEvidence';
import {exteriorMask,gapCandidates} from './openingGeometry';
self.onmessage=(event:MessageEvent)=>{try{
  const {pixels,width,height,sourceWidth,sourceHeight}=event.data;
  const support=wallSupport(pixels,width,height),outside=exteriorMask(support.mask,width,height);
  const lines=extractWallCandidates(pixels,width,height,sourceWidth,sourceHeight),gaps=gapCandidates(lines,sourceWidth,sourceHeight),walls=Uint8Array.from({length:width*height},(_,i)=>Number(support.mask[i*4]<128));
  self.postMessage({outside,width,height,gaps,walls,lines},{transfer:[outside.buffer,walls.buffer]});
}catch{self.postMessage({error:'The source enclosure check could not finish.'});}};
