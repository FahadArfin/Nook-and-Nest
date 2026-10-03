import {listingOutputImage,listingPreviewImage} from './photoPrivacy';
import {useEffect,useRef,useState} from 'react';
import {openDB} from 'idb';
import {listingVideoAvailability,validateListingVideo,submitListingVideo,getListingVideo,getListingVideoByRequest,deleteListingVideo,validateVideoJob,type ListingVideoAvailability,type ListingVideoJob,type ListingVideoRequest} from './listingVideo';
import type {ListingDocument} from './listingTypes';

const defaultPrompt='Create a calm, polished real estate presentation from these views, in their supplied order. Use realistic furniture materials and natural light. Preserve the property geometry, room proportions, permanent fixtures, doors, windows and exterior views. Do not invent rooms, extensions, people or amenities. Use slow, restrained camera movement. Any furnished or rendered reference is a design concept, not proof of the property condition.';
type Pending={requestId:string;ids:string[];prompt:string;duration:5|10|15;ratio:'16:9'|'9:16'|'1:1';resolution:'720p'|'1080p'};
const terminal=new Set(['succeeded','failed','cancelled','expired','deleted']);
const requestDb=()=>openDB('nook-listing-video-requests',1,{upgrade(db){db.createObjectStore('requests')}});
type SavedRequest={pending?:Pending;job?:ListingVideoJob};
const recordId=(record:SavedRequest|undefined)=>record?.pending?.requestId??record?.job?.requestId;
function localRecord(key:string):SavedRequest|undefined{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):undefined}
async function savedRequest(key:string):Promise<SavedRequest|undefined>{
 const db=await requestDb();try{return await db.get('requests',key)??localRecord(key)}finally{db.close()}
}
/** One IndexedDB transaction owns the active request for a home across tabs. */
async function reserveRequest(key:string,pending:Pending,request:ListingVideoRequest){
 const db=await requestDb(),tx=db.transaction('requests','readwrite');
 try{
  if(await tx.store.get(key)||localRecord(key))throw new Error('Another request exists for this home.');
  await tx.store.put(request,key+':'+pending.requestId);await tx.store.put({pending},key);
  localStorage.setItem(key,JSON.stringify({pending}));await tx.done;
 }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});if(recordId(localRecord(key))===pending.requestId)localStorage.removeItem(key);throw error}
 finally{db.close()}
}
async function persistResult(key:string,next:SavedRequest):Promise<boolean>{
 const db=await requestDb(),tx=db.transaction('requests','readwrite');
 try{
  const active=await tx.store.get(key) as SavedRequest|undefined,id=recordId(next),localId=recordId(localRecord(key));
  if(!id||active&&recordId(active)!==id||localId&&localId!==id||!active&&!localId){await tx.done;return false}
  if(active?.job&&next.job&&(Date.parse(active.job.updatedAt)>Date.parse(next.job.updatedAt)||terminal.has(active.job.status)&&!terminal.has(next.job.status))){await tx.done;return true}
  await tx.store.put(next,key);localStorage.setItem(key,JSON.stringify(next));await tx.done;return true;
 }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw error}finally{db.close()}
}
async function clearRequest(key:string,id:string){
 const db=await requestDb(),tx=db.transaction('requests','readwrite');
 try{
  const active=await tx.store.get(key) as SavedRequest|undefined,localId=recordId(localRecord(key));
  if(active&&recordId(active)!==id||localId&&localId!==id)throw new Error('A newer video request exists in another tab. Reopen this home to recover it.');
  await tx.store.delete(key);await tx.store.delete(key+':'+id);localStorage.removeItem(key);await tx.done;
 }catch(error){try{tx.abort()}catch{}await tx.done.catch(()=>{});throw error}finally{db.close()}
}
function validatePending(value:unknown):Pending{
 const p=value as Pending;
 if(!p||typeof p.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(p.requestId)||!Array.isArray(p.ids)||p.ids.length<1||p.ids.length>9||!p.ids.every(id=>typeof id==='string'&&id.length<=100)||new Set(p.ids).size!==p.ids.length||typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>2000||![5,10,15].includes(p.duration)||!['16:9','9:16','1:1'].includes(p.ratio)||!['720p','1080p'].includes(p.resolution))throw new Error('Invalid saved video request.');
 return {requestId:p.requestId,ids:p.ids,prompt:p.prompt,duration:p.duration,ratio:p.ratio,resolution:p.resolution};
}

