import {X,ArrowLeft,ArrowRight,ArrowUp,ArrowDown} from '@phosphor-icons/react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {catalog} from './catalog';
import {formatLength} from './domain';
import {readableLength} from './measurement';
import {LengthInput} from './LengthInput';
import {usePlanner} from './store';
import {buildKitPlacement, cozyStarterKits, createFurnitureKit, initialKitPosition, kitBounds, kitPieceProblem, MAX_KIT_PIECES, unavailableKitPieces, type FurnitureKit, type KitPosition} from './furnitureKits';
import {deleteFurnitureKit, listFurnitureKits, renameFurnitureKit, saveFurnitureKit} from './kitStorage';
import type {PlanDocumentV1} from './types';
import './furniture-kits.css';

export interface KitPreviewRequest extends ReturnType<typeof buildKitPlacement> {base: PlanDocumentV1; label: string; floorId: string}
/** Parent owns a reactive preview ID and rejects stale bases. stage/apply/discard are synchronous. */
export interface KitPreviewBridge {
  activeId?: string;
  blocked?: boolean;
  stage(request: KitPreviewRequest): string;
  apply(id: string): void;
  discard(id: string): void;
}
interface StagedKit {id: string; configuration: string; warnings: ReturnType<typeof buildKitPlacement>['warnings']}
const names = new Map(catalog.map(c => [c.id, c.name]));

