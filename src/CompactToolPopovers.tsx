import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Sun,SunHorizon,Moon,Wall,GridFour} from '@phosphor-icons/react';
import {usePlanner} from './store';
import {defaultSun} from './sunlight';

/** Portal into the canvas so scrolling toolbars cannot clip their popovers. */
function ToolPopover({anchor,open,side,label,onClose,children}:{anchor:RefObject<HTMLButtonElement|null>;open:boolean;side:'above'|'left';label:string;onClose:()=>void;children:ReactNode}){
 const panel=useRef<HTMLDivElement>(null),[host,setHost]=useState<Element|null>(null);
 useEffect(()=>{if(!open||label!=='Sunlight')return;const dismiss=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!anchor.current?.contains(e.target as Node))onClose()};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss)},[open,onClose,anchor,label]);

 useLayoutEffect(()=>{setHost(anchor.current?.closest('.canvas-stage')??null)},[anchor]);
 useLayoutEffect(()=>{
  if(!host||!panel.current||!anchor.current)return;
  const place=()=>{
   const a=anchor.current!.getBoundingClientRect(),h=host.getBoundingClientRect(),p=panel.current!;
   const x=side==='left'?a.left-h.left-p.offsetWidth-10:a.left-h.left+(a.width-p.offsetWidth)/2;
   const y=side==='left'?a.top-h.top:a.top-h.top-p.offsetHeight-10;
   p.style.left=`${Math.max(8,Math.min(x,h.width-p.offsetWidth-8))}px`;
   p.style.top=`${Math.max(8,Math.min(y,h.height-p.offsetHeight-8))}px`;
  };
  place();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(place);
  observer?.observe(host);observer?.observe(panel.current);observer?.observe(anchor.current);
  window.addEventListener('resize',place);host.addEventListener('scroll',place,true);
  return()=>{observer?.disconnect();window.removeEventListener('resize',place);host.removeEventListener('scroll',place,true)};
 },[host,anchor,side,open]);
 return host?createPortal(<div ref={panel} role="region" aria-label={label} aria-hidden={!open} inert={!open} className={`compact-tool-popover popover-${side} ${open?'is-open':''}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();anchor.current?.focus()}}}>{children}</div>,host):null;
}

export function EraseChoices({anchor,open,onClose}:{anchor:RefObject<HTMLButtonElement|null>;open:boolean;onClose:()=>void}){
 const s=usePlanner();
 return <ToolPopover anchor={anchor} open={open} side="above" label="Erase tools" onClose={onClose}>
  <div className="erase-squares">{([{tool:'wall-cut',label:'Walls',icon:Wall},{tool:'erase',label:'Floors',icon:GridFour}] as const).map(({tool,label,icon:Icon})=><button key={tool} aria-pressed={s.tool===tool} title={`Erase ${label.toLowerCase()}: drag an area, then confirm`} onClick={()=>s.setTool(tool)}><Icon size={24}/><span>{label}</span></button>)}</div>
 </ToolPopover>;
}

export function SunlightControl(){
 const s=usePlanner(),sun=s.plan.environment?.sun??defaultSun,anchor=useRef<HTMLButtonElement>(null);
 const presets=[{name:'Morning',azimuth:90,elevation:20,icon:SunHorizon},{name:'Afternoon',azimuth:180,elevation:65,icon:Sun},{name:'Evening',azimuth:270,elevation:15,icon:SunHorizon},{name:'Nighttime',azimuth:180,elevation:45,night:true,icon:Moon}];
 const [expanded,setExpanded]=useState(false);
 const close=()=>setExpanded(false);
 return <><button ref={anchor} aria-label="Sunlight" title="Sunlight & time of day" aria-pressed={sun.enabled} aria-expanded={expanded} className={sun.enabled?'active':''} onClick={()=>{if(!sun.enabled){s.setEnvironment({sun:{...sun,enabled:true,azimuth:180,elevation:65,night:false}});setExpanded(true)}else setExpanded(!expanded)}}><Sun/></button>
  <ToolPopover anchor={anchor} open={expanded&&sun.enabled} side="left" label="Sunlight" onClose={close}>
   <button role="switch" aria-checked={sun.enabled} className="sun-enable" onClick={()=>{s.setEnvironment({sun:{...sun,enabled:false}});close()}}>Turn sunlight off</button><div className="sun-time-grid">{presets.map(({name,icon:Icon,...value})=><button key={name} aria-pressed={sun.enabled&&!!sun.night===!!value.night&&(value.night||sun.azimuth===value.azimuth&&sun.elevation===value.elevation)} onClick={()=>{s.setEnvironment({sun:{enabled:true,...value}});close()}}><Icon size={23}/><span>{name}</span></button>)}</div>
   <small>Illustrative lighting · Plan north is up</small>
  </ToolPopover>
 </>;
}
