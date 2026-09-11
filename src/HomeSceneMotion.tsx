import {useEffect,useRef} from 'react';

import {motionPatches,motionMaskAlpha} from './homeMotionMasks';
const TAU=Math.PI*2;
const wave=(t:number)=>Math.sin(t)*.65+Math.sin(t*2.31+1.4)*.25+Math.sin(t*4.17)*.1;

/** Coordinates are in the authored 1536 x 1024 artwork, before object-fit cropping. */
export function HomeSceneMotion({src,moving}:{src:string;moving:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const elapsed=useRef(0);
 useEffect(()=>{
  const target=canvas.current;
  if(!target)return;
  const ctx=target.getContext('2d',{alpha:true});
  if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,disposed=false,ready=false,last=0;
  const image=new Image();
  const scene=src.includes('/fireside-')?'fire':src.includes('/rain-')?'rain':'morning';
  // Bounded backing surface, independent of device pixel ratio and monitor size.
  target.width=innerWidth<650?768:1152;target.height=target.width*2/3;
  const scale=target.width/1536;
  ctx.scale(scale,scale);
  const patches=motionPatches[scene];
  // Reusable surfaces use inward-feathered silhouettes, never rectangular masks.
  const surfaces=patches.map(p=>{
   const surface=document.createElement('canvas');surface.width=p.w;surface.height=p.h;
   const mask=document.createElement('canvas');mask.width=p.w;mask.height=p.h;
   const m=mask.getContext('2d')!;
   const pixels=m.createImageData(p.w,p.h);
   for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
    const offset=(y*p.w+x)*4;
    pixels.data[offset]=255;pixels.data[offset+1]=255;pixels.data[offset+2]=255;
    pixels.data[offset+3]=Math.round(motionMaskAlpha(p,p.x+x+.5,p.y+y+.5)*255);
   }
   m.putImageData(pixels,0,0);
   return {surface,mask,c:surface.getContext('2d')!};
  });
  function deform(t:number){
   patches.forEach((p,i)=>{
    const {surface,mask,c}=surfaces[i];c.clearRect(0,0,p.w,p.h);
    for(let y=0;y<p.h;y+=2){
     const v=y/p.h;
     let dx=0,dy=0;
     if(p.kind==='breath')dy=-3.5*(.5-.5*Math.cos(t*TAU/4.7+(p.phase||0)))*Math.sin(v*Math.PI);
     if(p.kind==='curtain')dx=(Math.sin(t*1.1+v*3+(p.phase||0))*5+Math.sin(t*.53+v*6)*2)*Math.sin(v*Math.PI);
     if(p.kind==='fire'){dx=wave(t*4.2-v*5)*2.8*Math.sin(v*Math.PI);dy=wave(t*3.1-v*7)*4*Math.sin(v*Math.PI);}
     c.drawImage(image,p.x+dx,p.y+y+dy,p.w,Math.min(2,p.h-y),0,y,p.w,Math.min(2,p.h-y));
    }
    c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);c.globalCompositeOperation='source-over';ctx!.drawImage(surface,p.x,p.y);
   });
  }
  function glow(x:number,y:number,r:number,alpha:number){
   const g=ctx!.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,184,65,${alpha})`);g.addColorStop(1,'rgba(255,148,38,0)');ctx!.fillStyle=g;ctx!.fillRect(x-r,y-r,r*2,r*2);
  }
  function flame(x:number,y:number,h:number,w:number,t:number,phase:number){
   const lean=wave(t*3.8+phase)*w*.65;
   const height=h*(1+wave(t*5+phase)*.16);
   const g=ctx!.createLinearGradient(x,y,x,y-height);g.addColorStop(0,'rgba(255,247,184,.9)');g.addColorStop(.36,'rgba(255,204,74,.8)');g.addColorStop(.8,'rgba(255,123,25,.45)');g.addColorStop(1,'rgba(255,105,18,0)');
   ctx!.fillStyle=g;ctx!.beginPath();ctx!.moveTo(x-w*.45,y);ctx!.bezierCurveTo(x-w,y-height*.35,x+lean-w*.2,y-height*.65,x+lean,y-height);ctx!.bezierCurveTo(x+lean+w*.3,y-height*.55,x+w,y-height*.25,x+w*.45,y);ctx!.closePath();ctx!.fill();
  }
  function candle(x:number,y:number,t:number,phase:number,size=1){
   glow(x,y-5,23*size,.09+wave(t*4+phase)*.025);flame(x,y,12*size,3.2*size,t,phase);
  }
  function steam(x:number,y:number,t:number,size=1,opacity=1){
   ctx!.save();ctx!.lineCap='round';
   for(let i=0;i<5;i++){
    const life=((t*.17+i/5)%1),rise=life*90*size;
    const alpha=Math.sin(life*Math.PI)*.085*opacity;
    const drift=Math.sin(t*.75+i*1.7)*life*15*size;
    const g=ctx!.createRadialGradient(x+drift,y-rise,0,x+drift,y-rise,(6+life*13)*size);
    g.addColorStop(0,`rgba(242,239,224,${alpha})`);g.addColorStop(1,'rgba(242,239,224,0)');ctx!.fillStyle=g;
    ctx!.beginPath();ctx!.ellipse(x+drift,y-rise,(6+life*13)*size,(12+life*12)*size,Math.sin(t+i)*.3,0,TAU);ctx!.fill();
   }
   ctx!.restore();
  }
  function rain(t:number){
   ctx!.save();ctx!.beginPath();ctx!.rect(1066,0,417,389);ctx!.clip();
   // Slow glass rivulets have different paths/speeds; no repeating diagonal rain sheet.
   for(let i=0;i<45;i++){
    const x=1074+(i*137.31)%401;
    const speed=8+(i%7)*3.7;
    const y=((t*speed+i*83.7)%455)-35;
    const length=9+(i%5)*5;
    const bend=Math.sin(y*.033+i)*1.7;
    const g=ctx!.createLinearGradient(x,y-length,x,y+2);g.addColorStop(0,'rgba(224,237,240,0)');g.addColorStop(1,'rgba(224,237,240,.22)');
    ctx!.strokeStyle=g;ctx!.lineWidth=.65+(i%3)*.22;ctx!.beginPath();ctx!.moveTo(x,y-length);ctx!.quadraticCurveTo(x+bend,y-length*.45,x+bend*.6,y);ctx!.stroke();
    // A tiny displaced sample acts as a refracted bead, with a restrained highlight.
    ctx!.save();ctx!.beginPath();ctx!.ellipse(x+bend*.6,y,1.25,2.3,0,0,TAU);ctx!.clip();ctx!.drawImage(image,x-3,y-4,6,8,x-1.5,y-2.5,3,5);ctx!.restore();
   }
   ctx!.restore();
  }
  function render(t:number){
   ctx!.clearRect(0,0,1536,1024);deform(t);
   if(scene==='fire'){
    glow(996,485,100,.07+wave(t*4)*.02);
    // Animate the authored flame texture itself; no repeated painted flame shapes.
    candle(492,675,t,0);candle(838,161,t,2,.8);candle(856,179,t,4,.6);candle(1506,685,t,3,1.7);
    steam(647,682,t);steam(492,660,t+.8,.5,.38);
    steam(838,149,t+2,.35,.28);steam(856,169,t+3,.3,.25);
   }else if(scene==='rain'){rain(t);steam(743,615,t);candle(566,713,t,1,.7);steam(566,700,t+1,.4,.3);}
   else steam(706,517,t);
  }
  function tick(now:number){
   if(disposed)return;
   if(!last)last=now;
   if(now-last>=1000/30){elapsed.current+=Math.min(now-last,70)/1000;last=now;render(elapsed.current);}
   raf=requestAnimationFrame(tick);
  }
  function sync(){
   cancelAnimationFrame(raf);last=0;
   if(reduced.matches){ctx!.clearRect(0,0,1536,1024);return;}
   if(ready&&moving&&!document.hidden)raf=requestAnimationFrame(tick);
  }
  image.onload=()=>{ready=true;if(!disposed){if(!reduced.matches)render(elapsed.current);sync();}};
  image.src=src;
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  return()=>{disposed=true;cancelAnimationFrame(raf);image.onload=null;reduced.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
 },[src,moving]);
 return <canvas ref={canvas} className="living-scene-motion" aria-hidden="true"/>;
}
