import type {MissingFloorInput,FloorRegion} from './missingFloorGeometry';
export function traceMissing(input:MissingFloorInput,signal:AbortSignal):Promise<{regions:FloorRegion[]}>{
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./missingFloor.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{worker.terminate();signal.removeEventListener('abort',abort);},abort=()=>{finish();reject(new DOMException('Repair canceled.','AbortError'));};
    worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);};worker.onerror=()=>{finish();reject(new Error('Could not inspect missing floor.'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}const walls=input.walls.slice();worker.postMessage({...input,walls},[walls.buffer]);
  });
}
