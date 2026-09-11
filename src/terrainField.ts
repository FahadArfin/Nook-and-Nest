import {terrainSampler} from './terrain';
import type {TerrainStroke} from './terrain';
import type {PlanDocumentV1} from './types';
/** Cache unaffected samples across live strokes; rebuild on coordinate/architecture changes. */
export class TerrainField {
 private key='';private signatures:string[]=[];private strokes:TerrainStroke[]=[];private values:Array<ReturnType<ReturnType<typeof terrainSampler>>>=[];
 sample(plan:PlanDocumentV1,minX:number,minZ:number,dx:number,dz:number,n:number){
  const key=JSON.stringify([plan.id,plan.gridSizeMm,plan.floors,minX,minZ,dx,dz,n]),strokes=plan.environment?.terrain??[],signatures=strokes.map(s=>JSON.stringify(s));
  let first=0;while(first<Math.min(signatures.length,this.signatures.length)&&signatures[first]===this.signatures[first])first++;
  const changed=[...strokes.slice(first),...this.strokes.slice(first)],sample=terrainSampler(plan),reset=key!==this.key;
  const boxes=changed.map(s=>({minX:Math.min(...s.points.map(p=>p.x))-s.radius,maxX:Math.max(...s.points.map(p=>p.x))+s.radius,minZ:Math.min(...s.points.map(p=>p.z))-s.radius,maxZ:Math.max(...s.points.map(p=>p.z))+s.radius}));
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=minX+x*dx,pz=minZ+z*dz,i=z*(n+1)+x;if(reset||!this.values[i]||boxes.some(b=>px>=b.minX&&px<=b.maxX&&pz>=b.minZ&&pz<=b.maxZ))this.values[i]=sample(px,pz)}
  this.key=key;this.signatures=signatures;this.strokes=strokes.map(s=>({...s,points:s.points.map(p=>({...p}))}));return this.values;
 }
}
