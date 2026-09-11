import {parsePlan,decodeShare} from './domain';
self.onmessage=({data}:{data:{text:string;share:boolean}})=>{try{self.postMessage({plan:data.share?decodeShare(data.text):parsePlan(data.text)})}catch(error){self.postMessage({error:error instanceof Error?error.message:'Import failed'})}};
