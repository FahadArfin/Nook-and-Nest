import {useEffect,useRef,type ReactNode} from 'react';
import {usePlanner} from './store';
import {isWallOpening,isKitchenWall,isStairs} from './catalog';
import type {FurniturePlacement} from './types';
/** A tap is a precise step; a hold streams small frame-time-based turns. */
export function TurnButton({direction,children,onStep,onStart,onEnd,discrete=false,label}:{direction:1|-1;children:ReactNode;onStep:(degrees:number)=>void;onStart?:()=>void;onEnd?:()=>void;discrete?:boolean;label?:string}){
 const callbacks=useRef({onStep,onStart,onEnd});callbacks.current={onStep,onStart,onEnd};
 const frame=useRef(0),held=useRef(false),pointerClick=useRef(false);
 const stop=()=>{cancelAnimationFrame(frame.current);if(held.current){held.current=false;callbacks.current.onEnd?.();}};
 useEffect(()=>{window.addEventListener('blur',stop);return()=>{window.removeEventListener('blur',stop);stop();}},[]);
 return <button aria-label={label??(direction<0?'Rotate left':'Rotate right')} title="Tap to turn; hold for smooth rotation" style={{touchAction:'none'}}
  onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);pointerClick.current=true;held.current=true;callbacks.current.onStart?.();callbacks.current.onStep(direction*15);let last=performance.now(),start=last;
   const tick=(now:number)=>{if(!held.current)return;if(now-start>220&&!discrete)callbacks.current.onStep(direction*Math.min(40,now-last)*.075);last=now;frame.current=requestAnimationFrame(tick);};if(!discrete)frame.current=requestAnimationFrame(tick);}}
  onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
  onClick={e=>{if(pointerClick.current&&e.detail!==0){pointerClick.current=false;return;}pointerClick.current=false;callbacks.current.onStart?.();callbacks.current.onStep(direction*15);callbacks.current.onEnd?.();}}>{children}</button>;
}
export function FurnitureTurnButton({item,direction,children}:{item:FurniturePlacement;direction:1|-1;children:ReactNode}){
 return <TurnButton label={typeof children==='string'?children:undefined} direction={direction} discrete={isWallOpening(item.catalogId)||isKitchenWall(item.catalogId)||isStairs(item.catalogId)} onStart={()=>usePlanner.getState().beginTurn(item.id)} onStep={degrees=>usePlanner.getState().turnFurniture(item.id,degrees)} onEnd={()=>usePlanner.getState().finishTurn()}>{children}</TurnButton>;
}
