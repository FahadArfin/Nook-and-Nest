import {extractWallCandidates} from './recognitionEvidence';
import {wallFirstProposal,topFrameHints} from './wallFirstGeometry';
self.onmessage=({data})=>{try{const {pixels,width,height,sourceWidth,sourceHeight}=data,walls=extractWallCandidates(pixels,width,height,sourceWidth,sourceHeight);self.postMessage({draft:wallFirstProposal([...walls,...topFrameHints(pixels,width,height,walls,sourceWidth,sourceHeight)],sourceWidth,sourceHeight)});}catch(e){self.postMessage({error:(e as Error).message});}};
