import {traceMissingFloor} from './missingFloorGeometry';
self.onmessage=(e:MessageEvent)=>{try{self.postMessage({result:traceMissingFloor(e.data)});}catch(error){self.postMessage({error:(error as Error).message});}};
