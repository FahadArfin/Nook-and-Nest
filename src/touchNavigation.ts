/** A second finger takes over navigation until every finger is lifted. */
export function bindTouchNavigation(element:HTMLElement|SVGSVGElement, callbacks:{begin():void;move(dx:number,dy:number,scale:number,x:number,y:number):void;end():void;cancel():void}){
 const points=new Map<number,{x:number;y:number}>();let navigating=false;
 const sample=()=>{const [a,b]=[...points.values()];return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}:undefined};
 const block=(e:PointerEvent)=>{e.preventDefault();e.stopImmediatePropagation()};
 const down=(e:PointerEvent)=>{if(e.pointerType!=='touch')return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>=2){if(!navigating){navigating=true;callbacks.begin()}block(e)}};
 const move=(e:PointerEvent)=>{if(!points.has(e.pointerId))return;const before=sample();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(navigating){block(e);const after=sample();if(before&&after)callbacks.move(after.x-before.x,after.y-before.y,before.d/after.d,after.x,after.y)}};
 const up=(e:PointerEvent)=>{if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(navigating){block(e);if(!points.size){navigating=false;callbacks.end()}}else if(e.type==='pointercancel'){callbacks.cancel();block(e)}};
 const blur=()=>{if(points.size)callbacks.cancel();points.clear();if(navigating){navigating=false;callbacks.end()}};
 element.addEventListener('pointerdown',down as EventListener,true);element.addEventListener('pointermove',move as EventListener,true);element.addEventListener('pointerup',up as EventListener,true);element.addEventListener('pointercancel',up as EventListener,true);window.addEventListener('blur',blur);
 return()=>{blur();element.removeEventListener('pointerdown',down as EventListener,true);element.removeEventListener('pointermove',move as EventListener,true);element.removeEventListener('pointerup',up as EventListener,true);element.removeEventListener('pointercancel',up as EventListener,true);window.removeEventListener('blur',blur)};
}
