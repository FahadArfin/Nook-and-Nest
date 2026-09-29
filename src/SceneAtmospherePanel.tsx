import { useEffect, useRef, useState } from 'react';
import { defaultSceneAtmosphere, formatStudyTime, formatUTCOffset, MAX_FIXTURE_OVERRIDES, moodPresets, parseSceneAtmosphere, parseStudyTime, renameAtmosphereSnapshot, saveAtmosphereSnapshot, solarPosition, studyProblems, type SceneAtmosphereV1, type SceneMoodSettings, type SunStudySettings } from './sceneAtmosphere';
import './scene-atmosphere.css';

export interface SceneAtmospherePanelProps {
  value?: SceneAtmosphereV1;
  onChange: (value: SceneAtmosphereV1) => void | Promise<void>;
  onPreview?: (value?: SceneAtmosphereV1) => void;
  onClose?: () => void;
  fixtures?: { id: string; name: string }[];
  soundEnabled?: boolean;
  onSoundEnabledChange?: (enabled: boolean) => void;
  soundError?: string;
}
export function SceneAtmospherePanel({ value, onChange, onPreview, onClose, fixtures = [], soundEnabled = false, onSoundEnabledChange, soundError }: SceneAtmospherePanelProps) {
  const [draft, setDraft] = useState(() => structuredClone(value ?? defaultSceneAtmosphere()));
  const [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [renaming, setRenaming] = useState<string>(), [rename, setRename] = useState('');
  const preview = useRef(onPreview); preview.current = onPreview;
  const committed = useRef(value); committed.current = value;
  useEffect(() => { setDraft(structuredClone(value ?? defaultSceneAtmosphere())); }, [value]);
  useEffect(() => { preview.current?.(previewing ? draft : undefined); }, [draft, previewing]);
  useEffect(() => () => preview.current?.(undefined), []);
  const change = (next: SceneAtmosphereV1) => { setError(''); setPreviewing(true); setDraft(next); };
  const mood = (patch: Partial<SceneMoodSettings>) => change({ ...draft, mood: { ...draft.mood, ...patch } });
  const study = (patch: Partial<SunStudySettings>) => change({ ...draft, study: { ...draft.study, ...patch } });
  const problems = draft.mode === 'sun-study' ? studyProblems(draft.study) : [];
  const position = draft.mode === 'sun-study' ? solarPosition(draft.study) : undefined;
  const savedKind = draft.mode === 'sun-study' ? 'comparisons' : 'savedMoods';
  const snapshots = draft[savedKind];
  const discard = () => { setPreviewing(false); setDraft(structuredClone(committed.current ?? defaultSceneAtmosphere())); preview.current?.(undefined); onClose?.(); };
  const apply = async () => {
    const valid = parseSceneAtmosphere(draft);
    if (!valid || problems.length) { setError('Complete the highlighted settings before applying.'); return; }
    setBusy(true); setError('');
    try { await onChange(valid); setPreviewing(false); preview.current?.(undefined); onClose?.(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The scene settings could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  const save = () => { try { change(saveAtmosphereSnapshot(draft, name, crypto.randomUUID())); setName(''); } catch (e) { setError((e as Error).message); } };
  return <section className="scene-atmosphere" aria-label="Scene mood and sunlight">
    <header><h2>Set the scene</h2>{onClose && <button type="button" onClick={discard} disabled={busy} aria-label="Close scene settings">×</button>}</header>
    <p className="atmosphere-muted">Preview the light and atmosphere. Apply saves the settings with this home; furniture, finishes, and room dimensions stay the same.</p>
    <div className="atmosphere-tabs" role="group" aria-label="Lighting source">
      {(['off', 'mood', 'sun-study'] as const).map(mode => <button type="button" key={mode} disabled={busy} aria-pressed={draft.mode === mode} onClick={() => change({ ...draft, mode })}>{mode === 'off' ? 'Editor lighting' : mode === 'mood' ? 'Scene mood' : 'Sun study'}</button>)}
    </div>
    {draft.mode === 'off' && <p className="atmosphere-notice">Your existing editor lighting and manual sunlight controls are in use.</p>}
    {draft.mode === 'mood' && <>
      <div className="atmosphere-presets" aria-label="Mood presets">{moodPresets.map(preset => <button type="button" key={preset.id} onClick={() => change({ ...draft, mood: structuredClone(preset.settings) })}>{preset.name}</button>)}</div>
      <p className="atmosphere-muted">These are artistic lighting moods. For date and location, choose Sun study.</p>
      <div className="atmosphere-fields">
        <Range label="Sun direction" value={draft.mood.azimuth} min={0} max={360} step={1} unit="°" onChange={azimuth => mood({ azimuth })}/>
        <Range label="Sun height" value={draft.mood.elevation} min={-30} max={90} step={1} unit="°" onChange={elevation => mood({ elevation })}/>
        <Range label="Cloud cover" value={draft.mood.cloudiness} min={0} max={1} step={.05} percent onChange={cloudiness => mood({ cloudiness })}/>
        <Range label="Lamp warmth" value={draft.mood.lampKelvin} min={1800} max={6500} step={100} unit=" K" onChange={lampKelvin => mood({ lampKelvin })}/>
        <Range label="Lamp brightness" value={draft.mood.lampBrightness} min={0} max={2.5} step={.05} percent onChange={lampBrightness => mood({ lampBrightness })}/>
      </div>
      <details><summary>Individual lamps</summary><p className="atmosphere-muted">Only the four nearest lamps cast light at once. Individual choices affect that existing pool; brightness and warmth are visual approximations.</p>
        {!fixtures.length && <p>Add a lamp to this floor to give it its own setting.</p>}
        {fixtures.slice(0, 64).map(fixture => {
          const override = draft.mood.fixtureOverrides[fixture.id];
          const patch = (p: Partial<NonNullable<typeof override>>) => mood({ fixtureOverrides: { ...draft.mood.fixtureOverrides, [fixture.id]: { ...override, ...p } } });
          return <fieldset className="atmosphere-fixture" key={fixture.id}><legend>{fixture.name}</legend>
            <label className="atmosphere-check"><input type="checkbox" checked={!!override} disabled={!override && Object.keys(draft.mood.fixtureOverrides).length >= MAX_FIXTURE_OVERRIDES} onChange={event => {
              const overrides = { ...draft.mood.fixtureOverrides };
              if (event.target.checked) overrides[fixture.id] = { enabled: true, kelvin: draft.mood.lampKelvin, brightness: draft.mood.lampBrightness }; else delete overrides[fixture.id];
              mood({ fixtureOverrides: overrides });
            }}/>Use an individual setting</label>
            {override && <><label className="atmosphere-check"><input type="checkbox" checked={override.enabled} onChange={e => patch({ enabled: e.target.checked })}/>Lamp on</label><Range label={`${fixture.name} warmth`} value={override.kelvin} min={1800} max={6500} step={100} unit=" K" onChange={kelvin => patch({ kelvin })}/><Range label={`${fixture.name} brightness`} value={override.brightness} min={0} max={2.5} step={.05} percent onChange={brightness => patch({ brightness })}/></>}
          </fieldset>;
        })}
        {fixtures.length > 64 && <p className="atmosphere-muted">Showing the first 64 lamps on this floor.</p>}
      </details>
      <details><summary>Weather outside</summary><p className="atmosphere-muted">A modest rain effect outside the home. Rain drift is visual only; it does not move furniture or trees. Animation pauses in hidden tabs and with reduced motion.</p>
        <Range label="Rain" value={draft.mood.rain} min={0} max={1} step={.05} percent onChange={rain => mood({ rain })}/>
        <Range label="Rain drift" value={draft.mood.windSpeed} min={0} max={1} step={.05} percent onChange={windSpeed => mood({ windSpeed })}/>
        <Range label="Drift direction" value={draft.mood.windDirection} min={0} max={360} step={1} unit="°" onChange={windDirection => mood({ windDirection })}/>
        <label className="atmosphere-check"><input type="checkbox" checked={draft.mood.animated} onChange={e => mood({ animated: e.target.checked })}/>Animate weather</label>
      </details>
    </>}
    {draft.mode === 'sun-study' && <>
      <p className="atmosphere-notice">Approximate geometric sunlight and shadows. This does not measure light levels, heat, energy use, or compliance. Nearby terrain and buildings outside your model are not included.</p>
      <div className="atmosphere-fields">
        <NumberField label="Latitude (north + / south −)" value={draft.study.latitude} min={-90} max={90} step={.1} onChange={latitude => study({ latitude })}/>
        <NumberField label="Longitude (east + / west −)" value={draft.study.longitude} min={-180} max={180} step={.1} onChange={longitude => study({ longitude })}/>
        <NumberField label="North clockwise from plan up (°)" value={draft.study.northDegrees} min={0} max={360} step={1} onChange={northDegrees => study({ northDegrees })}/>
        <label>Date<input type="date" min="1900-01-01" max="2100-12-31" value={draft.study.date} onChange={e => study({ date: e.target.value })}/></label>
        <NumberField label="Standard UTC offset (minutes)" value={draft.study.utcOffsetMinutes} min={-720} max={840} step={15} onChange={utcOffsetMinutes => study({ utcOffsetMinutes })}/>
        <label>Local time<input type="time" value={formatStudyTime(draft.study.minutesLocal)} onChange={e => { const time = parseStudyTime(e.target.value); if (time !== undefined) study({ minutesLocal: time }); }}/></label>
      </div>
      <p className="atmosphere-muted">Enter an approximate location yourself; nothing is looked up or requested from your device. Plan up is −Z. Standard offset examples: New York −300, India +330, Nepal +345 minutes. Choose the offset for the date you are studying.</p>
      <label className="atmosphere-check"><input type="checkbox" checked={draft.study.daylightSaving} onChange={e => study({ daylightSaving: e.target.checked })}/>Daylight saving is in effect (+60 minutes)</label>
      <p className="atmosphere-muted">Effective offset: {formatUTCOffset(draft.study.utcOffsetMinutes === null ? null : draft.study.utcOffsetMinutes + (draft.study.daylightSaving ? 60 : 0))}. Seasonal changes are never guessed. For a region using a different seasonal shift, enter its effective offset and leave this unchecked.</p>
      <label className="atmosphere-range">Time of day <output>{formatStudyTime(draft.study.minutesLocal)}</output><input aria-label="Time of day" type="range" min={0} max={1439} step={1} value={draft.study.minutesLocal} onChange={e => study({ minutesLocal: Number(e.target.value) })}/></label>
      {problems.length > 0 ? <div className="atmosphere-notice" role="status"><strong>Complete the study</strong><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul><span>Editor lighting is shown until the study is complete.</span></div> : position && <div className="atmosphere-result" role="status"><strong>{position.aboveHorizon ? 'Sun above the horizon' : 'Sun below the horizon · no direct sunlight'}</strong><span>Height {position.elevation.toFixed(1)}° · bearing {position.azimuth.toFixed(1)}° from geographic north</span><span>UTC: {position.utcISO.replace('T', ' ').replace('.000Z', '')}</span><small>Geometric sun center; horizon/refraction effects are omitted.</small></div>}
    </>}
    {draft.mode !== 'off' && <section className="atmosphere-saved"><h3>{draft.mode === 'mood' ? 'Your saved moods' : 'Sun comparisons'}</h3>
      <div className="atmosphere-save-row"><label>Name this {draft.mode === 'mood' ? 'mood' : 'comparison'}<input type="text" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder={draft.mode === 'mood' ? 'Sunday reading' : 'June at noon'}/></label><button type="button" disabled={!name.trim() || snapshots.length >= 8 || problems.length > 0} onClick={save}>Keep snapshot</button></div>
      <p className="atmosphere-muted">Up to eight per home. Saved entries and renames are kept when you choose Apply.</p>
      <ul>{snapshots.map(entry => <li key={entry.id}>{renaming === entry.id ? <div className="atmosphere-save-row"><label>New name<input value={rename} maxLength={60} onChange={e => setRename(e.target.value)}/></label><button type="button" onClick={() => { try { change(renameAtmosphereSnapshot(draft, savedKind, entry.id, rename)); setRenaming(undefined); } catch (e) { setError((e as Error).message); } }}>Save name</button><button type="button" onClick={() => setRenaming(undefined)}>Cancel</button></div> : <><button type="button" className="atmosphere-load" onClick={() => change(savedKind === 'savedMoods' ? { ...draft, mode: 'mood', mood: structuredClone((entry as SceneAtmosphereV1['savedMoods'][number]).settings) } : { ...draft, mode: 'sun-study', study: structuredClone((entry as SceneAtmosphereV1['comparisons'][number]).settings) })}><strong>{entry.name}</strong>{'date' in entry.settings && <small>{entry.settings.date} · {formatStudyTime(entry.settings.minutesLocal)} · {formatUTCOffset(entry.settings.utcOffsetMinutes === null ? null : entry.settings.utcOffsetMinutes + (entry.settings.daylightSaving ? 60 : 0))}</small>}</button><button type="button" aria-label={`Rename ${entry.name}`} onClick={() => { setRenaming(entry.id); setRename(entry.name); }}>Rename</button><button type="button" aria-label={`Delete ${entry.name}`} onClick={() => change({ ...draft, [savedKind]: draft[savedKind].filter(item => item.id !== entry.id) })}>Delete</button></>}</li>)}</ul>
    </section>}
    {onSoundEnabledChange && <div className="atmosphere-audio"><label className="atmosphere-check"><input type="checkbox" checked={soundEnabled} onChange={e => onSoundEnabledChange(e.target.checked)}/>Ambient sound for this session</label><small>Starts only when you choose it. Pauses in hidden tabs; never saved with the home.</small>{soundError && <p role="status">{soundError}</p>}</div>}
    {error && <p className="atmosphere-notice" role="alert">{error}</p>}
    <footer><button type="button" onClick={discard} disabled={busy}>Discard</button><button type="button" disabled={busy || problems.length > 0 || !parseSceneAtmosphere(draft)} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply scene'}</button></footer>
  </section>;
}
function Range({ label, value, min, max, step, unit = '', percent, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; percent?: boolean; onChange: (v: number) => void }) {
  return <label className="atmosphere-range">{label}<output>{percent ? `${Math.round(value * 100)}%` : `${Math.round(value)}${unit}`}</output><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></label>;
}
function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number | null; min: number; max: number; step: number; onChange: (v: number | null) => void }) {
  return <label>{label}<input type="number" value={value ?? ''} min={min} max={max} step={step} placeholder="Not set" onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}/></label>;
}
