import {useEffect,useState} from 'react';
export const HOME_SCENES=['fireside','rain','morning'] as const;
export const SCENE_NAMES=['Fireside','Rainy afternoon','Sunday morning'];
export const HOME_AMBIENCE_KEY='nook-home-ambience-v1';
export const calendarDay=(date=new Date())=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
export type AmbiencePreference={anchor:number;pinned:number|null;paused:boolean};
export function readAmbience():AmbiencePreference{
 const fallback={anchor:calendarDay(),pinned:null,paused:false};
 try{const v=JSON.parse(localStorage.getItem(HOME_AMBIENCE_KEY)||'null');if(!v)return fallback;return {anchor:Number.isInteger(v.anchor)&&v.anchor>=0?v.anchor:fallback.anchor,pinned:Number.isInteger(v.pinned)&&v.pinned>=0&&v.pinned<3?v.pinned:null,paused:v.paused===true};}catch{return fallback}
}
export const sceneForDay=(p:AmbiencePreference,day=calendarDay())=>p.pinned??(Math.floor(Math.max(0,day-p.anchor)/2)%3);
export function useHomeAmbience(active:boolean){
 const [pref,setPref]=useState(readAmbience),[day,setDay]=useState(calendarDay),[visible,setVisible]=useState(!document.hidden);
 useEffect(()=>{try{localStorage.setItem(HOME_AMBIENCE_KEY,JSON.stringify(pref));}catch{}},[pref]);
 useEffect(()=>{if(!active)return;const update=()=>{setDay(calendarDay());setVisible(!document.hidden)};const stored=(e:StorageEvent)=>{if(e.key===HOME_AMBIENCE_KEY||e.key===null)setPref(readAmbience())};update();const timer=window.setInterval(update,60000);document.addEventListener('visibilitychange',update);window.addEventListener('storage',stored);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('storage',stored)}},[active]);
 const index=sceneForDay(pref,day);
 return {index,pref,moving:active&&visible&&!pref.paused,next:()=>setPref(p=>({...p,pinned:(sceneForDay(p,calendarDay())+1)%3})),automatic:()=>setPref(p=>({...p,pinned:null,anchor:calendarDay()-index*2})),pause:()=>setPref(p=>({...p,paused:!p.paused}))};
}
export function LivingBackground({scene,dark,moving}:{scene:number;dark:boolean;moving:boolean}){
 const requested=`/assets/ambience/${HOME_SCENES[scene]}-${dark?'night':'day'}.webp`;
 const [loaded,setLoaded]=useState(requested),[previous,setPrevious]=useState<string>();
 useEffect(()=>{if(requested===loaded)return;let cancelled=false;const image=new Image();image.src=requested;image.onload=()=>{if(!cancelled){setPrevious(loaded);setLoaded(requested)}};return()=>{cancelled=true;image.onload=null}},[requested,loaded]);
 useEffect(()=>{if(!previous)return;const t=setTimeout(()=>setPrevious(undefined),1100);return()=>clearTimeout(t)},[previous]);
 return <div className="living-background" data-moving={moving} data-scene={HOME_SCENES[scene]} aria-hidden="true">
  {previous&&<img className="living-previous" src={previous} alt=""/>}
  <img className="living-current" key={loaded} src={loaded} alt="" fetchPriority="high"/>
  {scene===0&&<img className="living-firelight" src={loaded} alt=""/>}
 </div>;
}
