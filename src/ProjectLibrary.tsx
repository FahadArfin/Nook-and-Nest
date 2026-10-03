import {clearCollaborationInvitation,rememberCollaborationInvitation} from './invitationRoute';
import {catalog} from './catalog';
import type {StagingVisualProxy} from './stagingInventory';
import type {CollaborationSession} from './collaborationSession';
import {independentRemixPlan} from './remixProjectCopy';
import {remixCreditPath} from './remixAttribution';
import {readListing} from './listingStorage';
import type {ListingDocument} from './listingTypes';
import type {DesignReplayBridge} from './designReplay';
import type {CameraShotPose} from './walkthrough';
import {reidentifyPrivatePlan} from './projectIdentity';
import {PlanThumbnail} from './PlanThumbnail';
import {importPlan} from './planImport';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DotsThree, Trash, CloudArrowUp, DownloadSimple, FileArrowUp, FloppyDisk, Plus, X } from "@phosphor-icons/react";
import { deleteCloudProject, cloudProjects, cloudSession, cloudVersions, openCloudProject, saveCloudProject, type CloudSession, type ProjectSummary, type ProjectVersion } from "./cloudProjects";
import { createBlankPlan, parsePlan, serializePlan, uid } from "./domain";
import { deleteLocalPlan, getCloudRevision, listLocalPlans, saveCloudRevision, savePlan, usePlanner, plannerCollaborationActive } from "./store";
import { MAX_PLAN_BYTES } from "./planValidation";
import type { PlanDocumentV1 } from "./types";
import "./projects.css";
import './creativePlanning.css';
import {LayoutAlternativesPanel} from './LayoutAlternativesPanel';
import {SelectionSchedulePanel} from './SelectionSchedulePanel';
import {ProjectBackupPanel} from './ProjectBackupPanel';

