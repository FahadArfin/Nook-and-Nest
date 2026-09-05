import { useEffect, useRef, useState } from "react";
import { DotsThree, Trash, CloudArrowUp, DownloadSimple, FileArrowUp, FloppyDisk, Plus, X } from "@phosphor-icons/react";
import { deleteCloudProject, cloudProjects, cloudSession, cloudVersions, openCloudProject, saveCloudProject, type CloudSession, type ProjectSummary, type ProjectVersion } from "./cloudProjects";
import { createBlankPlan, parsePlan, serializePlan, uid } from "./domain";
import { deleteLocalPlan, getCloudRevision, listLocalPlans, saveCloudRevision, savePlan, usePlanner } from "./store";
import { MAX_PLAN_BYTES } from "./planValidation";
import type { PlanDocumentV1 } from "./types";
import "./projects.css";

const date = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
export function ProjectLibrary({ onClose, onOpen, browseOnly=false }: { onClose(): void; onOpen?():void; browseOnly?:boolean }) {
  const plan = usePlanner(s => s.plan), replace = usePlanner(s => s.replacePlan);
  const [session, setSession] = useState<CloudSession>();
  const [locals, setLocals] = useState<PlanDocumentV1[]>([]), [online, setOnline] = useState<ProjectSummary[]>([]);
  const [tab, setTab] = useState<"local" | "online">("local"), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [history, setHistory] = useState<{ id: string; versions: ProjectVersion[] }>();
  const [localReady, setLocalReady] = useState(false), [name, setName] = useState("My next nest");
  const dialog = useRef<HTMLDialogElement>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => { dialog.current?.showModal(); let active = true;
    (browseOnly?Promise.resolve():savePlan(plan)).then(listLocalPlans).then(plans => { if (active) { setLocals(plans); setLocalReady(true); } }).catch(() => { if (active) setError("Device storage is unavailable. Export a backup before leaving."); });
    cloudSession().then(async s => { if (!active) return; setSession(s); if (s.signedIn && s.available) { const data = await cloudProjects(); if (active) setOnline(data.projects); } }).catch(e => { if (active) setSession({ signedIn: false, available: false }); });
    return () => { active = false; };
  }, []);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Your current build is unchanged."); } finally { setBusy(false); } };
  const switchPlan = async (next: PlanDocumentV1) => {
    if(!browseOnly)await savePlan(plan);
    if (!browseOnly && next.id === plan.id && JSON.stringify(next) !== JSON.stringify(plan)) {
      const now = new Date().toISOString();
      await savePlan({ ...structuredClone(plan), id: uid(), name: `${plan.name} · local recovery`, createdAt: now, updatedAt: now });
    }
    await savePlan(next); replace(next); historyClear(); onClose(); onOpen?.();
  };
  const historyClear = () => { if (location.hash.includes("plan=")) window.history.replaceState(null, "", location.pathname + location.search); };
  const refresh = async () => { setLocals(await listLocalPlans()); if (session?.signedIn) setOnline((await cloudProjects()).projects); };
  const saveOnline = (asCopy = false) => run(async () => {
    if (!session?.userId) throw new Error("Sign in again to save.");
    const now = new Date().toISOString();
    const snapshot = asCopy ? { ...structuredClone(plan), id: uid(), name: `${plan.name} copy`, createdAt: now, updatedAt: now } : structuredClone(plan);
    await savePlan(plan);
    const expected = asCopy ? 0 : await getCloudRevision(session.userId, snapshot.id);
    const result = await saveCloudProject(snapshot, expected);
    await saveCloudRevision(session.userId, snapshot.id, result.revision);
    if (asCopy) { await savePlan(snapshot); replace(snapshot); historyClear(); }
    setMessage(`Saved online · version ${result.revision}. Later edits still autosave to this device; save online again when ready.`);
    await refresh();
  });
  const openOnline = (id: string, revision?: number) => run(async () => {
    const result = await openCloudProject(id, revision);
    if (revision !== undefined) {
      const now = new Date().toISOString(); await switchPlan({ ...result.plan, id: uid(), name: `${result.plan.name} · version ${revision} copy`, createdAt: now, updatedAt: now });
    } else {
      await switchPlan(result.plan); await saveCloudRevision(session!.userId!, id, result.revision);
    }
  });
  const backup = () => { const url = URL.createObjectURL(new Blob([serializePlan(plan)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${plan.name}.nook.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const actions=(id:string,name:string,where:"local"|"online",revision?:number)=><details className="project-menu"><summary aria-label={`Actions for ${name}`}><DotsThree size={24}/></summary><button disabled={busy||(!browseOnly&&where==="local"&&id===plan.id)} onClick={()=>{
   if(!window.confirm(`Delete “${name}” ${where==="local"?"from this device":"and all its online versions"}? ${where==="local"?"Online copies stay available.":"Local copies stay available."} This cannot be undone.`))return;
   run(async()=>{if(where==="local")await deleteLocalPlan(id);else await deleteCloudProject(id,revision!);await refresh();setMessage(`Deleted “${name}”.`);});
  }}><Trash/> Delete {where==="local"?"local copy":"online project"}</button></details>;
  return <dialog className="project-library" ref={dialog} aria-labelledby="project-heading" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onKeyDown={e => e.stopPropagation()}>
    <header><div><span className="eyebrow">A home for every idea</span><h2 id="project-heading">Your projects</h2></div><button className="icon-button" disabled={busy} aria-label="Close project library" onClick={onClose}><X /></button></header>
    {!browseOnly&&<section className="project-current"><FloppyDisk size={28}/><div><strong>{plan.name}</strong><p>Edits autosave on this device. Online saves are private to your ChatGPT account.</p></div></section>}
    <div className="project-save-actions">
      {session?.signedIn && session.available && !browseOnly ? <><button className="primary" disabled={busy} onClick={() => saveOnline()}><CloudArrowUp/> Save online</button><button disabled={busy} onClick={() => saveOnline(true)}>Save online as a copy</button><small>{session.email} · <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></small></> : session?.signedIn ? <p>Your online projects are private to your account.</p> : session?.available ? <><a className="project-signin" aria-disabled={!localReady} href={localReady ? "/signin-with-chatgpt?return_to=%2F%3Fprojects%3D1" : undefined} target="_top">Sign in with ChatGPT to save online</a><small>No account needed for local planning.</small></> : <p>Online saving will be available after this update is published. Your device library works here now.</p>}
    </div>
    {error && <p className="project-error" role="alert">{error}</p>}{message && <p className="project-success" role="status">{message}</p>}
    <div className="project-tabs" role="group" aria-label="Project location"><button aria-pressed={tab === "local"} onClick={() => { setTab("local"); setHistory(undefined); }}>On this device · {locals.length}</button><button aria-pressed={tab === "online"} onClick={() => setTab("online")}>Private online saves · {online.length}</button></div>
    <div className="project-list" aria-busy={busy}>
      {history && tab === "online" ? <><button onClick={() => setHistory(undefined)}>← Back to projects</button><p>Last 20 saves. Open any version as a separate copy; the original stays untouched.</p>{history.versions.map(v => <article key={v.revision}><div><strong>Version {v.revision} · {v.name}</strong><small>{date(v.savedAt)}</small></div><button disabled={busy} onClick={() => openOnline(history.id, v.revision)}>Open copy</button></article>)}</> : tab === "local" ? (locals.length?locals.map(p => <article key={p.id}><div><strong>{p.name}</strong><small>{date(p.updatedAt)} · {p.floors.length} floors · {p.furniture.length} pieces</small></div><button disabled={busy || (!browseOnly && p.id === plan.id)} onClick={() => run(() => switchPlan(p))}>{!browseOnly && p.id === plan.id ? "Current" : "Open"}</button>{actions(p.id,p.name,"local")}</article>):<p className="projects-empty">No projects yet. Your next cozy space starts here.</p>) : online.length ? online.map(p => <article key={p.id}><div><strong>{p.name}</strong><small>{date(p.savedAt)} · version {p.revision}</small></div><button disabled={busy} onClick={() => openOnline(p.id)}>Open</button><button disabled={busy} onClick={() => run(async () => setHistory({ id: p.id, versions: (await cloudVersions(p.id)).versions }))}>Versions</button>{actions(p.id,p.name,"online",p.revision)}</article>) : <p>{session?.signedIn ? "Save your current build online to start your private collection." : "Sign in to see your private online projects."}</p>}
    </div>
    <form className="new-project" onSubmit={e => { e.preventDefault(); run(async () => { const next = createBlankPlan(name.trim() || "Untitled nest", plan.units); next.floors = [{ ...next.floors[0], cells: [] }]; await switchPlan(next); }); }}><label>New project name<input maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label><button disabled={busy}><Plus/> New empty project</button></form>
    <footer>{!browseOnly&&<button disabled={busy} onClick={backup}><DownloadSimple/> Export backup</button>}<button disabled={busy} onClick={() => file.current?.click()}><FileArrowUp/> Import copy</button>{!browseOnly&&<button disabled={busy} onClick={() => run(async () => { const now = new Date().toISOString(); await switchPlan({ ...structuredClone(plan), id: uid(), name: `${plan.name} copy`, createdAt: now, updatedAt: now }); })}>Duplicate locally</button>}<input ref={file} hidden type="file" accept=".json,application/json" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) run(async () => { if (selected.size > MAX_PLAN_BYTES) throw new Error("This file is too large. Choose a Nook & Nest JSON backup under 1 MB."); const p = parsePlan(await selected.text()); const now = new Date().toISOString(); await switchPlan({ ...p, id: uid(), name: `${p.name} copy`, createdAt: now, updatedAt: now }); }); }}/></footer>
  </dialog>;
}
