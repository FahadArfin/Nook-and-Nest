import {usePlanner} from './store';

export function FlatRoofSetting(){
 const state=usePlanner();
 return <label className="setting-row"><input type="checkbox" aria-label="Flat roof for skylights" checked={state.plan.environment?.flatRoof??false} onChange={e=>state.setEnvironment({flatRoof:e.target.checked})}/><span>Flat roof for skylights</span></label>;
}