const IdeasPanel=lazy(()=>import('./IdeasPanel').then(m=>({default:m.IdeasPanel})));
const ShareArrangementPanel=lazy(()=>import('./ShareArrangementPanel').then(m=>({default:m.ShareArrangementPanel})));
const OnlineMediaPanel=lazy(()=>import('./OnlineMediaPanel').then(m=>({default:m.OnlineMediaPanel})));
const StagingInventoryPanel=lazy(()=>import('./StagingInventoryPanel').then(m=>({default:m.StagingInventoryPanel})));
const CollaborationPanel=lazy(()=>import('./CollaborationPanel').then(m=>({default:m.CollaborationPanel})));
const DesignHistoryPanel=lazy(()=>import('./DesignHistoryPanel').then(m=>({default:m.DesignHistoryPanel})));
const SiteSurveyPanel=lazy(()=>import('./SiteSurveyPanel').then(m=>({default:m.SiteSurveyPanel})));
const PresentationPanel=lazy(()=>import('./PresentationPanel').then(m=>({default:m.PresentationPanel})));
const InstallChecklistPanel=lazy(()=>import('./InstallChecklistPanel').then(m=>({default:m.InstallChecklistPanel})));
const SurfacePlanningPanel=lazy(()=>import('./SurfacePlanningPanel').then(m=>({default:m.SurfacePlanningPanel})));
const DeliveryPlanningPanel=lazy(()=>import('./DeliveryPlanningPanel').then(m=>({default:m.DeliveryPlanningPanel})));
const HomeManualPanel=lazy(()=>import('./HomeManualPanel').then(m=>({default:m.HomeManualPanel})));
const CompareHomesPanel=lazy(()=>import('./CompareHomesPanel').then(m=>({default:m.CompareHomesPanel})));
const date = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
export function ProjectLibrary({ onClose, onOpen, onLayoutApplied, layoutBlocked=false, browseOnly=false, replayBridge, captureReplayView, onPreviewStockProxy, onOpenCollaboration, invitationToken }: { onClose(): void; onOpen?():void; onLayoutApplied?():void; layoutBlocked?:boolean; browseOnly?:boolean;replayBridge?:DesignReplayBridge;captureReplayView?:()=>CameraShotPose;onPreviewStockProxy?:(proxy:StagingVisualProxy)=>void;onOpenCollaboration?:(session:CollaborationSession)=>Promise<void>;invitationToken?:string }) {
  const plan = usePlanner(s => s.plan), replace = usePlanner(s => s.replacePlan);
  const [previewPlans,setPreviewPlans]=useState<Record<string,PlanDocumentV1>>({});
  const [sort,setSort]=useState("recent");
  const [view,setView]=useState<'projects'|'ideas'|'backup'|'selections'|'surfaces'|'history'|'survey'|'presentation'|'install'|'gallery'|'remix'|'inventory'|'collaboration'|'reviews'|'delivery'|'manual'|'compare'>(invitationToken?'collaboration':'projects');
  const [listing,setListing]=useState<ListingDocument>(),[listingError,setListingError]=useState('');
  useEffect(()=>{if(view!=='presentation'&&view!=='backup')return;let alive=true;setListing(undefined);setListingError('');void readListing(plan.id).then(value=>{if(alive)setListing(value);}).catch(()=>{if(alive)setListingError('Saved listing images could not be read. Your other presentation pages are available.');});return()=>{alive=false;};},[view,plan.id]);
  const commit=(base:PlanDocumentV1,next:PlanDocumentV1)=>{if(layoutBlocked)throw new Error('Finish the current preview before saving project changes.');usePlanner.getState().commitDesign(base,next);};
  const group=['ideas','history'].includes(view)?'design':['selections','surfaces','survey','install','inventory','delivery','manual','compare'].includes(view)?'planning':['gallery','remix','collaboration','reviews'].includes(view)?'sharing':view;
  const [session, setSession] = useState<CloudSession>();
  const [sourceRevision,setSourceRevision]=useState<number>();
  useEffect(()=>{let alive=true;setSourceRevision(undefined);if(session?.userId)void getCloudRevision(session.userId,plan.id).then(value=>{if(alive&&value>0)setSourceRevision(value);}).catch(()=>{});return()=>{alive=false;};},[session?.userId,plan.id,plan.updatedAt]);
  const [locals, setLocals] = useState<PlanDocumentV1[]>([]), [online, setOnline] = useState<ProjectSummary[]>([]);
  const [tab, setTab] = useState<"local" | "online">("local"), [busy, setBusyState] = useState(false);
  const busyRef=useRef(false),setBusy=useCallback((value:boolean)=>{busyRef.current=value;setBusyState(value);},[]);
  const close=()=>{if(!busyRef.current)onClose();};
  useEffect(()=>{if(!busy)return;const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[busy]);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [history, setHistory] = useState<{ id: string; versions: ProjectVersion[] }>();
  const [localReady, setLocalReady] = useState(false), [name, setName] = useState("My next nest");
  const dialog = useRef<HTMLDialogElement>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => { dialog.current?.showModal(); let active = true;
    (browseOnly?Promise.resolve():savePlan(plan)).then(listLocalPlans).then(plans => { if (active) { setLocals(plans); setLocalReady(true); } }).catch(() => { if (active) setError("Device storage is unavailable. Export a backup before leaving."); });
    cloudSession().then(async s => { if (!active) return; setSession(s); if (s.signedIn && s.available) { const data = await cloudProjects(); if (active) setOnline(data.projects); } }).catch(e => { if (active) setSession({ signedIn: false, available: false }); });
    return () => { active = false; };
  }, []);
  const run = async (action: () => Promise<void>) => { if(busyRef.current)return;setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Your current build is unchanged."); } finally { setBusy(false); } };
  const saveCurrent=async()=>{
    if(layoutBlocked)throw new Error('Finish or discard the current preview before switching projects.');
    if(plannerCollaborationActive())throw new Error('Leave the shared room before switching private projects.');
    const current=usePlanner.getState().plan;
    if(!browseOnly)await savePlan(current);
    if(usePlanner.getState().plan!==current)throw new Error('The active project changed while saving. Try again with the current project.');
    return current;
  };
  const switchPlan = async (input: PlanDocumentV1) => {
    const next=parsePlan(JSON.stringify(input)),current=await saveCurrent();
    const check=()=>{if(usePlanner.getState().plan!==current||plannerCollaborationActive())throw new Error('The active project changed. Your saved copies remain in the library.');};
    if (!browseOnly && next.id === current.id && JSON.stringify(next) !== JSON.stringify(current)) {
      await savePlan(reidentifyPrivatePlan(current,uid(),`${current.name.slice(0,135)} · local recovery`));check();
    }
    await savePlan(next);
    try{check();}catch(error){await savePlan(usePlanner.getState().plan);throw error;}
    replace(next); historyClear(); onClose(); onOpen?.();
  };
  const copyRemix=async(seed:PlanDocumentV1)=>{const current=usePlanner.getState().plan,next=await independentRemixPlan(seed);if(usePlanner.getState().plan!==current)throw new Error('The active project changed. Preview the copy again.');await switchPlan(next);};
  const historyClear = () => { if (/plan=|share=/.test(location.hash)) window.history.replaceState(window.history.state, "", location.pathname + location.search); };
  const refresh = async () => { setLocals(await listLocalPlans()); if (session?.signedIn) setOnline((await cloudProjects()).projects); };
  const refreshComparisonPlans=useCallback(async()=>{
    const saved=await listLocalPlans(),current=usePlanner.getState().plan;
    const latest=[current,...saved.filter(p=>p.id!==current.id)];
    setLocals(latest);return latest;
  },[]);
  const saveOnline = (asCopy = false) => run(async () => {
    if (!session?.userId) throw new Error("Sign in again to save.");
    const current=await saveCurrent(),now = new Date().toISOString();
    const snapshot = asCopy ? reidentifyPrivatePlan(current,uid(),`${current.name.slice(0,150)} copy`,now) : structuredClone(current);
    const expected = asCopy ? 0 : await getCloudRevision(session.userId, snapshot.id);
    const result = await saveCloudProject(snapshot, expected);
    await saveCloudRevision(session.userId, snapshot.id, result.revision);setSourceRevision(result.revision);
    if (asCopy) { if(usePlanner.getState().plan!==current)throw new Error('The online copy was saved, but your active project changed. Open the copy from private online saves.');await savePlan(snapshot);if(usePlanner.getState().plan!==current){await savePlan(usePlanner.getState().plan);throw new Error('The copy was saved. Your newer active edits were kept.');}replace(snapshot);historyClear(); }
    setMessage(`Saved online · version ${result.revision}. Later edits still autosave to this device; save online again when ready.`);
    await refresh();
  });
  const openOnline = (id: string, revision?: number) => run(async () => {
    const result = await openCloudProject(id, revision);
    if (revision !== undefined) {
      const now = new Date().toISOString(); await switchPlan(reidentifyPrivatePlan(result.plan,uid(),`${result.plan.name} · version ${revision} copy`,now));
    } else {
      await switchPlan(result.plan); await saveCloudRevision(session!.userId!, id, result.revision);
    }
  });
  const backup = () => { const url = URL.createObjectURL(new Blob([serializePlan(plan)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${plan.name}.nook.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const actions=(id:string,name:string,where:"local"|"online",revision?:number)=><details className="project-menu"><summary aria-label={`Actions for ${name}`}><DotsThree size={24}/></summary><button disabled={busy} onClick={()=>{const nextName=window.prompt('Project name',name)?.trim();if(!nextName||nextName===name)return;run(async()=>{if(where==='local'){const source=locals.find(p=>p.id===id);if(!source)return;const next={...source,name:nextName,updatedAt:new Date().toISOString()};await savePlan(next);if(plan.id===id)usePlanner.getState().rename(nextName);}else{const source=await openCloudProject(id);await saveCloudProject({...source.plan,name:nextName},source.revision);}await refresh();});}}>Rename</button><button disabled={busy||(!browseOnly&&where==="local"&&id===plan.id)} onClick={()=>{
   if(!window.confirm(`Delete “${name}” ${where==="local"?"from this device":"and all its online versions"}? ${where==="local"?"Online copies stay available.":"Local copies stay available."} This cannot be undone.`))return;
   run(async()=>{if(where==="local")await deleteLocalPlan(id);else await deleteCloudProject(id,revision!);await refresh();setMessage(`Deleted “${name}”.`);});
  }}><Trash/> Delete {where==="local"?"local copy":"online project"}</button></details>;
  return <dialog className="project-library" ref={dialog} aria-labelledby="project-heading" onCancel={e => { e.preventDefault(); if (!busyRef.current) onClose(); }} onKeyDown={e => e.stopPropagation()}>
    <header><div><span className="eyebrow">A home for every idea</span><h2 id="project-heading">Your projects</h2></div><button className="icon-button" disabled={busy} aria-label="Close project library" onClick={close}><X /></button></header>
    <nav className="project-views" aria-label="Project tools">{([{id:'projects',label:'Projects',target:'projects'},...(!browseOnly?[{id:'design',label:'Design',target:'ideas'},{id:'planning',label:'Planning',target:'selections'},{id:'presentation',label:'Present',target:'presentation'}]:[]),{id:'sharing',label:browseOnly?'Ideas':'Ideas & sharing',target:'gallery'},...(browseOnly?[{id:'planning',label:'Staging · pilot',target:'inventory'}]:[]),{id:'backup',label:'Backups',target:'backup'}] as const).map(item=><button key={item.id} disabled={busy} aria-pressed={group===item.id} onClick={()=>setView(item.target as typeof view)}>{item.label}</button>)}</nav>
    {!browseOnly&&(group==='design'||group==='planning')&&<nav className="project-views project-subviews" aria-label={group==='design'?'Design tools':'Planning tools'}>{(group==='design'?[['ideas','Layout ideas'],['history','Renovation & milestones']]:[['selections','Selections & budget'],['compare','Compare homes'],['delivery','Delivery check'],['manual','Home manual'],['surfaces','Surfaces & elevations'],['survey','Site notes'],['install','Install checklist'],['inventory','Staging inventory · pilot']]).map(([id,label])=><button key={id} disabled={busy} aria-pressed={view===id} onClick={()=>setView(id as typeof view)}>{label}</button>)}</nav>}
    {group==='sharing'&&<nav className="project-views project-subviews" aria-label="Sharing tools">{[['gallery','Ideas gallery'],...(!browseOnly?[['remix','Share an arrangement'],['reviews','Client reviews'],['collaboration','Work together']]:[])].map(([id,label])=><button key={id} disabled={busy} aria-pressed={view===id} onClick={()=>setView(id as typeof view)}>{label}</button>)}</nav>}
    <Suspense fallback={<p role="status">Opening project tools…</p>}>
      {view==='gallery'&&<><IdeasPanel onBusyChange={setBusy} onCreatePrivateCopy={copyRemix}/>{layoutBlocked&&<p>Finish the current placement or preview before creating a private copy.</p>}</>}
      {view==='remix'&&!browseOnly&&<ShareArrangementPanel plan={plan} floorId={usePlanner.getState().activeFloorId} onBusyChange={setBusy}/>}
      {view==='reviews'&&!browseOnly&&<section aria-label="Client reviews"><h3>Share a client review</h3><p>Open Listing studio from the editor, choose your saved views and any photos to include, then preview the exact client review before creating its private link. Publishing and feedback stay separate from your editable project.</p></section>}
      {view==='collaboration'&&!browseOnly&&(layoutBlocked?<p>Finish the current preview before working together.</p>:onOpenCollaboration?<><p>Shared rooms use your signed-in account. Invitations are accepted explicitly.</p>{!session?.signedIn&&session?.available&&<a href="/signin-with-chatgpt?return_to=%2F%3Fprojects%3D1" onClick={e=>{if(busyRef.current)e.preventDefault();else if(invitationToken&&!rememberCollaborationInvitation(invitationToken)){e.preventDefault();setError('This browser cannot keep the invitation through sign-in. Sign in from Projects, then reopen your invitation link.');}}}>Sign in with ChatGPT to review invitation or work together</a>}<CollaborationPanel plan={plan} accountId={session?.userId} sourceRevision={sourceRevision} inviteToken={invitationToken} onBusyChange={setBusy} onOpenSession={async shared=>{await saveCurrent();await onOpenCollaboration(shared);clearCollaborationInvitation();onClose();}} onCreatePrivateCopy={async source=>{await switchPlan(reidentifyPrivatePlan(source,uid(),`${source.name.slice(0,145)} · copy`));}}/></>:<p>Open this project in Design in 3D to work together in a private room.</p>)}
      {view==='inventory'&&<StagingInventoryPanel catalog={catalog} onBusyChange={setBusy} onClose={()=>{if(!busyRef.current)setView('projects');}} onPreviewProxy={!browseOnly&&!layoutBlocked&&onPreviewStockProxy?proxy=>{if(busyRef.current)return;onPreviewStockProxy(proxy);onClose();}:undefined}/>}
    </Suspense>
    {view==='ideas'&&layoutBlocked&&<p role="status">Finish or discard the current placement or preview to work with layout ideas. Your unfinished work is still here.</p>}
    {view==='ideas'&&!browseOnly&&!layoutBlocked&&<LayoutAlternativesPanel onBusyChange={setBusy} plan={plan} activeFloorId={usePlanner.getState().activeFloorId} onChange={(base,next)=>usePlanner.getState().commitDesign(base,next)} onApply={(base,next,floorId)=>{usePlanner.getState().commitDesign(base,next,floorId,{restoreLayout:true});onLayoutApplied?.();}}/>}
    {view==='selections'&&!browseOnly&&<SelectionSchedulePanel plan={plan} activeFloorId={usePlanner.getState().activeFloorId} disabled={layoutBlocked} onCommit={(base,next)=>usePlanner.getState().commitDesign(base,next)}/>}
    {view==='surfaces'&&!browseOnly&&<Suspense fallback={<p role="status">Opening surfaces and elevations…</p>}><SurfacePlanningPanel plan={plan} activeFloorId={usePlanner.getState().activeFloorId} disabled={layoutBlocked} onCommit={(base,next)=>usePlanner.getState().commitDesign(base,next)}/></Suspense>}
    {!browseOnly&&<Suspense fallback={<p role="status">Opening project tools…</p>}>
      {view==='compare'&&<CompareHomesPanel localPlans={[plan,...locals.filter(p=>p.id!==plan.id)]} onlineProjects={online} disabled={layoutBlocked||plannerCollaborationActive()} onLoadOnline={async id=>{if(!online.some(p=>p.id===id))throw new Error('Choose a project from your private online saves.');return (await openCloudProject(id)).plan;}} onRefreshLocal={refreshComparisonPlans} onCopiesSaved={async()=>{await refreshComparisonPlans();}} onOpenCopy={switchPlan} onBusyChange={setBusy}/>}
      {view==='delivery'&&<DeliveryPlanningPanel plan={plan} disabled={layoutBlocked} onCommit={commit}/>}
      {view==='manual'&&<HomeManualPanel plan={plan} disabled={layoutBlocked} onCommit={commit}/>}
      {view==='history'&&(layoutBlocked?<p>Finish the current preview before working with design history.</p>:replayBridge&&captureReplayView?<DesignHistoryPanel plan={plan} activeFloorId={usePlanner.getState().activeFloorId} bridge={replayBridge} captureView={captureReplayView} onBusyChange={setBusy} onChange={commit} onApply={(base,next,floorId)=>{usePlanner.getState().commitDesign(base,next,floorId,{restoreLayout:true});onLayoutApplied?.();}}/>:<p>Open this project in Design in 3D to compare renovation phases and replay milestones.</p>)}
      {view==='survey'&&<SiteSurveyPanel plan={plan} activeFloorId={usePlanner.getState().activeFloorId} disabled={layoutBlocked} onCommit={commit}/>}
      {view==='presentation'&&<>{listingError&&<p role="status">{listingError}</p>}<PresentationPanel plan={plan} listing={listing} disabled={layoutBlocked} onCommit={commit}/></>}
      {view==='install'&&<InstallChecklistPanel onClose={onClose} plan={plan} activeFloorId={usePlanner.getState().activeFloorId} disabled={layoutBlocked} onChange={commit} onSelectItem={id=>{const item=plan.furniture.find(p=>p.id===id);if(item){usePlanner.getState().setActiveFloor(item.floorId);usePlanner.getState().select(id);onClose();}}}/>}
    </Suspense>}
    {view==='backup'&&<>{listingError&&<p role="status">{listingError}</p>}<ProjectBackupPanel plan={browseOnly?undefined:plan} listing={listing} disabled={busy||layoutBlocked} onBusyChange={setBusy} beforeRestore={async()=>{await saveCurrent();}} onRestored={switchPlan}/><Suspense fallback={<p role="status">Opening online backup options…</p>}><OnlineMediaPanel plan={browseOnly?undefined:plan} listing={listing} disabled={busy||layoutBlocked} onBusyChange={setBusy} beforeRestore={async()=>{await saveCurrent();}} onRestored={switchPlan}/></Suspense></>}
    {view!=='projects'&&error&&<p role="alert" className="project-error">{error}</p>}
    {view==='projects'&&<>
    {!browseOnly&&<section className="project-current"><FloppyDisk size={28}/><div><strong>{plan.name}</strong><p>Edits autosave on this device. Online saves are private to your ChatGPT account.</p></div></section>}
    {!browseOnly&&!!plan.remixAttribution?.credits.length&&<details><summary>Arrangement creator credits</summary><p>Self-reported public credits stay with copies and reusable kits.</p><ul>{plan.remixAttribution.credits.map(c=><li key={`${c.source}:${c.id}:${c.revision}`}>{c.title} · {c.creator} · revision {c.revision} · remix with credit{remixCreditPath(c)&&<> · <a href={remixCreditPath(c)} target="_blank" rel="noopener noreferrer">View source</a></>}</li>)}</ul></details>}
    <div className="project-save-actions">
      {session?.signedIn && session.available && !browseOnly ? <><button className="primary" disabled={busy} onClick={() => saveOnline()}><CloudArrowUp/> Save online</button><button disabled={busy} onClick={() => saveOnline(true)}>Save online as a copy</button><small>{session.email} · <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></small></> : session?.signedIn ? <p>Your online projects are private to your account.</p> : session?.available ? <><a className="project-signin" aria-disabled={!localReady} href={localReady ? "/signin-with-chatgpt?return_to=%2F%3Fprojects%3D1" : undefined} target="_top">Sign in with ChatGPT to save online</a><small>No account needed for local planning.</small></> : !session?<p role="status">Checking online saving…</p>:<p>Online saving is unavailable right now. Your device library still works; export a backup to keep a portable copy.</p>}
    </div>
    {error && <p className="project-error" role="alert">{error}</p>}{message && <p className="project-success" role="status">{message}</p>}
    <div className="project-tabs" role="group" aria-label="Project location"><button disabled={busy} aria-pressed={tab === "local"} onClick={() => { setTab("local"); setHistory(undefined); }}>On this device{localReady?` · ${locals.length}`:""}</button><button disabled={busy} aria-pressed={tab === "online"} onClick={() => setTab("online")}>Private online saves · {online.length}</button></div>
    <div className="project-sort" role="group" aria-label="Sort projects"><span>Sort by</span>{[{id:'recent',label:'Recently edited'},{id:'name',label:'Name A–Z'}].map(option=><button key={option.id} disabled={busy} aria-pressed={sort===option.id} onClick={()=>setSort(option.id)}>{option.label}</button>)}</div><div className="project-list" aria-busy={busy}>
      {history && tab === "online" ? <><button disabled={busy} onClick={() => setHistory(undefined)}>← Back to projects</button><p>Last 20 saves. Open any version as a separate copy; the original stays untouched.</p>{history.versions.map(v => <article key={v.revision}><div><strong>Version {v.revision} · {v.name}</strong><small>{date(v.savedAt)}</small></div><button disabled={busy} onClick={() => openOnline(history.id, v.revision)}>Open copy</button></article>)}</> : tab === "local" ? (!localReady?<p role="status">{error?"Device project list could not be opened.":"Opening device projects…"}</p>:locals.length?[...locals].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.updatedAt.localeCompare(a.updatedAt)).map(p => <article key={p.id}><PlanThumbnail plan={p}/><div><strong>{p.name}</strong><small>{date(p.updatedAt)} · {p.floors.length} floors · {p.furniture.length} pieces</small></div><button disabled={busy || (!browseOnly && p.id === plan.id)} onClick={() => run(() => switchPlan(p))}>{!browseOnly && p.id === plan.id ? "Current" : "Open"}</button>{actions(p.id,p.name,"local")}</article>):<p className="projects-empty">No projects yet. Your next cozy space starts here.</p>) : online.length ? [...online].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.savedAt.localeCompare(a.savedAt)).map(p => <article key={p.id}>{previewPlans[p.id]?<PlanThumbnail plan={previewPlans[p.id]}/>:<button disabled={busy} onClick={()=>run(async()=>{const result=await openCloudProject(p.id);setPreviewPlans(existing=>({...existing,[p.id]:result.plan}))})}>Preview</button>}<div><strong>{p.name}</strong><small>{date(p.savedAt)} · version {p.revision}</small></div><button disabled={busy} onClick={() => openOnline(p.id)}>Open</button><button disabled={busy} onClick={() => run(async () => setHistory({ id: p.id, versions: (await cloudVersions(p.id)).versions }))}>Versions</button>{actions(p.id,p.name,"online",p.revision)}</article>) : <p>{session?.signedIn ? "Save your current build online to start your private collection." : "Sign in to see your private online projects."}</p>}
    </div>
    <form className="new-project" onSubmit={e => { e.preventDefault(); run(async () => { const next = createBlankPlan(name.trim() || "Untitled nest", plan.units); next.floors = [{ ...next.floors[0], cells: [] }]; await switchPlan(next); }); }}><label>New project name<input maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label><button disabled={busy}><Plus/> New empty project</button></form>
    <footer>{!browseOnly&&<button disabled={busy} onClick={backup}><DownloadSimple/> Export backup</button>}<button disabled={busy} onClick={() => file.current?.click()}><FileArrowUp/> Import copy</button>{!browseOnly&&<button disabled={busy} onClick={() => run(async () => { const now = new Date().toISOString(); await switchPlan(reidentifyPrivatePlan(plan,uid(),`${plan.name} copy`,now)); })}>Duplicate locally</button>}<input ref={file} hidden type="file" accept=".json,application/json" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) run(async () => { if (selected.size > MAX_PLAN_BYTES*4) throw new Error("This backup is too large to open safely."); const p = await importPlan(await selected.text()); const now = new Date().toISOString(); await switchPlan(reidentifyPrivatePlan(p,uid(),`${p.name} copy`,now)); }); }}/></footer>
    </>}
  </dialog>;
}
