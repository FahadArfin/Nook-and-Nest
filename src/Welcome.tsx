import {useEffect,useState,type ComponentType} from 'react';
import {CaretRight,Armchair,FolderOpen,GridFour,Leaf,LockSimple,Monitor,Sun,Moon} from '@phosphor-icons/react';
import {AppearanceContext,useAppearance,useWelcomeTheme} from './useWelcomeTheme';
import {createBlankPlan} from './domain';
import {loadPlan,savePlan,usePlanner} from './store';
import {ProjectLibrary} from './ProjectLibrary';
import {BlueprintStudio} from './BlueprintStudio';
import type {PlanDocumentV1} from './types';
import './welcome.css';

export function Welcome({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const appearance=useWelcomeTheme();
 return <AppearanceContext.Provider value={appearance}><WelcomeContent Editor={Editor} showcase={showcase}/></AppearanceContext.Provider>;
}
function WelcomeContent({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
 const {theme,chooseTheme,dark}=useAppearance()!;
 const [ready,setReady]=useState(false),[editing,setEditing]=useState(false),[studio,setStudio]=useState(false);
 const [projects,setProjects]=useState(new URLSearchParams(location.search).has('projects'));
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;
  (async()=>{try{const plan=showcase?showcase():await loadPlan();if(!active)return;if(plan)usePlanner.getState().replacePlan(plan);
   if(showcase||new URLSearchParams(location.hash.slice(1)).has('plan'))setEditing(true);
  }catch{if(active)setError('We could not open the saved or shared project. Your existing saves have not been removed.');}
  finally{if(active)setReady(true);}})();return()=>{active=false};
 },[]);
 const start=(floorPlan:boolean)=>{usePlanner.getState().replacePlan(createBlankPlan());window.history.replaceState(null,'',location.pathname);setStudio(floorPlan);setEditing(!floorPlan);};
 const home=async()=>{try{await savePlan(usePlanner.getState().plan);usePlanner.getState().setTool('select');usePlanner.getState().select(undefined);setEditing(false);window.history.replaceState(null,'',location.pathname);}catch{window.alert('Your project could not be saved locally. Export a backup before leaving the editor.');}};
 if(editing)return <Editor onHome={home}/>;
 return <main className="welcome-page" data-theme={dark?'dark':'light'}>
  <div className="welcome-layout">
   <header className="welcome-header"><a href="/" aria-label="Nook and Nest home"><img src="/assets/nook-nest-icon.png" alt="" width="60" height="60"/><span>Nook &amp; Nest</span></a>
    <div className="welcome-header-right"><span className="welcome-tagline"><Leaf size={20}/> Your next happy place</span>
     <div className="welcome-theme" role="group" aria-label="Appearance">
      <button aria-label="Use system theme" aria-pressed={theme==='system'} title="Follow your device appearance" onClick={()=>chooseTheme('system')}><Monitor/><span>System</span></button>
      <button aria-label="Use light theme" aria-pressed={theme==='light'} title="Light theme" onClick={()=>chooseTheme('light')}><Sun/><span>Light</span></button>
      <button aria-label="Use dark theme" aria-pressed={theme==='dark'} title="Dark theme" onClick={()=>chooseTheme('dark')}><Moon/><span>Dark</span></button>
     </div>
    </div>
   </header>
   <section className="welcome-content" aria-labelledby="welcome-title">
    <div className="welcome-copy"><h1 id="welcome-title">A little space.<br/>A lot of possibility.</h1><p>Make yourself at home.<br/>Start with a blank canvas.</p></div>
    {error&&<p role="alert" className="welcome-error">{error}</p>}
    <nav className="welcome-choices" aria-label="Start planning">
     <button disabled={!ready} className="welcome-choice welcome-primary" onClick={()=>start(true)}><span className="welcome-choice-icon"><GridFour/></span><span className="welcome-choice-copy"><span className="welcome-choice-title">Create floor plan</span><span className="welcome-choice-description">Draw your rooms or trace a reference,<br className="welcome-wide-break"/> then bring your layout into 3D.</span></span><CaretRight className="welcome-choice-arrow"/></button>
     <button disabled={!ready} className="welcome-choice welcome-editor" onClick={()=>start(false)}><span className="welcome-choice-icon"><Armchair/></span><span className="welcome-choice-copy"><span className="welcome-choice-title">Free 3D editor</span><span className="welcome-choice-description">Furnish, explore, and visualize<br className="welcome-wide-break"/> your space in 3D.</span></span><CaretRight className="welcome-choice-arrow"/></button>
     <button disabled={!ready} className="welcome-choice welcome-projects" onClick={()=>setProjects(true)}><span className="welcome-choice-icon"><FolderOpen/></span><span className="welcome-choice-copy"><span className="welcome-choice-title">My projects</span><span className="welcome-choice-description">Open your saved spaces and<br className="welcome-wide-break"/> pick up where you left off.</span></span><CaretRight className="welcome-choice-arrow"/></button>
    </nav>
    <footer className="welcome-footer"><LockSimple size={17}/> No account needed · Saved on this device</footer>
   </section>
   <div className="welcome-art"><img src={dark?'/assets/welcome-dollhouse-dark.webp':'/assets/welcome-dollhouse-light.webp'} alt="A cozy miniature room with a sage sofa, oak staircase and glowing arched window; inspiration for your own space" fetchPriority="high"/></div>
  </div>
  {projects&&ready&&<ProjectLibrary browseOnly onClose={()=>setProjects(false)} onOpen={()=>setEditing(true)}/>}
  {studio&&<BlueprintStudio onClose={()=>setStudio(false)} onCreated={()=>setEditing(true)}/>}
 </main>;
}
