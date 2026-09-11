// A renderer instance owns its failures. Closing it removes its retry callbacks.
import {useSyncExternalStore} from 'react';
type Failure={owner:object;id:string;retry:()=>void;retrying:boolean};
let failures:Failure[]=[];
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
export function reportModelFailure(owner:object,id:string,retry:()=>void){failures=[...failures.filter(f=>f.owner!==owner||f.id!==id),{owner,id,retry,retrying:false}];emit();}
export function clearModelFailure(owner:object,id?:string){const next=failures.filter(f=>f.owner!==owner||(id!==undefined&&f.id!==id));if(next.length!==failures.length){failures=next;emit();}}
export function retryModelFailures(ids:readonly string[]){const selected=failures.filter(f=>ids.includes(f.id)&&!f.retrying);failures=failures.map(f=>selected.includes(f)?{...f,retrying:true}:f);emit();selected.forEach(f=>f.retry());}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const useModelFailures=()=>useSyncExternalStore(subscribe,()=>failures);
