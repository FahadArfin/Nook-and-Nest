import {useEffect,useState,type ComponentType} from 'react';
import {ArrowRight,Armchair,FolderOpen,GridFour,Leaf} from '@phosphor-icons/react';
import {createBlankPlan} from './domain';
import {loadPlan,savePlan,usePlanner} from './store';
import {ProjectLibrary} from './ProjectLibrary';
import {BlueprintStudio} from './BlueprintStudio';
import type {PlanDocumentV1} from './types';
import './welcome.css';

export function Welcome({Editor,showcase}:{Editor:ComponentType<{onHome?:()=>void}>;showcase?:()=>PlanDocumentV1}){
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
 return <main className="welcome-page">
  <header className="welcome-header"><a href="/" aria-label="Nook and Nest home"><img src="/assets/nook-nest-icon.png" alt=""/><span>Nook &amp; Nest</span></a><span><Leaf size={17}/> A little space for big ideas</span></header>
  <section className="welcome-hero"><div className="welcome-copy"><span className="welcome-kicker">MAKE ROOM FOR YOU</span><h1>Every home starts<br/>with a little possibility.</h1><p>Plan your space, find your favorite pieces, and make it feel like you. Start from scratch, at your own pace.</p><span className="welcome-note">A fresh canvas. No furniture. No rush.</span></div><div className="welcome-art"><img src="/assets/nook-nest-icon.png" alt="A cozy miniature room, an illustration of what you could create"/><span>Your next happy place.</span></div></section>
  {error&&<p role="alert" className="welcome-error">{error}</p>}
  <nav className="welcome-choices" aria-label="Start planning">
   <button disabled={!ready} className="welcome-choice" onClick={()=>start(true)}><span className="welcome-choice-icon"><GridFour/></span><small>START WITH YOUR SPACE</small><h2>Create floor plan</h2><p>Draw your rooms or trace a reference, then bring your layout into 3D.</p><span className="welcome-choice-link">Plan my space <ArrowRight/></span></button>
   <button disabled={!ready} className="welcome-choice" onClick={()=>start(false)}><span className="welcome-choice-icon"><Armchair/></span><small>FOLLOW YOUR CURIOSITY</small><h2>Free 3D editor</h2><p>An empty space to build, furnish, and explore. Make up the rules as you go.</p><span className="welcome-choice-link">Start creating <ArrowRight/></span></button>
   <button disabled={!ready} className="welcome-choice welcome-projects" onClick={()=>setProjects(true)}><span className="welcome-choice-icon"><FolderOpen/></span><small>PICK UP WHERE YOU LEFT OFF</small><h2>My projects</h2><p>Revisit your saved spaces, keep exploring an idea, or make room for something new.</p><span className="welcome-choice-link">Open my collection <ArrowRight/></span></button>
  </nav><footer className="welcome-footer">Made for imagining home. <span>No account needed to get started · Projects save on this device</span></footer>
  {projects&&ready&&<ProjectLibrary browseOnly onClose={()=>setProjects(false)} onOpen={()=>setEditing(true)}/>}
  {studio&&<BlueprintStudio onClose={()=>setStudio(false)} onCreated={()=>setEditing(true)}/>}
 </main>;
}
