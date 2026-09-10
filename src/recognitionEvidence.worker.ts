import {extractWallCandidates} from './recognitionEvidence';
self.onmessage=(event:MessageEvent)=>{try{const {pixels,width,height,sourceWidth,sourceHeight}=event.data;self.postMessage({walls:extractWallCandidates(pixels,width,height,sourceWidth,sourceHeight)});}catch{self.postMessage({error:'Could not prepare image geometry.'});}};