/** Content only: host in the parent's one dialog, keeping the 3D preview visible. */
export function FurnitureKitsPanel({preview, onClose}: {preview: KitPreviewBridge; onClose(): void}) {
  const plan = usePlanner(s => s.plan), floorId = usePlanner(s => s.activeFloorId);
  const [kits, setKits] = useState<FurnitureKit[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'browse'|'save'>('browse'), [choice, setChoice] = useState<string>(), [position, setPosition] = useState<KitPosition>();
  const [staged, setStaged] = useState<StagedKit>(), [selected, setSelected] = useState<string[]>([]), [name, setName] = useState(''), [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string>(), [newName, setNewName] = useState(''), [deleting, setDeleting] = useState<string>();
  const bridge = useRef(preview), stageId = useRef<string | undefined>(undefined), alive = useRef(true), refreshEpoch = useRef(0), running = useRef(false);
  bridge.current = preview;
  const kit = [...cozyStarterKits, ...kits].find(k => k.id === choice);
  const configuration = JSON.stringify([choice, position]);
  const nudge = plan.units === 'imperial' ? 254 : 250, nudgeLabel = plan.units === 'imperial' ? '10 in' : '25 cm';
  const fresh = !!staged && preview.activeId === staged.id && staged.configuration === configuration;
  const clearPreview = () => {const id = stageId.current; if (id) bridge.current.discard(id); stageId.current = undefined; setStaged(undefined);};
  const refresh = async () => {
    const epoch = ++refreshEpoch.current;
    try {const saved = await listFurnitureKits(); if (alive.current && epoch === refreshEpoch.current) {setKits(saved); setLoaded(true); setStorageError('');}}
    catch (e) {if (alive.current && epoch === refreshEpoch.current) {setLoaded(false); setStorageError((e as Error).message || 'Private kits could not be opened. Allow browser storage and retry.');}}
  };
  useEffect(() => {
    alive.current = true; void refresh();
    const focus = () => {void refresh();}; window.addEventListener('focus', focus);
    return () => {alive.current = false; ++refreshEpoch.current; window.removeEventListener('focus', focus); const id = stageId.current; if (id) bridge.current.discard(id);};
  }, []);
  useEffect(() => {clearPreview(); setChoice(undefined); setPosition(undefined); setSelected([]); setSearch(''); setError('');}, [plan.id, floorId]);
  useEffect(() => {
    if (staged && preview.activeId !== staged.id) {stageId.current = undefined; setStaged(undefined); setNotice('Preview closed. Your saved arrangement is unchanged.');}
  }, [preview.activeId, staged]);
  useEffect(() => {if (choice && !kit) {clearPreview(); setChoice(undefined); setPosition(undefined);}}, [choice, kit]);
  const floorPieces = useMemo(() => plan.furniture.filter(p => p.floorId === floorId), [plan.furniture, floorId]);
  const candidates = floorPieces.filter(p => !kitPieceProblem(p));
  const shown = candidates.filter(p => `${names.get(p.catalogId) ?? p.catalogId} ${p.id}`.toLowerCase().includes(search.toLowerCase())).slice(0, 80);

  const run = async (work: () => Promise<void>, message: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError('');
    try {await work(); if (alive.current) {setNotice(message); await refresh();}}
    catch (e) {if (alive.current) setError((e as Error).message || 'This kit could not be saved.');}
    finally {running.current = false; if (alive.current) setBusy(false);}
  };
  const previewKit = (next: FurnitureKit, nextPosition: KitPosition) => {
      const current = usePlanner.getState();
      if (current.activeFloorId !== floorId || current.plan !== plan) throw new Error('The room changed. Choose this kit again.');
      const result = buildKitPlacement(plan, floorId, next, nextPosition);
      const id = preview.stage({...result, base: plan, floorId, label: next.name});
      stageId.current = id; setStaged({id, configuration: JSON.stringify([next.id, nextPosition]), warnings: result.warnings}); setNotice('Preview only. Check the room, then Apply or Discard.');
  };
  const choose = (next: FurnitureKit) => {
    if (preview.blocked) return;
    clearPreview(); setError(''); setNotice(''); setChoice(next.id); setPosition(undefined); setRenaming(undefined); setDeleting(undefined);
    try {const nextPosition = initialKitPosition(plan, floorId, next); setPosition(nextPosition); previewKit(next,nextPosition);}
    catch (e) {setError((e as Error).message);}
  };
  const stage = () => {
    if (!kit || !position || preview.blocked) return;
    setError('');
    try {previewKit(kit,position);} catch (e) {setError((e as Error).message);}
  };
  const apply = () => {
    if (!staged || !fresh || preview.blocked) return;
    setError('');
    try {preview.apply(staged.id); stageId.current = undefined; setStaged(undefined); setNotice('Arrangement added. Every piece remains independent; Undo removes this whole addition.');}
    catch (e) {setError((e as Error).message);}
  };
  const changeTab = (next: 'browse'|'save') => {clearPreview(); setChoice(undefined); setPosition(undefined); setTab(next); setError(''); setNotice('');};
  const close = () => {clearPreview(); onClose();};
  const card = (entry: FurnitureKit, personal: boolean) => {
    const bounds = kitBounds(entry), unavailable = unavailableKitPieces(entry);
    return <article className="kit-card" key={entry.id} data-selected={entry.id === choice}>
      <div><h4>{entry.name}</h4><p>{entry.pieces.length} pieces · {formatLength(bounds.width, plan.units)} × {formatLength(bounds.depth, plan.units)}</p><small>{entry.pieces.map(p => names.get(p.catalogId) ?? p.catalogId).join(' · ')}</small></div>
      {!!unavailable.length && <p className="kit-warning">{unavailable.join(' ')} Your saved kit is kept; remove and resave it with available pieces.</p>}
      <div className="kit-actions"><button disabled={busy || preview.blocked || !!unavailable.length} onClick={() => choose(entry)}>Arrange {entry.name}</button>{personal && <><button disabled={busy} onClick={() => {setRenaming(entry.id); setNewName(entry.name); setDeleting(undefined);}}>Rename</button><button disabled={busy} onClick={() => {setDeleting(entry.id); setRenaming(undefined);}}>Remove</button></>}</div>
      {renaming === entry.id && <div className="kit-inline-edit"><label>New kit name<input maxLength={80} value={newName} onChange={e => setNewName(e.target.value)}/></label><button disabled={busy || !newName.trim()} onClick={() => void run(async () => {await renameFurnitureKit(entry.id, newName); setRenaming(undefined);}, 'Kit renamed.')}>Save name</button><button onClick={() => setRenaming(undefined)}>Cancel</button></div>}
      {deleting === entry.id && <div className="kit-inline-edit" role="alert"><p>Remove “{entry.name}” from this device? Placed furniture stays in your home.</p><button disabled={busy} onClick={() => void run(async () => {await deleteFurnitureKit(entry.id); if (choice === entry.id) {clearPreview(); setChoice(undefined);} setDeleting(undefined);}, 'Private kit removed.')}>Remove kit</button><button onClick={() => setDeleting(undefined)}>Keep kit</button></div>}
    </article>;
  };
  return <section className="furniture-kits" data-placing={!!kit&&!!position&&tab==='browse'} aria-label="Furniture arrangements">
    <header className="kit-heading"><div><span className="eyebrow">Make a corner your own</span><h2>Arrangements</h2></div><button onClick={close} aria-label="Close arrangements" title="Close arrangements"><X size={20}/></button></header>
    <p className="kit-intro">Start with a cozy set or save pieces you have arranged. Kits stay private on this device. Placed pieces stay independent.</p>
    <div className="kit-tabs" role="group" aria-label="Arrangement collection"><button aria-pressed={tab === 'browse'} onClick={() => changeTab('browse')}>Choose a kit</button><button aria-pressed={tab === 'save'} onClick={() => changeTab('save')}>Save my arrangement</button></div>
    {preview.blocked && <p className="kit-warning" role="status">Finish or discard the other placement or design preview before arranging this kit.</p>}
    {storageError && <p className="kit-warning" role="alert">{storageError} <button disabled={busy} onClick={() => void refresh()}>Retry private kits</button></p>}
    {error && <p className="kit-warning" role="alert">{error}</p>}
    {notice && <p className="kit-notice" role="status">{notice}</p>}
    {tab === 'browse' ? <>
      {kit && position && <section className="kit-position" aria-label="Place arrangement"><h3>{kit.name}</h3><p>Move or turn the set, then update its preview.</p><div className="kit-coordinate-fields"><LengthInput label="Kit X" value={position.x} units={plan.units} min={-10000000} onChange={x => setPosition({...position, x})}/><LengthInput label="Kit Z" value={position.z} units={plan.units} min={-10000000} onChange={z => setPosition({...position, z})}/></div><label>Rotation (degrees)<input type="number" min={-360} max={360} step={15} value={position.rotation} onChange={e => {if(e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) setPosition({...position, rotation: e.target.valueAsNumber});}}/></label><div className="kit-actions"><button disabled={preview.blocked} onClick={() => setPosition(p => p && ({...p, x:p.x-nudge}))} aria-label={`Left ${nudgeLabel}`} title={`Left ${nudgeLabel}`}><ArrowLeft size={20}/></button><button disabled={preview.blocked} onClick={() => setPosition(p => p && ({...p, x:p.x+nudge}))} aria-label={`Right ${nudgeLabel}`} title={`Right ${nudgeLabel}`}><ArrowRight size={20}/></button><button disabled={preview.blocked} onClick={() => setPosition(p => p && ({...p, z:p.z-nudge}))} aria-label={`Back ${nudgeLabel}`} title={`Back ${nudgeLabel}`}><ArrowUp size={20}/></button><button disabled={preview.blocked} onClick={() => setPosition(p => p && ({...p, z:p.z+nudge}))} aria-label={`Forward ${nudgeLabel}`} title={`Forward ${nudgeLabel}`}><ArrowDown size={20}/></button></div>
        {staged && !fresh && <p className="kit-warning">Position changed. Update the preview before applying.</p>}
        {!!staged?.warnings.length && <details className="kit-warning"><summary>{staged.warnings.length} layout notes — check the fit</summary><ul>{staged.warnings.map((w,i) => <li key={i}>{w.message}</li>)}</ul></details>}
        <div className="kit-actions"><button disabled={busy || preview.blocked} onClick={stage}>{staged ? 'Update preview' : 'Preview in room'}</button><button className="primary" disabled={busy || preview.blocked || !fresh} onClick={apply}>Apply arrangement</button><button disabled={!staged} onClick={() => {clearPreview(); setError(''); setNotice('Preview discarded. Your home is unchanged.');}}>Discard preview</button><button onClick={() => {clearPreview(); setChoice(undefined); setPosition(undefined);}}>Back to kits</button></div>
      </section>}
      {(!kit||!position)&&<><h3>Cozy starters</h3><div className="kit-cards">{cozyStarterKits.map(k => card(k, false))}</div>
      <div className="kit-section-heading"><h3>My kits · {kits.length}</h3><button disabled={busy} onClick={() => void refresh()}>Refresh</button></div>
      {!loaded && !storageError ? <p role="status">Opening private kits…</p> : !kits.length && <p>Arrange a few pieces, then save your first kit.</p>}
      <div className="kit-cards">{kits.map(k => card(k, true))}</div></>}
    </> : <section className="kit-save"><h3>Choose pieces on {plan.floors.find(f => f.id === floorId)?.name}</h3><p>Only checked pieces are saved. Select shelf decorations separately if you want them included.</p><label>Find a placed piece<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Chair, desk, books…"/></label><div className="kit-piece-list">{shown.map(p => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id) && selected.length >= MAX_KIT_PIECES} onChange={e => setSelected(s => e.target.checked ? [...s,p.id] : s.filter(id => id !== p.id))}/><span>{names.get(p.catalogId) ?? p.catalogId}<small>{formatLength(p.widthMm,plan.units)} × {formatLength(p.depthMm,plan.units)} · X {readableLength(p.x,plan.units)}, Z {readableLength(p.z,plan.units)}</small></span></label>)}</div>{!shown.length && <p>No matching movable furniture on this floor.</p>}{candidates.length > 80 && <p>Showing up to 80 matches. Search to narrow this list; checked pieces remain selected.</p>}{floorPieces.length > candidates.length && <p className="kit-muted">Wall/ceiling attachments, doors, windows, stairs and terrain-anchored pieces are excluded in this first version.</p>}<div className="kit-actions"><span>{selected.length} / {MAX_KIT_PIECES} checked</span><button disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button></div><label>Kit name<input maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="My reading corner"/></label><button className="primary" disabled={busy || !loaded || !!storageError || !selected.length || !name.trim()} onClick={() => void run(async () => {const current = usePlanner.getState(); if(current.plan !== plan || current.activeFloorId !== floorId) throw new Error('The room changed. Check the pieces again.'); await saveFurnitureKit(createFurnitureKit(plan,floorId,selected,name)); setSelected([]); setName(''); setChoice(undefined); setPosition(undefined); setTab('browse');}, 'Private kit saved on this device.')}>Save private kit</button></section>}
  </section>;
}
