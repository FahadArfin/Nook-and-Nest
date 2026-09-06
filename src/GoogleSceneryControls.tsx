import {useGoogleScenery} from './googleScenery';
import {usePlanner} from './store';
import './google-scenery.css';

export function GoogleSceneryControls(){
  const g=useGoogleScenery();
  return <div className="google-scenery-controls"><p role="status">{g.paused?'Detail loading paused':g.status}</p>
    <button onClick={g.paused?g.resume:g.pause}>{g.paused?'Resume detail loading':'Pause detail loading'}</button>
    <details><summary>Connection</summary><p>Loaded scenery stays visible when paused. New detail needs an internet connection.</p><button onClick={g.newSession}>Start a new Google session</button></details>
  </div>;
}
export function GoogleSceneryCredits(){
  const g=useGoogleScenery(),env=usePlanner(s=>s.plan.environment);
  if(env?.background!=='city'||env.citySource!=='google')return null;
  return <aside className="google-scenery-attribution" aria-label="Scenery attribution"><strong>Google Maps</strong>
    {g.visible&&<span>{g.credits||'Google Maps'}</span>}<span>City imagery · Apartment by Nook & Nest</span>
    <span role="status">{g.paused?'Detail loading paused':g.status}</span>
    <button onClick={g.paused?g.resume:g.pause}>{g.paused?'Resume':'Pause loading'}</button>
  </aside>;
}
