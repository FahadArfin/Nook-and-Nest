import {listingOutputImage,listingPreviewImage} from './photoPrivacy';
import {useEffect,useRef,useState} from 'react';
import type {ListingDocument} from './listingTypes';
import {discoverLocalVideo,downloadLocalVideo,getLocalVideo,loadLocalVideoProfile,localVideoEndpoint,readLocalVideoRecord,reserveLocalVideo,saveLocalVideoProfile,submitLocalVideo,updateLocalVideoRecord,type LocalVideoProfile,type LocalVideoRecord} from './localVideo';

const defaultPrompt='A calm real estate walkthrough from this reference. Preserve the room proportions, permanent fixtures, doors, windows and exterior view. Use natural lighting and slow camera movement. Do not invent rooms, amenities or people.';
export function LocalVideoPanel({listing}:{listing:ListingDocument}){
 const [profile,setProfile]=useState(loadLocalVideoProfile),[token,setToken]=useState(''),[models,setModels]=useState<string[]>([]),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[storageError,setStorageError]=useState('');
 const [imageId,setImageId]=useState(''),[prompt,setPrompt]=useState(defaultPrompt),[seconds,setSeconds]=useState(5),[consent,setConsent]=useState(false),[record,setRecord]=useState<LocalVideoRecord>(),[recoveryId,setRecoveryId]=useState(''),[checkedServer,setCheckedServer]=useState(false),[video,setVideo]=useState(''),[preferenceWarning,setPreferenceWarning]=useState('');
 const alive=useRef(true),running=useRef(false),abort=useRef<AbortController>(undefined),objectUrl=useRef('');
 useEffect(()=>{alive.current=true;let cancelled=false;void readLocalVideoRecord(listing.planId).then(r=>{if(!cancelled){setRecord(r);if(r)setProfile(r.profile);setLoaded(true)}}).catch(()=>{if(!cancelled){setLoaded(true);setStorageError('The saved model request could not be read. Restore browser storage before generating.')}});return()=>{cancelled=true;alive.current=false;abort.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)}},[listing.planId]);
 const run=async(work:(signal:AbortSignal)=>Promise<void>)=>{
  if(running.current)return;running.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
  try{await work(controller.signal)}catch(e){if(alive.current)setError((e as Error).message)}finally{running.current=false;if(alive.current)setBusy(false)};
 };
 const editProfile=(patch:Partial<LocalVideoProfile>)=>{setProfile(p=>({...p,...patch}));setConnected(false);setConsent(false);setModels([])};
 const rememberProfile=(p:LocalVideoProfile)=>{try{saveLocalVideoProfile(p);setPreferenceWarning('')}catch{setPreferenceWarning('Connection preferences could not be remembered. You can keep using this connection while the panel is open.')}};
 const connect=()=>run(async signal=>{
  setConnected(false);const p={...profile,endpoint:localVideoEndpoint(profile.endpoint)},found=await discoverLocalVideo(p,token,signal);if(!alive.current)return;
  if(!record&&!found.includes(p.model))p.model=found[0];
  rememberProfile(p);setProfile(p);setModels(found);setConnected(true);setConsent(false);
 });
 const generate=()=>run(async signal=>{
  if(!loaded||storageError||record||!connected||!consent)return;
  const media=listing.media.find(m=>m.id===imageId);if(!media)throw new Error('Choose a reference image.');
  const image=listingOutputImage(media);
  rememberProfile(profile);
  const saved=await reserveLocalVideo(listing.planId,profile);
  if(!alive.current){await updateLocalVideoRecord(listing.planId,saved,true);return;}
  setRecord(saved);setConsent(false);
  const job=await submitLocalVideo(profile,token,{image,prompt,seconds,consent:true},signal),next={...saved,job};
  // Persist the accepted ID even if the user switches away during the request.
  try{await updateLocalVideoRecord(listing.planId,next)}catch{if(alive.current)setStorageError(`Job ${job.id} was accepted, but its status could not be saved. Keep this job ID.`)}
  if(alive.current)setRecord(next);
 });
 const refresh=()=>run(async signal=>{
  if(!record||!connected)return;const job=await getLocalVideo(record.profile,token,record.job?.id??recoveryId.trim(),signal),next={...record,job};
  await updateLocalVideoRecord(listing.planId,next);if(alive.current){setRecord(next);setStorageError('')}
 });
 const download=()=>run(async signal=>{
  if(!record?.job||!connected)return;const blob=await downloadLocalVideo(record.profile,token,record.job.id,signal);if(!alive.current)return;
  if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(blob);setVideo(objectUrl.current);
 });
 const clear=()=>run(async()=>{
  if(!record||(!['completed','failed'].includes(record.job?.status??'')&&!checkedServer))return;
  await updateLocalVideoRecord(listing.planId,record,true);if(!alive.current)return;
  setRecord(undefined);setConsent(false);setRecoveryId('');setCheckedServer(false);setVideo('');setStorageError('');if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=''}
 });
 const locked=busy||!!record;
 return <section className="listing-video local-video" aria-label="My model server" aria-busy={busy||!loaded}>
  <span className="eyebrow">Your hardware · optional</span><h2>Connect your own video model</h2>
  <p>Keep this disconnected until your server is ready. Only the image and direction you approve go to your chosen server.</p>
  <div className="local-video-connection">
   <label>Server address<input type="url" placeholder="https://your-model-server.example/v1" value={profile.endpoint} disabled={locked} onChange={e=>editProfile({endpoint:e.target.value})}/></label>
   <label>Access token <small>Optional · kept only while this panel is open</small><input type="password" autoComplete="off" value={token} disabled={busy} onChange={e=>{setToken(e.target.value);setConnected(false);setConsent(false)}}/></label>
   <div className="listing-row"><button disabled={busy||!loaded||!profile.endpoint.trim()} onClick={()=>void connect()}>Check server</button><span role="status">{connected?`Server reached · ${models.length} model${models.length===1?'':'s'}`:'Disconnected'}</span>{connected&&<button disabled={busy} onClick={()=>{setConnected(false);setToken('');setConsent(false)}}>Disconnect</button>}</div>
   <details><summary>Connection help</summary><p>Use a SGLang-compatible video server. A cluster needs HTTPS and permission for this website’s origin. Your browser may ask for local network access. Localhost means the computer running this browser.</p><p>No model, GPU driver or server is installed here. Finding a model confirms connectivity, not hardware compatibility or generation quality.</p></details>
  </div>
  {(connected||record)&&<>
   <label>Model<input value={profile.model} disabled={locked} onChange={e=>{setProfile(p=>({...p,model:e.target.value}));setConsent(false)}} list="local-video-models"/></label><datalist id="local-video-models">{models.map(m=><option key={m} value={m}/>)}</datalist>
   <div className="listing-segments" aria-label="Server request format">{(['standard','h3'] as const).map(adapter=><button key={adapter} disabled={locked} aria-pressed={profile.adapter===adapter} onClick={()=>{setProfile(p=>({...p,adapter}));setConsent(false)}}>{adapter==='h3'?'MiniMax H3 · SGLang':'Standard image to video'}</button>)}</div>
   {!record&&<>
    <h3>Choose a starting image</h3><div className="listing-video-grid">{listing.media.map(m=><label className="listing-video-pick" key={m.id}><img src={listingPreviewImage(m)} alt=""/><input type="radio" name="local-video-image" disabled={busy} checked={imageId===m.id} onChange={()=>{setImageId(m.id);setConsent(false)}}/><span>{m.title}</span></label>)}</div>
    {!listing.media.length&&<p>Add photos or capture a 3D view first.</p>}
    <label>Direction<textarea maxLength={2000} value={prompt} disabled={busy} onChange={e=>{setPrompt(e.target.value);setConsent(false)}}/></label>
    <div className="listing-segments" aria-label="Video length">{[5,10,15].map(n=><button disabled={busy} key={n} aria-pressed={seconds===n} onClick={()=>{setSeconds(n);setConsent(false)}}>{n} seconds</button>)}</div>
    <p className="listing-muted">Your installed model determines supported duration and quality. H3 uses its local 768p first-frame workflow; other servers use their configured image-to-video defaults.</p>
    <label className="listing-check"><input type="checkbox" checked={consent} disabled={busy||!connected} onChange={e=>setConsent(e.target.checked)}/>Send this selected image and direction to my model server. I will review the result before using it in a listing.</label>
    <button className="primary" disabled={busy||!connected||!loaded||!!storageError||!imageId||!prompt.trim()||!profile.model.trim()||!consent} onClick={()=>void generate()}>Generate on my server</button>
   </>}
  </>}
  {record&&<div className="listing-job"><strong>{record.job?`Video: ${record.job.status.replaceAll('_',' ')}`:'Submission needs checking'}</strong>
   {record.job?<p>Job <code>{record.job.id}</code>{record.job.progress!==undefined?` · ${record.job.progress}%`:''}</p>:<><p>The server may have accepted this request. Check its job list before generating again; this app will not resubmit it automatically.</p><label>Recover server job ID<input value={recoveryId} disabled={busy} onChange={e=>setRecoveryId(e.target.value)}/></label></>}
   <div className="listing-row"><button disabled={busy||!connected||!record.job&&!recoveryId.trim()} onClick={()=>void refresh()}>Check job status</button>{record.job?.status==='completed'&&<button disabled={busy||!connected} onClick={()=>void download()}>Load finished video</button>}</div>
   {video&&<><video controls preload="metadata" src={video}/><a href={video} download="property-concept.mp4">Save video</a><p>Review architecture and label AI changes before publishing.</p></>}
   {!['completed','failed'].includes(record.job?.status??'')&&<label className="listing-check"><input type="checkbox" checked={checkedServer} disabled={busy} onChange={e=>setCheckedServer(e.target.checked)}/>I checked the server and want to forget this request. This does not stop processing.</label>}
   <button disabled={busy||!['completed','failed'].includes(record.job?.status??'')&&!checkedServer} onClick={()=>void clear()}>Clear local job record</button>
  </div>}
  {preferenceWarning&&<p role="status">{preferenceWarning}</p>}{storageError&&<p role="alert">{storageError}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