// Different projects have separate component lifetimes, including in-flight responses.
export function ListingVideoPanel({listing}:{listing:ListingDocument}){return <ProjectVideoPanel key={listing.planId} listing={listing}/>}
function ProjectVideoPanel({listing}:{listing:ListingDocument}){
 const key='nook-listing-video:'+listing.planId;
 const [available,setAvailable]=useState<ListingVideoAvailability>(),[checking,setChecking]=useState(true),[error,setError]=useState(''),[storageWarning,setStorageWarning]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[locked,setLocked]=useState(false);
 const [ids,setIds]=useState<string[]>([]),[prompt,setPrompt]=useState(defaultPrompt),[duration,setDuration]=useState<5|10|15>(10),[resolution,setResolution]=useState<'720p'|'1080p'>('720p'),[consent,setConsent]=useState(false),[pending,setPending]=useState<Pending>(),[job,setJob]=useState<ListingVideoJob>();
 const [ratio,setRatio]=useState<Pending['ratio']>(listing.format==='portrait'?'9:16':listing.format==='square'?'1:1':'16:9');
 const alive=useRef(true),busyRef=useRef(false),pendingRef=useRef<Pending>(undefined),jobRef=useRef<ListingVideoJob>(undefined),availabilityAbort=useRef<AbortController>(undefined);
 const receive=(next:ListingVideoJob,p=pendingRef.current)=>{
  if(p&&next.requestId!==p.requestId)throw new Error('The video response belongs to a different request. Your existing request has been kept.');
  const current=jobRef.current;
  if(current?.id===next.id&&(Date.parse(next.updatedAt)<Date.parse(current.updatedAt)||terminal.has(current.status)&&!terminal.has(next.status)))return;
  jobRef.current=next;if(alive.current)setJob(next);
  // A pre-submission marker survives even if writing this newer status fails.
  void persistResult(key,{pending:p,job:next}).then(saved=>{if(alive.current)setStorageWarning(saved?'':'A newer video request is open in another tab. Its recovery record has been kept; reopen this home to view it.')}).catch(()=>{if(alive.current)setStorageWarning('The latest status could not be saved on this device. Keep this page open; your saved request ID will be reused if you reopen it.')});
 };
 const refreshAvailability=async()=>{
  availabilityAbort.current?.abort();const abort=new AbortController();availabilityAbort.current=abort;setChecking(true);setError('');
  try{const next=await listingVideoAvailability(abort.signal);if(alive.current&&!abort.signal.aborted)setAvailable(next)}
  catch(e){if(alive.current&&!abort.signal.aborted){setAvailable(undefined);setError((e as Error).message)}}
  finally{if(alive.current&&!abort.signal.aborted)setChecking(false)}
 };
 useEffect(()=>{
  alive.current=true;let disposed=false;void refreshAvailability();
  void(async()=>{try{
   const saved=await savedRequest(key);if(disposed)return;
   if(saved){
    if(!saved.pending&&!saved.job)throw new Error('Invalid saved request.');
    const p=saved.pending?validatePending(saved.pending):undefined,next=saved.job?validateVideoJob(saved.job):undefined;
    if(p&&next&&p.requestId!==next.requestId)throw new Error('Mismatched saved request.');
    if(p){pendingRef.current=p;setPending(p);setIds(p.ids);setPrompt(p.prompt);setDuration(p.duration);setResolution(p.resolution);setRatio(p.ratio)}
    if(next){jobRef.current=next;setJob(next)}
   }
  }catch{if(!disposed){setLocked(true);setStorageWarning('The saved video request could not be read. Check your provider account before submitting another paid generation.')}}
  finally{if(!disposed)setLoaded(true)}})();
  return()=>{disposed=true;alive.current=false;availabilityAbort.current?.abort()};
 },[]);
 useEffect(()=>{
  if(!job||terminal.has(job.status)||job.status==='submission_unknown')return;
  let timer:ReturnType<typeof setTimeout>|undefined,abort:AbortController|undefined,disposed=false;
  const delay=Math.max(10,job.retryAfterSeconds)*1000;
  const schedule=(milliseconds=delay)=>{clearTimeout(timer);if(!disposed&&!document.hidden)timer=setTimeout(()=>void poll(),milliseconds)};
  const poll=async()=>{
   if(disposed||document.hidden)return;if(busyRef.current){schedule();return}
   const controller=new AbortController();abort=controller;
   try{const next=await getListingVideo(job.id,controller.signal);if(alive.current&&!disposed&&!controller.signal.aborted){receive(next);setError('')}}
   catch(e){if(alive.current&&!disposed&&!controller.signal.aborted)setError((e as Error).message)}
   finally{if(!disposed)schedule()}
  };
  const visibility=()=>{clearTimeout(timer);if(document.hidden)abort?.abort();else schedule(0)};
  document.addEventListener('visibilitychange',visibility);schedule();
  return()=>{disposed=true;clearTimeout(timer);abort?.abort();document.removeEventListener('visibilitychange',visibility)};
 },[job?.id,job?.status,job?.retryAfterSeconds]);
 const submit=async()=>{
  if(busyRef.current||!loaded||locked||!available?.available||!available.signedIn||!consent||jobRef.current||pendingRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{
   const p:Pending={requestId:crypto.randomUUID(),ids:[...ids],prompt,duration,resolution,ratio};
   const images=p.ids.map(id=>{const media=listing.media.find(m=>m.id===id);if(!media)throw new Error('A selected image is missing. Select your images again.');return {dataUrl:listingOutputImage(media),label:media.title.slice(0,100)}});
   const request:ListingVideoRequest={requestId:p.requestId,images,prompt:p.prompt,duration:p.duration,resolution:p.resolution,ratio:p.ratio,consent:true};
   await validateListingVideo(request);
   if(!alive.current)return;
   // Keep the immutable local request for audit; recovery sends only its ID.
   try{
    await reserveRequest(key,p,request);
    if(!alive.current){await clearRequest(key,p.requestId);return}
   }catch{throw new Error('No video was submitted because the request could not be saved safely. Check device storage or reopen this home to recover its existing request.')}
   pendingRef.current=p;setPending(p);
   if(!alive.current)return;
   receive(await submitListingVideo(request),p);
  }catch(e){if(alive.current)setError((e as Error).message)}
  finally{busyRef.current=false;if(alive.current)setBusy(false)}
 };
 const recover=async()=>{
  const p=pendingRef.current;
  if(busyRef.current||!loaded||locked||!available?.signedIn||!p||jobRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{receive(await getListingVideoByRequest(p.requestId),p)}
  catch(e){if(alive.current)setError((e as Error).message)}
  finally{busyRef.current=false;if(alive.current)setBusy(false)}
 };
 const manage=async(action:'refresh'|'cancel')=>{
  if(busyRef.current||!jobRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{const id=jobRef.current.id,next=await(action==='refresh'?getListingVideo(id):deleteListingVideo(id));receive(next)}
  catch(e){if(alive.current)setError((e as Error).message)}finally{busyRef.current=false;if(alive.current)setBusy(false)}
 };
 const prepareAnother=async()=>{
  if(!jobRef.current||!terminal.has(jobRef.current.status)||busyRef.current)return;
  busyRef.current=true;setBusy(true);
  try{await clearRequest(key,jobRef.current.requestId);if(!alive.current)return;jobRef.current=undefined;pendingRef.current=undefined;setJob(undefined);setPending(undefined);setConsent(false);setStorageWarning('');setError('')}
  catch(e){if(alive.current)setError((e as Error).message||'Could not clear the saved request. No new generation was started.')}
  finally{busyRef.current=false;if(alive.current)setBusy(false)}
 };
 const lockedControls=!!pending||!!job||busy||!loaded||locked;
 return <div className="listing-video" aria-busy={!loaded||busy}><span className="eyebrow">Optional · AI marketing</span><h2>From your views to a property film</h2><p>Seedance 2.0 can reinterpret selected photos and design renders with realistic materials and camera movement. Review every result for altered architecture before using it in a listing.</p>
  <div className="listing-notice">{checking?'Checking video service…':!available?'Video service availability could not be confirmed.':available.available?(available.signedIn?'Video generation is configured. Generation is billed to the site’s provider account.':'Sign in through Save → Save online in the editor to generate a video. Your local media remains here.'):(available.reason||'Video generation is not configured on this site.')} <button onClick={()=>void refreshAvailability()} disabled={busy||checking}>Check connection</button></div>
  <div className="listing-video-grid">{listing.media.map(m=><label className="listing-video-pick" key={m.id}><img src={listingPreviewImage(m)} alt=""/><input type="checkbox" disabled={lockedControls||(!ids.includes(m.id)&&ids.length>=Math.min(9,available?.limits.maxImages??9))} checked={ids.includes(m.id)} onChange={e=>{setConsent(false);setIds(e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}}/><span>{m.title}</span></label>)}</div>
  {!listing.media.length&&<p>Add photos or capture 3D views first.</p>}<p className="listing-muted">Choose up to nine images. Use property photos without people. Only selected images and the direction below are sent to BytePlus.</p>
  <label>Creative direction<textarea rows={5} maxLength={2000} disabled={lockedControls} value={prompt} onChange={e=>{setPrompt(e.target.value);setConsent(false)}}/></label>
  <div className="listing-row"><div><span>Format</span><div className="listing-segments" aria-label="Video format">{([{value:'16:9',label:'Landscape 16:9'},{value:'9:16',label:'Portrait 9:16'},{value:'1:1',label:'Square 1:1'}] as const).map(option=><button disabled={lockedControls} aria-pressed={ratio===option.value} key={option.value} onClick={()=>{setRatio(option.value);setConsent(false)}}>{option.label}</button>)}</div></div><div><span>Length</span><div className="listing-segments">{([5,10,15] as const).map(n=><button disabled={lockedControls} aria-pressed={duration===n} key={n} onClick={()=>{setDuration(n);setConsent(false)}}>{n} sec</button>)}</div></div><div><span>Resolution</span><div className="listing-segments">{(['720p','1080p'] as const).map(n=><button disabled={lockedControls} aria-pressed={resolution===n} key={n} onClick={()=>{setResolution(n);setConsent(false)}}>{n}</button>)}</div></div></div>
  <label className="listing-check"><input type="checkbox" checked={consent} disabled={busy||!!job||locked||!loaded} onChange={e=>setConsent(e.target.checked)}/>I have permission to use these images and approve sending them to BytePlus for paid generation. I will review and disclose the AI result.</label>
  {!job&&(pending?<button className="primary" disabled={busy||!loaded||locked||!available?.signedIn} onClick={()=>void recover()}>{busy?'Checking saved request…':'Recover this saved request'}</button>:<button className="primary" disabled={busy||!loaded||locked||!available?.available||!available.signedIn||!ids.length||!consent||!prompt.trim()} onClick={()=>void submit()}>{busy?'Submitting…':'Generate with Seedance 2.0'}</button>)}
  {job&&<div className="listing-job" role="status"><strong>Video: {job.status.replaceAll('_',' ')}</strong>{job.error&&<p>{job.error}</p>}<small>Request {job.requestId}</small><div className="listing-row"><button disabled={busy} onClick={()=>void manage('refresh')}>Check status</button>{job.status==='queued'&&<button disabled={busy} onClick={()=>void manage('cancel')}>Cancel queued video</button>}{terminal.has(job.status)&&<button disabled={busy} onClick={prepareAnother}>Prepare another video</button>}</div>{job.status==='succeeded'&&job.videoUrl&&<><video controls preload="none" src={job.videoUrl}/><a href={job.videoUrl} target="_blank" rel="noreferrer">Open finished video to save</a><p>Save it promptly: provider links expire after 24 hours. Label it as an AI design concept when sharing.</p></>}{job.status==='running'&&<p>The provider cannot cancel a video once rendering has begun.</p>}{job.status==='submission_unknown'&&<p>Submission may already have been accepted. Check status or contact the site owner to reconcile it. A second paid request will not be sent.</p>}</div>}
  {pending&&!job&&<p>Request {pending.requestId}. Keep this record if the connection was interrupted. Recovery checks the saved request ID only; it does not send images or start another generation. If it cannot be found, ask the site owner to reconcile this ID before starting another request.</p>}{storageWarning&&<p role="alert">{storageWarning}</p>}{error&&<p role="alert">{error}</p>}
 </div>;
}
