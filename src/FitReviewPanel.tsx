import {ChoiceButtons} from './ChoiceButtons';
import {useEffect,useRef,useState} from 'react';
import {X,ArrowSquareOut} from '@phosphor-icons/react';
import {catalog} from './catalog';
import {LengthInput} from './LengthInput';
import {readableArea,readableLength} from './measurement';
import {defaultFitReviewSettings,emptyFitReview,fitInteractionMetadata,normalizeFitReviewSettings,type FitReviewResult,type FitReviewSettings} from './fitReview';
import {useFitReview} from './useFitReview';
import type {PlanDocumentV1} from './types';
import './fit-review.css';

export interface FitReviewPanelProps {
  plan:PlanDocumentV1;floorId:string;settings:FitReviewSettings;
  onSettingsChange(settings:FitReviewSettings):void;
  onSelectItems(itemIds:string[],floorId:string):void;
  onResult?(result:FitReviewResult):void;
  result?:FitReviewResult;
  pending?:boolean;
  error?:string;
  onFloorChange?(floorId:string):void;
  onClose?():void;
}
const names=new Map(catalog.map(c=>[c.id,c.name]));

/** Editor-only preferences. The parent owns overlay rendering and selection; this panel never writes the plan. */
export function FitReviewPanel({plan,floorId,settings,onSettingsChange,onSelectItems,onResult,onFloorChange,onClose,result:controlledResult,pending:controlledPending,error:controlledError}:FitReviewPanelProps){
  const local=useFitReview(plan,floorId,settings,controlledResult===undefined);
  const result=controlledResult??local.result,pending=controlledPending??local.pending,error=controlledError??local.error;
  const publish=useRef(onResult);publish.current=onResult;
  const controlled=useRef(controlledResult!==undefined);controlled.current=controlledResult!==undefined;
  const [kind,setKind]=useState('all');
  const options=normalizeFitReviewSettings(settings);
  useEffect(()=>{if(controlledResult===undefined)publish.current?.(result);},[result,controlledResult]);
  useEffect(()=>()=>{if(!controlled.current)publish.current?.(emptyFitReview());},[]);
  const update=(patch:Partial<FitReviewSettings>)=>onSettingsChange(normalizeFitReviewSettings({...options,...patch}));
  const doors=plan.furniture.filter(p=>p.floorId===floorId&&fitInteractionMetadata[p.catalogId]?.kind==='door'&&!p.doorless);
  const filtered=kind==='all'?result.issues:result.issues.filter(i=>i.kind===kind);
  return <section className="fit-review" aria-label="Practical fit review">
    <header><div><span className="eyebrow">Make room for everyday life</span><h2>Will it fit?</h2></div>{onClose&&<button aria-label="Close fit review" onClick={onClose}><X size={20}/></button>}</header>
    <p className="fit-intro">Check the space around your furniture. These are planning preferences and approximate opening areas, not building-code or accessibility certification.</p>
    <label className="fit-toggle"><input type="checkbox" checked={options.enabled} onChange={e=>update({enabled:e.target.checked})}/><strong>Show practical fit review</strong></label>
    {onFloorChange?<label className="fit-field">Floor<select value={floorId} onChange={e=>onFloorChange(e.target.value)}>{plan.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>:<p className="fit-floor">{plan.floors.find(f=>f.id===floorId)?.name??'Choose a floor'}</p>}
    {!options.enabled?<p className="fit-muted">Review is off. Your home and undo history are unchanged.</p>:<>
      <details className="fit-settings"><summary>Your space preferences</summary>
        <div className="fit-thresholds"><LengthInput label="Preferred passage" value={options.passageMm} units={plan.units} min={100} onChange={passageMm=>update({passageMm})}/><LengthInput label="Chair pull-out" value={options.chairPulloutMm} units={plan.units} min={100} onChange={chairPulloutMm=>update({chairPulloutMm})}/></div>
        <p className="fit-muted">Passage: {readableLength(100,plan.units)}–{readableLength(2500,plan.units)}. Chair pull-out: {readableLength(100,plan.units)}–{readableLength(1500,plan.units)}. A narrow gap is not necessarily a walking route.</p>
        <div className="fit-option-list">
          <label><input type="checkbox" checked={options.checkGaps} onChange={e=>update({checkGaps:e.target.checked})}/>Furniture and wall gaps</label>
          <label><input type="checkbox" checked={options.checkChairs} onChange={e=>update({checkChairs:e.target.checked})}/>Pull-out behind supported chairs</label>
          <label><input type="checkbox" checked={options.checkDoors} onChange={e=>update({checkDoors:e.target.checked})}/>Approximate door swings</label>
          <label><input type="checkbox" checked={options.checkDrawers} onChange={e=>update({checkDrawers:e.target.checked})}/>Approximate supported drawer openings</label>
        </div>
        <button onClick={()=>onSettingsChange({...defaultFitReviewSettings,enabled:true,doorOverrides:{}})}>Reset preferences</button>
      </details>
      {options.checkDoors&&<details className="fit-settings"><summary>Confirm door swing assumptions · {doors.length}</summary>
        <p className="fit-muted">The listed models have known leaf sizes. A 90° opening is assumed; confirm the hinge and opening side for your layout. This changes the review only.</p>
        {doors.slice(0,40).map(p=>{const value=options.doorOverrides[p.id]??{hinge:'left' as const,side:'front' as const};return <div className="fit-door" key={p.id}>
          <button className="fit-object-link" onClick={()=>onSelectItems([p.id],floorId)}>{names.get(p.catalogId)} <ArrowSquareOut size={14}/></button>
          <small>{readableLength(p.widthMm,plan.units)} wide · {p.id.slice(0,8)}</small>
          <ChoiceButtons<'left'|'right'> label={`Hinge ${p.id}`} value={value.hinge} options={[{value:'left',label:'Left hinge'},{value:'right',label:'Right hinge'}]} onChange={hinge=>update({doorOverrides:{...options.doorOverrides,[p.id]:{...value,hinge}}})}/>
          <ChoiceButtons<'front'|'back'> label={`Swing side ${p.id}`} value={value.side} options={[{value:'front',label:'Opens front'},{value:'back',label:'Opens back'}]} onChange={side=>update({doorOverrides:{...options.doorOverrides,[p.id]:{...value,side}}})}/>

        </div>;})}
        {!doors.length&&<p>No supported hinged doors on this floor.</p>}{doors.length>40&&<p>Showing the first 40 doors. Review a smaller floor to adjust more.</p>}
      </details>}
      {(options.checkDoors||options.checkDrawers)&&<p className="fit-muted">Supported drawer check: the three-drawer filing cabinet, using its modeled drawer depth as an approximate extension. Sliding/folding doors, blinds and other drawer mechanisms have no verified envelope yet.</p>}
      <div className="fit-results-heading"><h3>Review this floor</h3></div><ChoiceButtons label="Fit issue type" value={kind} onChange={setKind} options={[{value:'all',label:'All'},{value:'gap',label:'Gaps'},{value:'overlap',label:'Overlaps'},{value:'floor-edge',label:'Edges'},{value:'chair-pullout',label:'Chairs'},{value:'door-swing',label:'Doors'},{value:'drawer-opening',label:'Drawers'}]}/>

      {pending&&<p role="status">Checking this floor…</p>}{error&&<p className="fit-alert" role="alert">{error}</p>}
      {!pending&&!error&&!filtered.length&&<p role="status">{result.issues.length?'No notes in this category.':'No issues found within the enabled checks.'}</p>}
      <ol className="fit-issues">{filtered.map(issue=><li key={issue.id}>
        <div><h4>{issue.title}</h4>{issue.approximate&&<span className="fit-tag">Planning estimate</span>}</div>
        {issue.measuredMm!==undefined&&<p className="fit-measurement">Measured {readableLength(issue.measuredMm,plan.units)}{issue.requiredMm!==undefined&&<> · {issue.kind==='door-swing'?'Assumed swing radius':issue.kind==='drawer-opening'?'Assumed extension':issue.kind==='chair-pullout'?'Pull-out allowance':'Your passage preference'} {readableLength(issue.requiredMm,plan.units)}</>}</p>}
        {issue.outsideAreaMm2!==undefined&&<p className="fit-measurement">{readableArea(issue.outsideAreaMm2/1_000_000,plan.units)} outside the supported floor</p>}
        <p>{issue.message}</p><button onClick={()=>onSelectItems(issue.itemIds,floorId)}>Show {issue.itemIds.length>1?'these pieces':'this piece'} <ArrowSquareOut size={15}/></button>
      </li>)}</ol>
      {!pending&&<div className="fit-notices"><p>{result.stats.checked} pieces reviewed · {result.issues.length} notes</p>{result.notices.map(note=><p key={note}>{note}</p>)}</div>}
    </>}
  </section>;
}
