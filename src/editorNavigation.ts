import {useSyncExternalStore} from 'react';
export type EditorRoute='home'|'editor'|'studio-home'|'studio-editor';
type Entry={screen:EditorRoute;index:number};
const read=():Entry=>window.history.state?.nookNavigation??{screen:'home',index:0};
let current:Entry={screen:'home',index:0},guard:(()=>boolean)|undefined,bypass=false,listening=false;
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(fn=>fn());
function pop(){const next=read();if(!bypass&&guard&&next.screen!==current.screen&&!guard()){bypass=true;window.history.go(current.index-next.index||1);return;}bypass=false;current=next;notify();}
function subscribe(fn:()=>void){if(!listening){current=read();window.addEventListener('popstate',pop);listening=true;}listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size){window.removeEventListener('popstate',pop);listening=false;}};}
export function useEditorRoute(){return useSyncExternalStore(subscribe,()=>read().screen,()=> 'home' as EditorRoute);}
export function navigateEditor(screen:EditorRoute,replace=false){const previous=read();current={screen,index:previous.index+(replace?0:1)};window.history[replace?'replaceState':'pushState']({...window.history.state,nookNavigation:current},'',window.location.pathname+window.location.search+window.location.hash);notify();}
export function leaveStudio(){const from=read();if(!from.screen.startsWith('studio-'))return;if(from.index>0){bypass=true;window.history.back();}else navigateEditor(from.screen==='studio-home'?'home':'editor',true);}
export function protectEditorNavigation(check:()=>boolean){guard=check;return()=>{if(guard===check)guard=undefined;};}
