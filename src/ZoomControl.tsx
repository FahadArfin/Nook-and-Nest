import {useEffect,useRef} from 'react';
import {Plus,Minus} from '@phosphor-icons/react';
export function ZoomControl({onZoom}:{onZoom:(factor:number)=>void}){
 const frame=useRef(0),callback=useRef(onZoom);callback.current=onZoom;
 const stop=()=>{cancelAnimationFrame(frame.current);frame.current=0};
 useEffect(()=>{window.addEventListener('blur',stop);return()=>{stop();window.removeEventListener('blur',stop)}},[]);
 const start=(direction:number)=>{stop();callback.current(Math.exp(direction*.09));let previous=performance.now();const tick=(now:number)=>{callback.current(Math.exp(direction*Math.min(40,now-previous)*.0015));previous=now;frame.current=requestAnimationFrame(tick)};frame.current=requestAnimationFrame(tick)};
 return <div className="zoom-control" role="group" aria-label="Zoom">{[{label:'Zoom in',direction:-1,icon:Plus},{label:'Zoom out',direction:1,icon:Minus}].map(({label,direction,icon:Icon})=><button key={label} aria-label={label} title={`${label} · hold for smooth zoom`} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);start(direction)}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={e=>{if(e.detail===0)callback.current(Math.exp(direction*.09))}}><Icon size={19}/></button>)}</div>;
}
