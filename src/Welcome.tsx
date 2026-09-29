import {useEditorRoute,navigateEditor,leaveStudio} from './editorNavigation';
import './ux.css';
import {lazy,Suspense,useEffect,useRef,useState,type ComponentType} from 'react';
import {HouseLine,LockSimple,Monitor,Sun,Moon,SkipForward,Pause,Play,ArrowsClockwise,GearSix} from '@phosphor-icons/react';
import {AppearanceContext,useAppearance,useWelcomeTheme} from './useWelcomeTheme';
type PlanningRuntime={domain:typeof import('./domain');store:typeof import('./store')};
let planningRuntime:Promise<PlanningRuntime>|undefined;
const loadPlanning=()=>planningRuntime??=(Promise.all([import('./domain'),import('./store')]).then(([domain,store])=>({domain,store})).catch(error=>{planningRuntime=undefined;throw error;}));
type ProjectLibraryProps=Parameters<typeof import('./ProjectLibrary')['ProjectLibrary']>[0];
const ProjectLibrary=lazy(()=>import('./ProjectLibrary').then(m=>({default:m.ProjectLibrary})).catch(()=>({default:({onClose}:ProjectLibraryProps)=><section className="welcome-error" role="alert"><h2>Your projects could not load</h2><p>Check your connection and reload to try again.</p><button onClick={()=>location.reload()}>Reload</button><button onClick={onClose}>Close</button></section>})));
const BlueprintStudio=lazy(()=>import('./BlueprintStudio').then(m=>({default:m.BlueprintStudio})).catch(()=>({default:()=> <section role="alert"><h2>The floor planner could not load</h2><p>Check your connection and try again.</p><button onClick={()=>location.reload()}>Try again</button></section>})));
import type {PlanDocumentV1} from './types';
import './welcome.css';
import {LivingBackground,useHomeAmbience} from './HomeAmbience';
import './living-home.css';

export function Welcome({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const appearance=useWelcomeTheme();
 return <AppearanceContext.Provider value={appearance}><WelcomeContent Editor={Editor} showcase={showcase}/></AppearanceContext.Provider>;
}
function WelcomeContent({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const {theme,chooseTheme,dark}=useAppearance()!;
 const route=useEditorRoute(),editing=route==='editor'||route==='studio-editor',studio=route==='studio-home';const setEditing=(value:boolean)=>navigateEditor(value?'editor':'home');const setStudio=(value:boolean)=>value?navigateEditor('studio-home'):leaveStudio();
 const directLink=new URLSearchParams(location.hash.slice(1)).has('plan')||new URLSearchParams(location.hash.slice(1)).has('share');
 const [ready,setReady]=useState(!editing&&!studio&&!showcase&&!directLink),[starting,setStarting]=useState(false);
 const initialized=useRef(false);
 const [projects,setProjects]=useState(new URLSearchParams(location.search).has('projects'));
 const ambience=useHomeAmbience(!editing&&!studio&&!projects);
 const [error,setError]=useState('');
 const showcasePlanId=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(initialized.current||(!editing&&!studio&&!showcase&&!directLink))return;
  let active=true;setReady(false);
  (async()=>{try{const {store}=await loadPlanning();const plan=showcase?showcase():await store.loadPlan();if(!active)return;
   if(plan){if(showcase)showcasePlanId.current=plan.id;store.usePlanner.getState().replacePlan(plan);}initialized.current=true;
   if(showcase||directLink)navigateEditor('editor',true);
  }catch{if(active){setError('We could not open the saved or shared project. Your existing saves have not been removed.');navigateEditor('home',true);}}
  finally{if(active)setReady(true);}})();return()=>{active=false};
 },[editing,studio,showcase,directLink]);
 const start=async(floorPlan:boolean)=>{if(starting)return;setStarting(true);setError('');try{const {domain,store}=await loadPlanning();store.usePlanner.getState().replacePlan(domain.createBlankPlan());initialized.current=true;setReady(true);window.history.replaceState(window.history.state,'',location.pathname);navigateEditor(floorPlan?'studio-home':'editor');}catch{setError('The editor could not load. Check your connection and try again.');}finally{setStarting(false);}};
 const openExisting=()=>{initialized.current=true;setReady(true);setEditing(true);};
 const home=async()=>{try{const {store}=await loadPlanning();const plan=store.usePlanner.getState().plan;if(plan.id!==showcasePlanId.current)await store.savePlan(plan);store.usePlanner.getState().setTool('select');store.usePlanner.getState().select(undefined);setEditing(false);window.history.replaceState(window.history.state,'',location.pathname);}catch{window.alert('Your project could not be saved locally. Export a backup before leaving the editor.');}};
 if(editing&&ready)return <Editor onHome={home}/>;
 return <main className="welcome-page" data-theme={dark?'dark':'light'}>
  <LivingBackground scene={ambience.index} dark={dark} moving={ambience.moving}/>
  <div className="living-layout">
   <header className="living-header">
    <button className="living-icon" aria-label={dark?'Use light theme':'Use dark theme'} title={dark?'Daytime':'Nighttime'} onClick={()=>chooseTheme(dark?'light':'dark')}>{dark?<Moon size={26}/>:<Sun size={26}/>}</button>
    <button className="living-icon" aria-label="Next background" title="Next background · keep my choice" onClick={ambience.next}><SkipForward size={24}/></button>
    <details className="living-preferences"><summary aria-label="Background preferences" title="Background preferences"><GearSix size={23}/></summary>
     <div><button aria-pressed={ambience.pref.pinned===null} onClick={ambience.automatic}><ArrowsClockwise/>Rotate every two days</button><button aria-label="Use system theme" aria-pressed={theme==='system'} onClick={()=>chooseTheme('system')}><Monitor/>Follow device appearance</button></div>
    </details>
   </header>
   <section className="living-menu" aria-labelledby="welcome-title">
    <a href="/" aria-label="Nook and Nest home" className="living-brand"><HouseLine size={72} weight="thin"/><h1 id="welcome-title">Nook &amp; Nest</h1></a>
    <p>Come in. Get comfortable.</p>
    {error&&<p role="alert" className="welcome-error">{error}</p>}
    {starting&&<p role="status">Opening your workspace…</p>}
    <nav aria-label="Start planning">
     <button disabled={!ready||starting} className="living-start" onClick={()=>start(true)}>Draw a floor plan</button>
     <button disabled={!ready||starting} className="living-editor" aria-label="Design in 3D" onClick={()=>start(false)}>Design in 3D</button>
     <button disabled={!ready||starting} className="living-editor" onClick={()=>setProjects(true)}>My projects</button>
    </nav>
   </section>
   <footer className="living-footer"><span><LockSimple size={14}/>Saved on this device</span><button className="living-icon" aria-label={ambience.pref.paused?'Resume background motion':'Pause background motion'} aria-pressed={ambience.pref.paused} onClick={ambience.pause}>{ambience.pref.paused?<Play size={23}/>:<Pause size={23}/>}</button></footer>
  </div>
  {projects&&ready&&<Suspense fallback={<p role="status">Opening your projects…</p>}><ProjectLibrary browseOnly onClose={()=>setProjects(false)} onOpen={openExisting}/></Suspense>}
  {studio&&ready&&<Suspense fallback={<p role="status">Opening the floor planner…</p>}><BlueprintStudio onHome={()=>navigateEditor('home',true)} onClose={()=>setStudio(false)} onCreated={openExisting}/></Suspense>}
 </main>;
}
