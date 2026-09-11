/** Bounded, deterministic image evidence. Coordinates always refer to the original. */
export const PIPELINE_VERSION='luna-regions-v3';
export interface WallCandidate {axis:'h'|'v';x:number;y:number;width:number;height:number;solid?:true}
export interface ScanEvidence {version:string;walls:WallCandidate[];crops:{image:string;x:number;y:number;width:number;height:number}[];wallView?:{version:'wall-support-v1';image:string}}
export function extractWallCandidates(rgba:Uint8ClampedArray,width:number,height:number,sourceWidth=width,sourceHeight=height):WallCandidate[] {
  if(width<1||height<1||width*height>2_560_000||rgba.length!==width*height*4)throw new Error('Invalid analysis pixels.');
  const stride=width+1,integral=new Uint32Array(stride*(height+1));
  for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){const i=(y*width+x)*4;row+=rgba[i+3]>128&&rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114<150?1:0;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
  const sum=(x:number,y:number,w:number,h:number)=>integral[(y+h)*stride+x+w]-integral[y*stride+x+w]-integral[(y+h)*stride+x]+integral[y*stride+x];
  const walls:WallCandidate[]=[];const long=Math.max(18,Math.round(Math.max(width,height)*.038)),thick=Math.max(3,Math.round(Math.max(width,height)*.0045));
  for(const axis of ['h','v'] as const){
    const kw=axis==='h'?long:thick,kh=axis==='h'?thick:long,mask=new Uint8Array(width*height);
    for(let y=0;y<=height-kh;y++)for(let x=0;x<=width-kw;x++)if(sum(x,y,kw,kh)===kw*kh)mask[y*width+x]=1;
    const queue=new Int32Array(width*height);
    for(let p=0;p<mask.length;p++)if(mask[p]){let head=0,tail=1;queue[0]=p;mask[p]=0;let left=p%width,right=left,top=Math.floor(p/width),bottom=top;
      while(head<tail){const q=queue[head++],x=q%width,y=Math.floor(q/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const n of [x>0?q-1:-1,x+1<width?q+1:-1,y>0?q-width:-1,y+1<height?q+width:-1])if(n>=0&&mask[n]){mask[n]=0;queue[tail++]=n;}}
      const emit=(x:number,y:number,w:number,h:number)=>walls.push({axis,x:x*sourceWidth/width,y:y*sourceHeight/height,width:w*sourceWidth/width,height:h*sourceHeight/height,solid:true});
      if(sum(left,top,right-left+kw,bottom-top+kh)===(right-left+kw)*(bottom-top+kh))emit(left,top,right-left+kw,bottom-top+kh);
      else {
        // A connected erosion component is not necessarily a solid rectangle.
        // Reconstruct unions of its fully black kernels, retaining L/T corners
        // without painting their empty bounding-box corners as walls.
        const bands=new Map<number,number[]>();
        for(let n=0;n<tail;n++){const x=queue[n]%width,y=Math.floor(queue[n]/width),cross=axis==='h'?y:x,along=axis==='h'?x:y;const list=bands.get(cross);if(list)list.push(along);else bands.set(cross,[along]);}
        const strips:{start:number;end:number;first:number;last:number}[]=[],active=new Map<string,typeof strips[number]>();
        for(const [cross,values] of [...bands].sort((a,b)=>a[0]-b[0])){values.sort((a,b)=>a-b);for(let i=0;i<values.length;){let j=i;while(j+1<values.length&&values[j+1]===values[j]+1)j++;const start=values[i],end=values[j]+long,key=`${start}:${end}`,old=active.get(key);if(old&&old.last===cross-1)old.last=cross;else {const strip={start,end,first:cross,last:cross};strips.push(strip);active.set(key,strip);}i=j+1;}}
        for(const s of strips)if(axis==='h')emit(s.start,s.first,s.end-s.start,s.last-s.first+thick);else emit(s.first,s.start,s.last-s.first+thick,s.end-s.start);
      }
    }
  }
  return walls.sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,160).map(w=>Object.fromEntries(Object.entries(w).map(([k,v])=>[k,typeof v==='number'?Math.round(v*10)/10:v])) as unknown as WallCandidate);
}
export function validateEvidence(value:unknown,width:number,height:number):ScanEvidence|undefined {
  if(value===undefined)return;
  const e=value as ScanEvidence;
  const box=(r:{x:number;y:number;width:number;height:number})=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=width+.1&&r.y+r.height<=height+.1;
  if(!e||e.version!==PIPELINE_VERSION||!Array.isArray(e.walls)||e.walls.length>160||!e.walls.every(w=>box(w)&&['h','v'].includes(w.axis)&&(w.solid===undefined||w.solid===true))||!Array.isArray(e.crops)||e.crops.length>4||!e.crops.every(c=>box(c)&&typeof c.image==='string'&&c.image.length<1_500_000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(c.image)))throw new Error('Invalid analysis evidence. Reimport the image.');
  if(e.wallView!==undefined&&(!e.wallView||e.wallView.version!=='wall-support-v1'||typeof e.wallView.image!=='string'||e.wallView.image.length>1_500_000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(e.wallView.image)))throw new Error('Invalid wall evidence. Reimport the image.');
  return e;
}
