import {useGoogleScenery} from './googleScenery';
import {usePlanner} from './store';
import './google-scenery.css';
import {GOOGLE_QUALITY,type GoogleQuality} from './googleSceneryQuality';

export function GoogleSceneryControls(){
  const g=useGoogleScenery();
  return <div className="google-scenery-controls"><p role="status">{g.paused?'Detail loading paused':g.status}</p>
    <label>Detail quality<select value={g.quality} onChange={e=>g.setQuality(e.target.value as GoogleQuality)}>
      {Object.entries(GOOGLE_QUALITY).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}
    </select></label>
    <small>Prioritizes buildings near your apartment. Viewed detail is retained while memory allows.</small>
    <button onClick={g.paused?g.resume:g.pause}>{g.paused?'Resume detail loading':'Pause detail loading'}</button>
    <details><summary>Connection & memory</summary><p>Loaded scenery stays visible when paused. New detail needs an internet connection.</p>
      <p>Estimated retained detail: {g.retainedMiB} / {GOOGLE_QUALITY[g.quality].memoryMiB} MB · {g.retainedTiles} tiles</p>
      <p>{g.visibleTiles} visible tiles · {g.requests} requests · {g.sessions} {g.sessions===1?'session':'sessions'} · {g.fps} fps</p>
      <small>Smooth rotation keeps more visited views. Sharper nearby requests finer detail. Both use more memory. Changes keep the current Google session.</small>
      <button onClick={g.newSession}>Start a new Google session</button></details>
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
