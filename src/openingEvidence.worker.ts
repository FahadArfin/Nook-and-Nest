import {wallSupport} from './wallSupport';
import {extractWallCandidates} from './recognitionEvidence';
import {exteriorMask,gapCandidates} from './openingGeometry';
self.onmessage=(event:MessageEvent)=>{try{
  const {pixels,width,height,sourceWidth,sourceHeight}=event.data;
  const support=wallSupport(pixels,width,height),outside=exteriorMask(support.mask,width,height);
  const gaps=gapCandidates(extractWallCandidates(pixels,width,height,sourceWidth,sourceHeight),sourceWidth,sourceHeight);
  self.postMessage({outside,width,height,gaps},{transfer:[outside.buffer]});
}catch{self.postMessage({error:'The source enclosure check could not finish.'});}};
