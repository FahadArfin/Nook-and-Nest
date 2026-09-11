import {repairDoorBoundary} from './doorBoundaryGeometry';
self.onmessage=(e:MessageEvent)=>{try{self.postMessage({result:repairDoorBoundary(e.data)});}catch(error){self.postMessage({error:(error as Error).message});}};
