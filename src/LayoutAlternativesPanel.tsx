import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanDocumentV1 } from './types';
import { validatePlan } from './planValidation';
import {
  applyLayoutAlternative, deleteLayoutAlternative, layoutDifference,
  layoutSummary, MAX_LAYOUT_ALTERNATIVES, renameLayoutAlternative, saveLayoutAlternative,
  type AlternativePlan,
} from './layoutAlternatives';
import './LayoutAlternativesPanel.css';
import {LayoutComparison} from './LayoutComparison';
import {versionLayoutReferences} from './studioReference';

export interface LayoutAlternativesPanelProps {
  plan: PlanDocumentV1;
  activeFloorId: string;
  onChange: (base: PlanDocumentV1, next: PlanDocumentV1) => void;
  onApply: (base: PlanDocumentV1, next: PlanDocumentV1, activeFloorId: string) => void;
  onClose?: () => void;
  onBusyChange?: (busy:boolean) => void;
}
type Confirmation = { kind: 'apply' | 'delete'; id: string; name: string; base: PlanDocumentV1 };
const EMPTY_OPTIONS: NonNullable<AlternativePlan['layoutAlternatives']>['options'] = [];

/** Embedded in ProjectLibrary; its host owns the dialog and editor draft cancellation. */
export function LayoutAlternativesPanel({ plan, activeFloorId, onChange, onApply, onClose, onBusyChange }: LayoutAlternativesPanelProps) {
  const [saving,setSaving]=useState(false),active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string }>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [message, setMessage] = useState('');
  const [comparing,setComparing]=useState<string>();
  const options = (plan as AlternativePlan).layoutAlternatives?.options ?? EMPTY_OPTIONS;
  const comparisons = useMemo(() => {
    const current = { gridSizeMm: plan.gridSizeMm, floors: plan.floors, furniture: plan.furniture, environment: plan.environment };
    return options.map(option => ({ summary: layoutSummary(option.snapshot), difference: layoutDifference(current, option.snapshot) }));
  }, [plan.gridSizeMm, plan.floors, plan.furniture, plan.environment, options]);
  const attempt = (action: () => void) => {
    try { action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The layout idea could not be saved.'); }
  };
  const confirm = () => attempt(() => {
    if (!confirmation) return;
    if (plan !== confirmation.base) {
      setConfirmation(undefined);
      throw new Error('The project changed. Review the idea again before continuing.');
    }
    if (confirmation.kind === 'delete') {
      onChange(plan, deleteLayoutAlternative(plan, confirmation.id, validatePlan));
      setMessage('Layout idea removed. Your current layout is unchanged.');
    } else {
      const candidate = applyLayoutAlternative(plan, confirmation.id, activeFloorId, validatePlan);
      onApply(plan, candidate.plan, candidate.activeFloorId);
      setMessage('Layout idea applied. Undo restores your previous layout.');
    }
    setConfirmation(undefined);
  });
  return <section className="layout-ideas" aria-labelledby="layout-ideas-title">
    <div className="layout-ideas-heading"><div><span className="eyebrow">Try another arrangement</span><h2 id="layout-ideas-title">Layout ideas</h2></div>{onClose && <button type="button" onClick={onClose}>Back</button>}</div>
    <p>Keep named versions of this home. Saved ideas stay unchanged while you edit. They are included in private saves and project backups, and left out of public shares.</p>
    <form className="layout-ideas-save" onSubmit={event => { event.preventDefault(); if(saving)return;setSaving(true);onBusyChange?.(true);void versionLayoutReferences(plan).then(source=>{if(!active.current)return;onChange(plan,saveLayoutAlternative(source,name,activeFloorId,validatePlan));setName('');setMessage('Current layout and saved reference versions kept as an idea.');}).catch(error=>{if(active.current)setMessage(error instanceof Error?error.message:'Could not preserve the reference files.');}).finally(()=>{if(active.current){setSaving(false);onBusyChange?.(false)}}); }}>
      <label>Idea name<input value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder="For example, an open living room" /></label>
      <button type="submit" disabled={saving||!name.trim() || options.length >= MAX_LAYOUT_ALTERNATIVES || !!confirmation}>{saving?'Saving idea…':'Save current layout'}</button>
    </form>
    <p className="layout-ideas-note">{options.length} of {MAX_LAYOUT_ALTERNATIVES} ideas saved. Large layouts can be kept as separate project backups.</p>
    {!options.length && <p>No saved ideas yet. Save the current layout before trying something different.</p>}
    <ul className="layout-ideas-list">{options.map((option, index) => {
      const { summary, difference } = comparisons[index];
      return <li key={option.id}>
        {editing?.id === option.id ? <form onSubmit={event => { event.preventDefault(); attempt(() => {
          onChange(plan, renameLayoutAlternative(plan, option.id, editing.name, validatePlan));
          setEditing(undefined); setMessage('Idea renamed.');
        }); }}><label>New name<input value={editing.name} maxLength={60} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><button type="submit" disabled={saving||!editing.name.trim() || !!confirmation}>Save name</button><button type="button" onClick={() => setEditing(undefined)}>Cancel rename</button></form>
        : <h3>{option.name}</h3>}
        <p>{summary.floors} {summary.floors === 1 ? 'floor' : 'floors'} · {summary.namedRooms} named {summary.namedRooms === 1 ? 'room' : 'rooms'} · {summary.furniture} placed items</p>
        <p className="layout-ideas-note">Compared with now: {difference.added} added, {difference.removed} removed, {difference.changed} changed items{difference.floorsChanged ? '; ' + difference.floorsChanged + ' changed floors or finishes' : ''}{difference.environmentChanged ? '; different outdoor settings' : ''}{difference.gridChanged ? '; different grid scale' : ''}.</p>
        <div className="layout-ideas-actions">
          <button type="button" aria-pressed={comparing===option.id} onClick={()=>setComparing(comparing===option.id?undefined:option.id)}>Compare {option.name}</button>
          <button type="button" disabled={saving||!!confirmation} onClick={() => { setEditing(undefined); setConfirmation({ kind: 'apply', id: option.id, name: option.name, base: plan }); setMessage(''); }}>Use {option.name}</button>
          <button type="button" disabled={saving||!!confirmation} onClick={() => setEditing({ id: option.id, name: option.name })}>Rename {option.name}</button>
          <button type="button" disabled={saving||!!confirmation} onClick={() => { setEditing(undefined); setConfirmation({ kind: 'delete', id: option.id, name: option.name, base: plan }); setMessage(''); }}>Delete {option.name}</button>
        </div>
        {comparing===option.id&&<LayoutComparison current={plan} saved={option.snapshot} name={option.name} initialFloorId={activeFloorId}/>}
      </li>;
    })}</ul>
    {confirmation && <div className="layout-ideas-confirm" role="group" aria-label={confirmation.kind === 'apply' ? 'Confirm layout change' : 'Confirm idea deletion'}>
      <h3>{confirmation.kind === 'apply' ? 'Use ' : 'Delete '}{confirmation.name}?</h3>
      <p>{confirmation.kind === 'apply'
        ? 'This replaces the current layout and clears unfinished placements and floor-plan drafts. Your saved ideas stay unchanged. Undo restores the previous layout.'
        : 'This removes only the saved idea. Your current layout stays as it is.'}</p>
      <button type="button" onClick={confirm}>{confirmation.kind === 'apply' ? 'Confirm layout change' : 'Confirm deletion'}</button>
      <button type="button" onClick={() => setConfirmation(undefined)}>Keep working</button>
    </div>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
