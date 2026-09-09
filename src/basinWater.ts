/** Bounded connected-basin fill: river sources feed low ground, not isolated hollows. */
export function basinWater(ground:number[],n:number,seeds:boolean[],level=-.20){
 const wet=new Uint8Array(n*n),queue:number[]=[];
 const corners=(cell:number)=>{const z=Math.floor(cell/n),x=cell%n,a=z*(n+1)+x;return [a,a+1,a+n+1,a+n+2]};
 const low=(cell:number)=>corners(cell).some(v=>ground[v*3+1]<level);
 for(let i=0;i<n*n;i++)if(seeds[i]&&low(i)){wet[i]=1;queue.push(i)}
 for(let head=0;head<queue.length;head++){
  const i=queue[head],x=i%n,z=Math.floor(i/n);
  for(const j of [x>0?i-1:-1,x<n-1?i+1:-1,z>0?i-n:-1,z<n-1?i+n:-1]){
   if(j<0||wet[j]||!low(j))continue;
   // Water cannot cross a shared edge wholly above its surface.
   const common=corners(i).filter(v=>corners(j).includes(v));
   if(common.every(v=>ground[v*3+1]>=level))continue;
   wet[j]=1;queue.push(j);
  }
 }
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[],beds:number[]=[];
 for(const cell of queue){const [a,b,c,d]=corners(cell);for(const triangle of [[a,c,b],[b,c,d]]){
  const polygon=triangle.map(v=>({x:ground[v*3],y:ground[v*3+1],z:ground[v*3+2]})),clipped:typeof polygon=[];
  for(let i=0;i<3;i++){const p=polygon[i],q=polygon[(i+1)%3],inside=p.y<level,next=q.y<level;if(inside)clipped.push(p);if(inside!==next){const t=(level-p.y)/(q.y-p.y);clipped.push({x:p.x+t*(q.x-p.x),y:level,z:p.z+t*(q.z-p.z)})}}
  if(clipped.length<3)continue;const offset=positions.length/3;
  for(const p of clipped){positions.push(p.x,level,p.z);beds.push(p.y);uvs.push(p.x/4,p.z/4)}
  for(let k=1;k<clipped.length-1;k++)indices.push(offset,offset+k,offset+k+1);
 }}
 return {positions,indices,uvs,beds,wet};
}
