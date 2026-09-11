import {useSyncExternalStore} from 'react';

export const editorPreferencesKey = 'nook-editor-preferences-v1';
export type QuickPin = 'brush' | 'finishes' | 'grid';
export type EditorPreferences = {pins:QuickPin[]; recentModels:string[]; recentFinishes:string[]; dismissedHints:string[]};
const defaults:EditorPreferences = {pins:[],recentModels:[],recentFinishes:[],dismissedHints:[]};
const strings=(value:unknown,limit:number)=>Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==='string'&&v.length<120))].slice(0,limit):[];
export function parseEditorPreferences(raw:string|null):EditorPreferences {
  try {const value=JSON.parse(raw??'null');if(!value||typeof value!=='object')return defaults;
    return {pins:strings(value.pins,3).filter((p):p is QuickPin=>['brush','finishes','grid'].includes(p)),recentModels:strings(value.recentModels,12),recentFinishes:strings(value.recentFinishes,6),dismissedHints:strings(value.dismissedHints,8)};
  } catch {return defaults;}
}
let snapshot=defaults;
try {snapshot=parseEditorPreferences(localStorage.getItem(editorPreferencesKey));} catch {/* Session preferences still work without storage. */}
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
function write(next:EditorPreferences){snapshot=next;try {localStorage.setItem(editorPreferencesKey,JSON.stringify(next));} catch {}emit();}
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===editorPreferencesKey||event.key===null){snapshot=parseEditorPreferences(event.newValue);emit();}});
export const useEditorPreferences=()=>useSyncExternalStore(subscribe,()=>snapshot,()=>defaults);
export const toggleQuickPin=(pin:QuickPin)=>write({...snapshot,pins:snapshot.pins.includes(pin)?snapshot.pins.filter(p=>p!==pin):[...snapshot.pins,pin]});
export const rememberModel=(id:string)=>write({...snapshot,recentModels:[id,...snapshot.recentModels.filter(v=>v!==id)].slice(0,12)});
export const rememberFinish=(id:string)=>write({...snapshot,recentFinishes:[id,...snapshot.recentFinishes.filter(v=>v!==id)].slice(0,6)});
export const dismissEditorHint=(id:string)=>write({...snapshot,dismissedHints:[...new Set([...snapshot.dismissedHints,id])].slice(-8)});
