import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector';
/** Include each exported node transform, including articulated mesh origins. */
export function glbBounds(g:any){
 const result:{min:number[];max:number[]}[]=[];
 const walk=(index:number,parent:Matrix)=>{const n=g.nodes[index];const t=n.translation??[0,0,0],r=n.rotation??[0,0,0,1],s=n.scale??[1,1,1];const local=n.matrix?Matrix.FromArray(n.matrix):Matrix.Compose(Vector3.FromArray(s),Quaternion.FromArray(r),Vector3.FromArray(t));const world=local.multiply(parent);
 if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const a=g.accessors[p.attributes.POSITION],points:Vector3[]=[];for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])points.push(Vector3.TransformCoordinates(new Vector3(x,y,z),world));result.push({min:[0,1,2].map(i=>Math.min(...points.map(p=>p.asArray()[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p.asArray()[i])))});}
 for(const child of n.children??[])walk(child,world);};
 for(const root of g.scenes[g.scene??0].nodes)walk(root,Matrix.Identity());return result;
}
