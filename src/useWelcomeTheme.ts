import {createContext,useContext,useEffect,useState} from 'react';

export type WelcomeTheme = 'system'|'light'|'dark';
export const WELCOME_THEME_KEY = 'nook-welcome-theme';
export const AppearanceContext = createContext<ReturnType<typeof useWelcomeTheme>|null>(null);
export const useAppearance = () => useContext(AppearanceContext);
const preference = (value:string|null):WelcomeTheme => value==='light'||value==='dark'?value:'system';
const readPreference = ():WelcomeTheme => {try{return preference(localStorage.getItem(WELCOME_THEME_KEY));}catch{return 'system';}};
const systemDark = () => typeof window.matchMedia==='function'&&window.matchMedia('(prefers-color-scheme: dark)').matches;

// Appearance belongs to this browser, never to a saved apartment or its undo history.
export function useWelcomeTheme(){
 const [theme,setTheme]=useState<WelcomeTheme>(readPreference);
 const [darkSystem,setDarkSystem]=useState(systemDark);
 useEffect(()=>{
  const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-color-scheme: dark)'):undefined;
  const changed=()=>setDarkSystem(!!media?.matches);
  const stored=(event:StorageEvent)=>{if(event.key===WELCOME_THEME_KEY||event.key===null)setTheme(readPreference());};
  changed();media?.addEventListener('change',changed);window.addEventListener('storage',stored);
  return()=>{media?.removeEventListener('change',changed);window.removeEventListener('storage',stored);};
 },[]);
 const chooseTheme=(value:WelcomeTheme)=>{setTheme(value);try{localStorage.setItem(WELCOME_THEME_KEY,value);}catch{/* Appearance still works when storage is unavailable. */}};
 return {theme,chooseTheme,dark:theme==='dark'||(theme==='system'&&darkSystem)};
}
