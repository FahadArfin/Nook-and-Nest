import {extractWallCandidates} from './recognitionEvidence';
import {wallSupport} from './wallSupport';
self.onmessage=(event:MessageEvent)=>{try{const {pixels,width,height,sourceWidth,sourceHeight,includeWallView}=event.data;const support=includeWallView?wallSupport(pixels,width,height):undefined;self.postMessage({walls:extractWallCandidates(pixels,width,height,sourceWidth,sourceHeight),support},{transfer:support?[support.mask.buffer as ArrayBuffer]:[]});}catch{self.postMessage({error:'Could not prepare image geometry.'});}};
