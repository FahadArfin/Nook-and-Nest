import {useEditorRoute,navigateEditor,leaveStudio} from './editorNavigation';
import {PlanThumbnail} from './PlanThumbnail';
import './ux.css';
import {useEffect,useState,type ComponentType} from 'react';
import {HouseLine,FolderOpen,LockSimple,Monitor,Sun,Moon,SkipForward,Pause,Play,ArrowsClockwise} from '@phosphor-icons/react';
import {AppearanceContext,useAppearance,useWelcomeTheme} from './useWelcomeTheme';
import {createBlankPlan} from './domain';
import {loadPlan,savePlan,usePlanner,listLocalPlans} from './store';
import {ProjectLibrary} from './ProjectLibrary';
import {BlueprintStudio} from './BlueprintStudio';
import type {PlanDocumentV1} from './types';
import './welcome.css';
import {LivingBackground,useHomeAmbience,SCENE_NAMES} from './HomeAmbience';
import './living-home.css';

export function Welcome({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const appearance=useWelcomeTheme();
 return <AppearanceContext.Provider value={appearance}><WelcomeContent Editor={Editor} showcase={showcase}/></AppearanceContext.Provider>;
}
function WelcomeContent({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const {theme,chooseTheme,dark}=useAppearance()!;
 const [ready,setReady]=useState(false);const route=useEditorRoute(),editing=route==='editor'||route==='studio-editor',studio=route==='studio-home';const setEditing=(value:boolean)=>navigateEditor(value?'editor':'home');const setStudio=(value:boolean)=>value?navigateEditor('studio-home'):leaveStudio();
 const [projects,setProjects]=useState(new URLSearchParams(location.search).has('projects'));
 const ambience=useHomeAmbience(!editing&&!studio&&!projects);
 const [recentsOpen,setRecentsOpen]=useState(false);
 const [error,setError]=useState('');const [recent,setRecent]=useState<PlanDocumentV1[]>([]);useEffect(()=>{let active=true;listLocalPlans().then(plans=>{if(active)setRecent(plans.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3))}).catch(()=>{});return()=>{active=false}},[editing,projects]);
 useEffect(()=>{let active=true;
  (async()=>{try{const plan=showcase?showcase():await loadPlan();if(!active)return;if(plan)usePlanner.getState().replacePlan(plan);
   if(showcase||(new URLSearchParams(location.hash.slice(1)).has('plan')||new URLSearchParams(location.hash.slice(1)).has('share')))navigateEditor('editor',true);
  }catch{if(active)setError('We could not open the saved or shared project. Your existing saves have not been removed.');}
  finally{if(active)setReady(true);}})();return()=>{active=false};
 },[]);
 const start=(floorPlan:boolean)=>{usePlanner.getState().replacePlan(createBlankPlan());window.history.replaceState(window.history.state,'',location.pathname);navigateEditor(floorPlan?'studio-home':'editor');};
 const home=async()=>{try{await savePlan(usePlanner.getState().plan);usePlanner.getState().setTool('select');usePlanner.getState().select(undefined);setEditing(false);window.history.replaceState(window.history.state,'',location.pathname);}catch{window.alert('Your project could not be saved locally. Export a backup before leaving the editor.');}};
 if(editing&&ready)return <Editor onHome={home}/>;
 return <main className="welcome-page" data-theme={dark?'dark':'light'}>
  <LivingBackground scene={ambience.index} dark={dark} moving={ambience.moving}/>
  <div className="living-layout">
   <header className="living-header">
    <button className="living-projects" disabled={!ready} onClick={()=>setProjects(true)}><FolderOpen size={23}/>My projects</button>
    <button className="living-icon" aria-label={dark?'Use light theme':'Use dark theme'} title={dark?'Daytime':'Nighttime'} onClick={()=>chooseTheme(dark?'light':'dark')}>{dark?<Moon size={26}/>:<Sun size={26}/>}</button>
    <button className="living-icon" aria-label="Next background" title="Next background · keep my choice" onClick={ambience.next}><SkipForward size={24}/></button>
    <details className="living-preferences"><summary aria-label="Background preferences" title="Background preferences">{SCENE_NAMES[ambience.index]} <span>{ambience.pref.pinned===null?'Auto':'Pinned'}</span></summary>
     <div><button aria-pressed={ambience.pref.pinned===null} onClick={ambience.automatic}><ArrowsClockwise/>Rotate every two days</button><button aria-label="Use system theme" aria-pressed={theme==='system'} onClick={()=>chooseTheme('system')}><Monitor/>Follow device appearance</button></div>
    </details>
   </header>
   <section className="living-menu" aria-labelledby="welcome-title">
    <a href="/" aria-label="Nook and Nest home" className="living-brand"><HouseLine size={72} weight="thin"/><h1 id="welcome-title">Nook &amp; Nest</h1></a>
    <p>Come in. Get comfortable.</p>
    {error&&<p role="alert" className="welcome-error">{error}</p>}
    <nav aria-label="Start planning">
     <button disabled={!ready} className="living-start" onClick={()=>start(true)}>Create floor plan</button>
     <button disabled={!ready} className="living-editor" aria-label="Open 3D editor" onClick={()=>start(false)}>Open 3D editor</button>
     <div className="living-recents-menu" onMouseEnter={()=>setRecentsOpen(true)} onMouseLeave={()=>setRecentsOpen(false)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setRecentsOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();e.currentTarget.querySelector('button')?.focus();setRecentsOpen(false)}}}>
      <button className="living-editor" aria-expanded={recentsOpen} aria-controls="recent-projects" onClick={()=>setRecentsOpen(true)} onFocus={()=>setRecentsOpen(true)}>Recents</button>
      {recentsOpen&&<div id="recent-projects" className="living-recents-popup" role="region" aria-label="Recent projects">
       {recent.length?recent.map(project=><button className="living-recent-tile" disabled={!ready} key={project.id} onClick={()=>{usePlanner.getState().replacePlan(project);window.history.replaceState(window.history.state,'',location.pathname);setEditing(true)}}><PlanThumbnail plan={project}/><strong>{project.name}</strong><small>{new Date(project.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></button>):<p>No recent projects yet. Your saved projects will appear here.</p>}
      </div>}
     </div>
    </nav>
   </section>
   <footer className="living-footer"><span><LockSimple size={14}/>Saved on this device</span><button className="living-icon" aria-label={ambience.pref.paused?'Resume background motion':'Pause background motion'} aria-pressed={ambience.pref.paused} onClick={ambience.pause}>{ambience.pref.paused?<Play size={23}/>:<Pause size={23}/>}</button></footer>
  </div>
  {projects&&ready&&<ProjectLibrary browseOnly onClose={()=>setProjects(false)} onOpen={()=>setEditing(true)}/>}
  {studio&&ready&&<BlueprintStudio onHome={()=>navigateEditor('home',true)} onClose={()=>setStudio(false)} onCreated={()=>setEditing(true)}/>}
 </main>;
}
