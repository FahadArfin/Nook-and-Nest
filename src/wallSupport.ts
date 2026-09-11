/** Original implementation of standard Otsu/opening/component filters.
 * No inferred door closures, rescaling of coordinates, or semantic room guesses.
 */
export const WALL_SUPPORT_VERSION='wall-support-v1';
export interface WallSupport {mask:Uint8ClampedArray;width:number;height:number;components:number;threshold:number}
export function wallSupport(pixels:Uint8ClampedArray,width:number,height:number):WallSupport {
  const n=width*height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||n>2_560_000||pixels.length!==n*4)throw new Error('Invalid wall pixels.');
  const gray=new Uint8Array(n),hist=new Uint32Array(256);let total=0;
  for(let i=0;i<n;i++){const k=i*4,a=pixels[k+3]/255;const value=Math.round((pixels[k]*.299+pixels[k+1]*.587+pixels[k+2]*.114)*a+255*(1-a));gray[i]=value;hist[value]++;total+=value;}
  let count=0,sum=0,best=-1,threshold=0;
  for(let t=0;t<255;t++){count+=hist[t];sum+=hist[t]*t;if(!count||count===n)continue;const difference=sum/count-(total-sum)/(n-count),score=count*(n-count)*difference*difference;if(score>best){best=score;threshold=t;}}
  const ink=Uint8Array.from(gray,g=>g<=threshold?1:0),size=Math.max(3,Math.round(Math.max(width,height)*.0035))|1,radius=(size-1)/2;
  const filter=(input:Uint8Array,erode:boolean)=>{
    const stride=width+1,integral=new Uint32Array(stride*(height+1)),output=new Uint8Array(n);
    for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){row+=input[y*width+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const x0=Math.max(0,x-radius),y0=Math.max(0,y-radius),x1=Math.min(width,x+radius+1),y1=Math.min(height,y+radius+1);const s=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];output[y*width+x]=erode?Number(s===(x1-x0)*(y1-y0)):Number(s>0);}
    return output;
  };
  const opened=filter(filter(ink,true),false),queue=new Int32Array(n),mask=new Uint8ClampedArray(n*4).fill(255);let components=0;
  for(let start=0;start<n;start++)if(opened[start]){
    let head=0,tail=1;queue[0]=start;opened[start]=0;let left=start%width,right=left,top=Math.floor(start/width),bottom=top;
    while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const q of [x?p-1:-1,x+1<width?p+1:-1,y?p-width:-1,y+1<height?p+width:-1])if(q>=0&&opened[q]){opened[q]=0;queue[tail++]=q;}
    }
    if(Math.max(right-left+1,bottom-top+1)<Math.max(width,height)*.045||tail<n*.00015)continue;
    components++;
    for(let i=0;i<tail;i++){const k=queue[i]*4;mask[k]=mask[k+1]=mask[k+2]=0;}
  }
  return {mask,width,height,components,threshold};
}
