import { useEffect, useMemo, useRef, useState } from 'react';
import { RenovationComparison } from './RenovationComparison';
import { validatePlan } from './planValidation';
import { versionLayoutReferences } from './studioReference';
import type { PlanDocumentV1 } from './types';
import type { CameraShotPose } from './walkthrough';
import { captureDesignMilestone, clearDesignMilestones, clearRenovationPhases, deleteDesignMilestone, filterPhaseChanges, historyBytes, MAX_DESIGN_MILESTONES, phasePreview, renameDesignMilestone, renovationChanges, renovationReport, restoreDesignCheckpoint, saveDesignReplayView, setMilestoneRecording, startRenovation, updateProposedPhase, type HistoryPlan, type PhaseChange, type PhaseFilters } from './designHistory';
import { exportDesignReplay, REPLAY_SIZES, type DesignReplayBridge } from './designReplay';
import { useDesignReplay } from './useDesignReplay';
import './design-history.css';
import {homeRecordsRestoreNotice} from './layoutAlternatives';

export interface DesignHistoryPanelProps {
  plan: PlanDocumentV1; activeFloorId: string;
  onChange(base: PlanDocumentV1, next: PlanDocumentV1): void | Promise<void>;
  onApply(base: PlanDocumentV1, next: PlanDocumentV1, activeFloorId: string): void | Promise<void>;
  bridge: DesignReplayBridge;
  captureView(): CameraShotPose;
  onClose?(): void;
  onBusyChange?(busy: boolean): void;
  onDownload?(blob: Blob, filename: string): void;
  onSelectChange?(change: PhaseChange): void;
  /** Existing immutable local-reference versioning. Injection is useful for tests/integration. */
  prepareCapture?(plan: PlanDocumentV1): Promise<PlanDocumentV1>;
}
type Confirmation = { kind: 'restore' | 'clear-milestones' | 'clear-phases' | 'delete'; name: string; id?: string; base: PlanDocumentV1 };
const statusNames = { keep: 'Keep', remove: 'Remove', new: 'New', changed: 'Changed' } as const;
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Project-options panel. A single parent-owned preview scene handles every phase/replay. */
export function DesignHistoryPanel({ plan, activeFloorId, onChange, onApply, bridge, captureView, onClose, onBusyChange, onDownload = download, onSelectChange, prepareCapture = versionLayoutReferences }: DesignHistoryPanelProps) {
  const history = (plan as HistoryPlan).designHistory, milestones = history?.milestones ?? [];
  const [tab, setTab] = useState<'phases' | 'replay'>('phases'), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>(), [renaming, setRenaming] = useState<{ id: string; name: string }>();
  const [phase, setPhase] = useState<'existing' | 'proposed'>(), [exportSize, setExportSize] = useState(0), [progress, setProgress] = useState('');
  const [exportingNow, setExportingNow] = useState(false);
  const [selectedExport, setSelectedExport] = useState<string[]>([]);
  const [filters, setFilters] = useState<PhaseFilters>({ architecture: true, furniture: true, statuses: ['remove', 'new', 'changed', 'keep'] });
  const latest = useRef(plan); latest.current = plan;
  const alive = useRef(true), request = useRef<AbortController | undefined>(undefined), exporting = useRef<AbortController | undefined>(undefined);
  const replay = useDesignReplay(plan, bridge);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); exporting.current?.abort(); onBusyChange?.(false); }; }, []);
  useEffect(() => { setSelectedExport(previous => previous.filter(id => milestones.some(m => m.id === id))); }, [history?.milestones]);
  const phases = history?.renovation;
  const changes = useMemo(() => renovationChanges(plan), [history?.renovation, history?.checkpoints]);
  const filtered = useMemo(() => filterPhaseChanges(changes, filters), [changes, filters]);
  const selectedIds = selectedExport.length ? milestones.filter(m => selectedExport.includes(m.id)).map(m => m.id) : milestones.map(m => m.id);
  const stopPreview = async () => { request.current?.abort(); setPhase(undefined); await replay.stop(); };
  const perform = async (action: () => Promise<void> | void) => {
    if (busy) return; setBusy(true); onBusyChange?.(true); setMessage('');
    try { await action(); } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : 'The design history action could not finish.'); }
    finally { if (alive.current) setBusy(false); onBusyChange?.(false); }
  };
  const capture = (kind: 'baseline' | 'proposed' | 'milestone') => void perform(async () => {
    const base = plan, title = name; await stopPreview(); const prepared = await prepareCapture(base);
    if (!alive.current) return;
    if (latest.current !== base) throw new Error('The project changed while its references were being saved. Review the current layout and try again.');
    const next = kind === 'baseline' ? startRenovation(prepared, activeFloorId, validatePlan) : kind === 'proposed' ? updateProposedPhase(prepared, activeFloorId, validatePlan) : captureDesignMilestone(prepared, title, activeFloorId, validatePlan);
    await onChange(base, next); if (!alive.current) return; if (kind === 'milestone') setName('');
    setMessage(kind === 'baseline' ? 'Existing baseline saved. Edit the home, then save the Proposed phase.' : kind === 'proposed' ? 'Proposed revision saved. The Existing baseline is unchanged.' : 'Milestone saved with its immutable reference versions.');
  });
  const showPhase = (next: 'existing' | 'proposed') => void perform(async () => {
    await stopPreview(); const abort = new AbortController(); request.current = abort;
    try { await bridge.show(phasePreview(plan, next), abort.signal); } catch (error) { await bridge.restore(); throw error; }
    if (!alive.current || abort.signal.aborted) return; setPhase(next); setMessage('Preview only. Your working layout is unchanged.');
  });
  const confirm = () => void perform(async () => {
    if (!confirmation) return; const { base, kind, id } = confirmation;
    if (latest.current !== base) { setConfirmation(undefined); throw new Error('The project changed. Review this action again.'); }
    await stopPreview();
    if (!alive.current) return;
    if (latest.current !== base) throw new Error('The project changed. Review this action again.');
    if (kind === 'restore') { const next = restoreDesignCheckpoint(base, id!, validatePlan); await onApply(base, next.plan, next.activeFloorId); setMessage('Saved design restored. Undo returns to your previous working layout.'); }
    else { const next = kind === 'clear-milestones' ? clearDesignMilestones(base, validatePlan) : kind === 'clear-phases' ? clearRenovationPhases(base, validatePlan) : deleteDesignMilestone(base, id!, validatePlan); await onChange(base, next); setMessage('Saved history updated. Your working layout is unchanged.'); }
    setConfirmation(undefined);
  });
  const exportImages = () => void perform(async () => {
    const abort = new AbortController(); exporting.current = abort; setExportingNow(true);
    try { await stopPreview(); const blob = await exportDesignReplay(plan, selectedIds, bridge, abort.signal, { ...REPLAY_SIZES[exportSize], onProgress: (done, total) => { if (alive.current) setProgress(`${done} of ${total} images`); } }); if (alive.current && !abort.signal.aborted) { onDownload(blob, 'design-milestones.zip'); setMessage('Image sequence exported. Your working view has been restored.'); } }
    catch (e) { if (abort.signal.aborted && e instanceof DOMException && e.name === 'AbortError') { if (alive.current) setMessage('Export cancelled. Your working view has been restored.'); } else throw e; }
    finally { exporting.current = undefined; if (alive.current) { setProgress(''); setExportingNow(false); } }
  });
  const close = () => { exporting.current?.abort(); void perform(async () => { await stopPreview(); onClose?.(); }); };
  return <section className="design-history" data-live-preview={Boolean(phase || replay.selected)} aria-label="Design phases and milestones">
    <header><div><span className="eyebrow">Your home's design story</span><h2>Phases & milestones</h2></div>{onClose && <button type="button" onClick={close} disabled={busy}>Back</button>}</header>
    <p className="history-muted">Named planning snapshots, kept in private saves and project backups. No screen recording or automatic capture of your edits.</p>
    <div className="history-tabs" role="group" aria-label="Design history section"><button type="button" aria-pressed={tab === 'phases'} disabled={busy} onClick={() => { void stopPreview(); setTab('phases'); }}>Renovation phases</button><button type="button" aria-pressed={tab === 'replay'} disabled={busy} onClick={() => { void stopPreview(); setTab('replay'); }}>Design milestones</button></div>
    {tab === 'phases' ? <>
      <p className="history-notice">Existing is an immutable baseline. Proposed is a saved version of your edited home. Switching views is a visual preview; only Restore changes the working layout. These are planning comparisons, not structural or demolition advice.</p>
      {!phases ? <div className="history-card"><h3>Keep the home as it is</h3><p>Save the current rooms, walls, doors, windows and furniture before you start changing them.</p><button type="button" disabled={busy} onClick={() => capture('baseline')}>Save current home as Existing</button></div> : <>
        <div className="history-phase-actions"><button type="button" disabled={busy} aria-pressed={phase === 'existing'} onClick={() => showPhase('existing')}>Preview Existing baseline</button><button type="button" disabled={busy} aria-pressed={phase === 'proposed'} onClick={() => showPhase('proposed')}>Preview Proposed · r{phases.revision}</button><button type="button" disabled={busy} onClick={() => capture('proposed')}>Update Proposed from working layout</button></div>
        {(phase || replay.selected) && <p className="history-preview-label">Preview only · {phase === 'existing' ? 'Existing baseline' : `Proposed revision ${phases.revision}`} <button type="button" disabled={busy} onClick={() => void perform(stopPreview)}>Return to working layout</button></p>}
        <RenovationComparison existing={phasePreview(plan, 'existing').checkpoint.snapshot} proposed={phasePreview(plan, 'proposed').checkpoint.snapshot} revision={phases.revision} changes={changes} filters={filters} initialFloorId={activeFloorId}/>
        <div className="history-actions"><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'restore', id: phases.baselineId, name: 'Existing baseline', base: plan })}>Restore Existing to editor</button><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'restore', id: phases.proposedId, name: `Proposed revision ${phases.revision}`, base: plan })}>Restore Proposed to editor</button><button type="button" disabled={busy} onClick={() => onDownload(new Blob([renovationReport(plan)], { type: 'text/csv;charset=utf-8' }), `renovation-proposed-r${phases.revision}.csv`)}>Export phase change list</button></div>
        <h3>Existing → Proposed · revision {phases.revision}</h3>
        <div className="history-filters"><label><input type="checkbox" checked={filters.architecture} onChange={e => setFilters({ ...filters, architecture: e.target.checked })}/>Architecture</label><label><input type="checkbox" checked={filters.furniture} onChange={e => setFilters({ ...filters, furniture: e.target.checked })}/>Furniture</label>{(['keep', 'remove', 'new', 'changed'] as const).map(status => <label key={status}><input type="checkbox" checked={filters.statuses.includes(status)} onChange={e => setFilters({ ...filters, statuses: e.target.checked ? [...filters.statuses, status] : filters.statuses.filter(s => s !== status) })}/>{statusNames[status]} ({changes.filter(c => c.status === status).length})</label>)}</div>
        <label className="history-field">Filter by floor<select value={filters.floorId ?? ''} onChange={e => setFilters({ ...filters, floorId: e.target.value || undefined })}><option value="">All floors</option>{[...new Map([...phasePreview(plan, 'existing').checkpoint.snapshot.floors, ...phasePreview(plan, 'proposed').checkpoint.snapshot.floors].map(f => [f.id, f])).values()].map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <p className="history-muted">Keep = same saved entity; Remove = absent from Proposed; New = absent from Existing; Changed = same ID with edited details. A changed wall is not automatically classified as demolition.</p>
        <ul className="history-changes">{filtered.slice(0, 100).map(change => { const entity = change.after ?? change.before!; return <li key={change.key}><span className={`history-status ${change.status}`}>{statusNames[change.status]}</span><span>{entity.name}<small>{entity.id}</small></span>{onSelectChange && <button type="button" disabled={busy} onClick={() => onSelectChange(change)}>Show</button>}</li>; })}</ul>
        {!filtered.length && <p>No matching changes.</p>}{filtered.length > 100 && <p>Showing 100 of {filtered.length} matching entries. Export the change list for every entry.</p>}
        <button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'clear-phases', name: 'renovation phases', base: plan })}>Clear saved renovation phases</button>
      </>}
    </> : <>
      <label className="history-check"><input type="checkbox" disabled={busy} checked={!!history?.recordingEnabled} onChange={e => { const enabled = e.target.checked; void perform(async () => { await stopPreview(); await onChange(plan, setMilestoneRecording(plan, enabled, validatePlan)); }); }}/>Enable manual design milestones</label>
      <p className="history-muted">Only Save milestone records a checkpoint. Turning this off keeps existing milestones but stops new captures. Clear removes saved milestones and their unused checkpoints.</p>
      <div className="history-save"><label>Milestone name<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="For example, the reading corner"/></label><button type="button" disabled={busy || !history?.recordingEnabled || !name.trim() || milestones.length >= MAX_DESIGN_MILESTONES} onClick={() => capture('milestone')}>Save milestone</button></div>
      <p className="history-muted">{milestones.length} of {MAX_DESIGN_MILESTONES} saved · images are generated only when you export.</p>
      {milestones.length > 0 && <>
        <div className="history-card"><h3>Replay camera</h3><p>{history?.replayView ? 'A single orbit camera is saved for this replay.' : 'Choose your view in the editor, then save it here. The same view is used for every milestone.'}</p><button type="button" disabled={busy} onClick={() => void perform(async () => { await onChange(plan, saveDesignReplayView(plan, captureView(), validatePlan)); setMessage('Replay camera saved. Your editor camera is unchanged.'); })}>Use current view for replay</button></div>
        <label className="history-field">Milestone <output>{replay.index + 1} / {milestones.length} · {milestones[replay.index]?.name}</output><input type="range" min={0} max={milestones.length - 1} value={replay.index} disabled={busy} onChange={e => { request.current?.abort(); setPhase(undefined); replay.scrub(Number(e.target.value)); }}/></label>
        <div className="history-actions"><button type="button" disabled={busy || replay.reducedMotion} onClick={() => { request.current?.abort(); setPhase(undefined); replay.playing ? replay.pause() : replay.play(); }}>{replay.playing ? 'Pause replay' : 'Play milestones'}</button><button type="button" disabled={busy} onClick={() => void perform(stopPreview)}>Return to working layout</button></div>
        {replay.reducedMotion && <p className="history-muted">Reduced motion is on. Use the slider or individual Preview buttons.</p>}
        <p className="history-muted">Replay pauses in hidden tabs. It previews saved checkpoints without writing to the current home.</p>
        <ol className="history-milestones">{milestones.map((milestone, index) => <li key={milestone.id}><label className="history-check"><input type="checkbox" checked={selectedExport.includes(milestone.id)} disabled={busy} onChange={e => setSelectedExport(ids => e.target.checked ? [...ids, milestone.id] : ids.filter(id => id !== milestone.id))}/>Include in selected export</label>{renaming?.id === milestone.id ? <div className="history-save"><label>New milestone name<input value={renaming.name} maxLength={60} onChange={e => setRenaming({ ...renaming, name: e.target.value })}/></label><button type="button" disabled={busy} onClick={() => void perform(async () => { await onChange(plan, renameDesignMilestone(plan, milestone.id, renaming.name, validatePlan)); setRenaming(undefined); })}>Save name</button><button type="button" onClick={() => setRenaming(undefined)}>Cancel</button></div> : <h3>{index + 1}. {milestone.name}</h3>}<small>{new Date(milestone.createdAt).toLocaleString()}</small><div className="history-actions"><button type="button" disabled={busy} onClick={() => { request.current?.abort(); setPhase(undefined); replay.scrub(index); }}>Preview {milestone.name}</button><button type="button" disabled={busy} onClick={() => setRenaming({ id: milestone.id, name: milestone.name })}>Rename</button><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'restore', id: milestone.checkpointId, name: milestone.name, base: plan })}>Restore</button><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'delete', id: milestone.id, name: milestone.name, base: plan })}>Delete</button></div></li>)}</ol>
        <div className="history-card"><h3>Export an image sequence</h3><p>Export {selectedIds.length} {selectedExport.length ? 'selected' : 'saved'} milestones in order as a ZIP with labelled images and a simple gallery. No video encoder is needed.</p><label className="history-field">Image size<select disabled={busy} value={exportSize} onChange={e => setExportSize(Number(e.target.value))}>{REPLAY_SIZES.map((size, i) => <option key={size.width} value={i}>{size.label}</option>)}</select></label><p className="history-muted">Up to 10 images · 4 MB each · 20 MB total. Original references and editable project data are excluded.</p><button type="button" disabled={busy || !history?.replayView} onClick={exportImages}>Export image sequence</button>{exportingNow && <button type="button" onClick={() => exporting.current?.abort()}>Cancel export</button>}{progress && <p role="status">{progress}</p>}</div>
        <button type="button" disabled={busy} onClick={() => setConfirmation({ kind: 'clear-milestones', name: 'all design milestones', base: plan })}>Clear all milestones</button>
      </>}
    </>}
    {confirmation && <div className="history-confirm" role="group" aria-label="Confirm design history action"><h3>{confirmation.kind === 'restore' ? 'Restore' : confirmation.kind === 'delete' ? 'Delete' : 'Clear'} {confirmation.name}?</h3><p>{confirmation.kind === 'restore' ? 'This replaces the working layout and clears unfinished placement and tracing drafts. The Existing baseline and saved milestones stay unchanged. Undo restores your previous layout.' : 'Your working layout stays unchanged. Checkpoints still referenced by renovation phases or another milestone are retained. Undo can restore this saved-history change.'}</p>{confirmation.kind==='restore'&&history?.checkpoints.find(c=>c.id===confirmation.id)&&<p>{homeRecordsRestoreNotice(plan,history.checkpoints.find(c=>c.id===confirmation.id)!.snapshot)}</p>}<button type="button" disabled={busy} onClick={confirm}>Confirm {confirmation.kind === 'restore' ? 'restoration' : 'removal'}</button><button type="button" disabled={busy} onClick={() => setConfirmation(undefined)}>Keep working</button></div>}
    <p className="history-muted">Stored design history: {Math.ceil(historyBytes(history ?? {}) / 1000)} KB of 2,000 KB. Floor-plan references stay on this device and travel with a complete project backup.</p>
    {(message || replay.error) && <p role="status" className="history-notice">{message || replay.error}</p>}
  </section>;
}
