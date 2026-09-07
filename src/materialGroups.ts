import type {SurfaceFinish} from './surfaces';

/** Group physical formats for browsing; saved finish IDs remain unchanged. */
export function materialGroups(finishes:SurfaceFinish[]){
 const groups=new Map<string,{name:string;variants:SurfaceFinish[]}>();
 for(const finish of finishes){
  const name=finish.name.replace(/\s*·\s*\d+\s*×\s*\d+\s*cm$/, '');
  const key=`${finish.family}:${name}`;
  if(!groups.has(key))groups.set(key,{name,variants:[]});
  groups.get(key)!.variants.push(finish);
 }
 return [...groups.values()];
}
