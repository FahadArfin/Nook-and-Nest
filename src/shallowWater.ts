/** Conservative height-field flow. Sealed boundaries, wet/dry banks and bounded source rate.
 * Fluxes retain momentum; donor limiting prevents negative depth without creating water.
 * Rendering state only: terrain/source strokes remain the saved source of truth. */
export class ShallowWater {
 activeBounds={minX:0,minZ:0,maxX:0,maxZ:0};
 readonly depth:Float64Array; readonly bed:Float64Array; readonly source:Uint8Array;
 readonly sourceLevel:Float64Array;readonly flow:Float32Array;readonly blocked:Uint8Array;
 private previous:Float64Array;private quiet=0;asleep=false;
 private qx:Float64Array; private qz:Float64Array; private outgoing:Float64Array;
 constructor(readonly size:number,readonly dx:number,readonly dz:number){
  const count=size*size;this.depth=new Float64Array(count);this.bed=new Float64Array(count);this.source=new Uint8Array(count);this.sourceLevel=new Float64Array(count).fill(-.2);this.flow=new Float32Array(count*2);this.blocked=new Uint8Array(count);
  this.previous=new Float64Array(count);this.qx=new Float64Array(count);this.qz=new Float64Array(count);this.outgoing=new Float64Array(count);
 }
 setTerrain(bed:ArrayLike<number>,source:ArrayLike<number>,blocked?:ArrayLike<number>){this.quiet=0;this.asleep=false;this.bed.set(bed);this.source.set(source);if(blocked)this.blocked.set(blocked);else this.blocked.fill(0);
  if(this.depth.some((h,i)=>h>0&&this.blocked[i])){const owners=new Int32Array(this.depth.length).fill(-1),queue=new Int32Array(this.depth.length);let head=0,tail=0;for(let i=0;i<owners.length;i++)if(!this.blocked[i]){owners[i]=i;queue[tail++]=i}while(head<tail){const i=queue[head++],x=i%this.size;for(const j of [x>0?i-1:-1,x+1<this.size?i+1:-1,i-this.size,i+this.size])if(j>=0&&j<owners.length&&owners[j]<0){owners[j]=owners[i];queue[tail++]=j}}for(let i=0;i<owners.length;i++)if(this.blocked[i]&&owners[i]>=0){this.depth[owners[i]]+=this.depth[i];this.depth[i]=0;}}
 }
 step(dt=1/30,sourceRate=.18){
  if(this.asleep)return false;this.previous.set(this.depth);
  dt=Math.max(0,Math.min(1/30,dt));if(!dt)return;
  const {size:n,depth:h,bed:b,qx,qz,outgoing:o}=this;o.fill(0);this.flow.fill(0);
  let minX=n,minZ=n,maxX=-1,maxZ=-1;
  for(let i=0;i<h.length;i++)if(h[i]>0||this.source[i]||qx[i]!==0||qz[i]!==0){const x=i%n,z=Math.floor(i/n);minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z)}
  if(maxX<0)return;
  minX=Math.max(0,minX-1);minZ=Math.max(0,minZ-1);maxX=Math.min(n-1,maxX+1);maxZ=Math.min(n-1,maxZ+1);this.activeBounds={minX,minZ,maxX,maxZ};
  for(let i=0;i<h.length;i++)if(this.source[i]&&!this.blocked[i])h[i]+=Math.max(0,Math.min(sourceRate*dt,this.sourceLevel[i]-b[i]-h[i]));
  const edge=(i:number,j:number,q:Float64Array,spacing:number)=>{
   if(this.blocked[i]||this.blocked[j]){q[i]=0;return;}
   const a=b[i]+h[i],c=b[j]+h[j],wet=Math.max(0,Math.max(a,c)-Math.max(b[i],b[j]));
   q[i]=wet>0?(q[i]+dt*9.81*Math.min(wet,4)*(a-c)/(spacing*spacing))*.94:0;
   o[q[i]>0?i:j]+=Math.abs(q[i])*dt;
  };
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const i=z*n+x;if(x+1<n)edge(i,i+1,qx,this.dx);if(z+1<n)edge(i,i+n,qz,this.dz);}
  for(let i=0;i<h.length;i++)o[i]=o[i]>0?Math.min(1,Math.max(0,h[i])/o[i]):1;
  const transfer=(i:number,j:number,q:Float64Array,axis:number,spacing:number)=>{
   q[i]*=o[q[i]>0?i:j];const amount=q[i]*dt;h[i]-=amount;h[j]+=amount;
   const velocity=Math.max(-3,Math.min(3,q[i]*spacing/Math.max(.05,(h[i]+h[j])*.5)))*.5;
   this.flow[i*2+axis]+=velocity;this.flow[j*2+axis]+=velocity;
  };
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const i=z*n+x;if(x+1<n)transfer(i,i+1,qx,0,this.dx);if(z+1<n)transfer(i,i+n,qz,1,this.dz);}
  let delta=0;for(let i=0;i<h.length;i++){h[i]=Math.max(0,h[i]);delta=Math.max(delta,Math.abs(h[i]-this.previous[i]))}this.quiet=delta<1e-7?this.quiet+1:0;this.asleep=this.quiet>90;return true;
 }
 volume(){return this.depth.reduce((a,b)=>a+b,0)*this.dx*this.dz;}
}
