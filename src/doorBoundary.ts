import type {BoundaryInput,BoundaryResult} from './doorBoundaryGeometry';
export function traceBoundary(input:BoundaryInput,signal:AbortSignal):Promise<BoundaryResult>{
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./doorBoundary.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{worker.terminate();signal.removeEventListener('abort',abort);},abort=()=>{finish();reject(new DOMException('Repair canceled.','AbortError'));};
    worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);};worker.onerror=()=>{finish();reject(new Error('Could not trace this boundary.'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}const walls=input.walls.slice();worker.postMessage({...input,walls},[walls.buffer]);
  });
}
