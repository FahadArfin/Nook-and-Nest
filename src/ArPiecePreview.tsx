import {useEffect,useRef,useState} from 'react';
import {arCatalogEntry,arHandoffUrl,arPieceFromSelection,arPieceFromUrl,arScale,encodeArPiece,type ArPiece,type ArSelection} from './arHandoff';
import {configurePieceViewer,loadPieceModelViewer,type PieceModelViewer} from './arModelViewer';
import {createPieceQr} from './arQr';
import './ar-piece-preview.css';

export function ArModelPreview({piece}:{piece:ArPiece}) {
  const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Loading the measured 3D model…'),[verified,setVerified]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),key=encodeArPiece(piece),entry=arCatalogEntry(piece.model);
  useEffect(()=>{
    let cancelled=false,viewer:PieceModelViewer|undefined,loadTimeout:ReturnType<typeof setTimeout>|undefined;setVerified(false);setFailed(false);setStatus('Loading the measured 3D model…');
    const fail=(message:string)=>{if(cancelled)return;viewer?.removeAttribute('ar');setVerified(false);setFailed(true);setStatus(message);};
    void loadPieceModelViewer().then(()=>{
      if(cancelled||!host.current)return;
      viewer=document.createElement('model-viewer') as PieceModelViewer;
      viewer.setAttribute('camera-controls','');viewer.setAttribute('touch-action','pan-y');viewer.setAttribute('ar-modes','webxr quick-look');viewer.setAttribute('ar-scale','fixed');viewer.setAttribute('ar-placement','floor');viewer.setAttribute('environment-image','neutral');viewer.setAttribute('shadow-intensity','0.7');viewer.setAttribute('alt',`${entry.name}, ${piece.widthMm} by ${piece.depthMm} by ${piece.heightMm} millimetres`);viewer.setAttribute('aria-label',`${entry.name} interactive 3D preview`);viewer.setAttribute('scale',arScale(piece).join(' '));
      const button=document.createElement('button');button.slot='ar-button';button.className='ar-native-button';button.textContent='View in my room';button.disabled=true;viewer.appendChild(button);
      viewer.addEventListener('load',()=>{if(loadTimeout)clearTimeout(loadTimeout);void configurePieceViewer(viewer!,piece).then(dimensions=>{
        if(cancelled||!viewer)return;viewer.setAttribute('data-verified-size-mm',[dimensions.x,dimensions.z,dimensions.y].map(n=>(n*1000).toFixed(3)).join(' '));setVerified(true);setFailed(false);setStatus('Size checked against the selected dimensions. Drag to rotate; pinch or scroll to inspect.');button.disabled=false;viewer.setAttribute('ar','');
      }).catch(e=>fail((e as Error).message));});
      viewer.addEventListener('error',()=>{if(loadTimeout)clearTimeout(loadTimeout);fail('The 3D model could not load. Check your connection and try again. Its catalog preview is still shown below.');});
      viewer.addEventListener('ar-status',(event)=>{const state=(event as CustomEvent<{status:string}>).detail?.status;if(state==='failed')fail('AR could not start on this device. You can continue inspecting the piece in 3D.');else if(state==='session-started')setStatus('Move your phone slowly to find a clear floor surface.');else if(state==='object-placed')setStatus('The piece is placed at its selected dimensions.');else if(state==='not-presenting')setStatus('Drag to inspect the piece in 3D, or open AR again on a supported phone.');});
      host.current.replaceChildren(viewer);viewer.src=entry.assetPath;loadTimeout=setTimeout(()=>fail('The model took too long to load. Try again or use the catalog preview.'),30000);
    }).catch(()=>fail('The interactive 3D viewer could not open. The catalog image and dimensions remain available.'));
    return()=>{cancelled=true;if(loadTimeout)clearTimeout(loadTimeout);viewer?.removeAttribute('ar');viewer?.removeAttribute('src');viewer?.remove();};
  },[key,retry]);
  return <section className="ar-model-preview" aria-label="Selected piece preview">
    <div ref={host} className="ar-viewer-host"/>
    <p role={failed?'alert':'status'}>{status}</p>
    {!verified&&<figure className="ar-poster"><img src={entry.posterPath} alt={`${entry.name} catalog view`}/><figcaption>Catalog appearance · selected dimensions: {piece.widthMm} × {piece.depthMm} × {piece.heightMm} mm (width × depth × height)</figcaption></figure>}
    {failed&&<button onClick={()=>setRetry(n=>n+1)}>Try the 3D viewer again</button>}
    {verified&&<><p>On supported phones, the “View in my room” button opens AR at fixed scale. This 3D view works when AR is unavailable.</p><p className="ar-limit">Experimental phone preview. AR tracking can drift; check physical measurements before buying or moving furniture.</p></>}
  </section>;
}
export function ArHandoffPanel({selected,currentUrl}:{selected:ArSelection;currentUrl?:string}) {
  const [handoff,setHandoff]=useState<{piece:ArPiece;link:string;omissions:string[];qr:{size:number;path:string}}>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),generation=useRef(0);
  let selectionKey='';try{selectionKey=encodeArPiece(arPieceFromSelection(selected).piece);}catch{/* The explicit action reports unsupported selected pieces. */}
  useEffect(()=>{generation.current++;setHandoff(undefined);setError('');setBusy(false);},[selectionKey]);
  useEffect(()=>()=>{generation.current++;},[]);
  const create=async()=>{
    const request=++generation.current;setBusy(true);setError('');
    try{const {piece,omissions}=arPieceFromSelection(selected),link=arHandoffUrl(piece,currentUrl??location.href),qr=await createPieceQr(link);if(request!==generation.current)return;setHandoff({piece,link,omissions,qr});}catch(e){if(request===generation.current)setError((e as Error).message);}finally{if(request===generation.current)setBusy(false);}
  };
  return <section className="ar-handoff" aria-label="Phone preview for selected piece"><h3>See this piece in your room</h3><p>Create a link for this public catalog model, its selected dimensions and supported colors. Anyone with the link can view that one piece. Personal artwork and private item data cannot be included.</p>
    <button disabled={busy} onClick={()=>void create()}>{busy?'Preparing phone link…':'Create piece link & QR'}</button>
    {error&&<p role="alert">{error}</p>}
    {handoff&&<><p><strong>{arCatalogEntry(handoff.piece.model).name}</strong> · {handoff.piece.widthMm} × {handoff.piece.depthMm} × {handoff.piece.heightMm} mm</p><svg className="ar-piece-qr" viewBox={`0 0 ${handoff.qr.size} ${handoff.qr.size}`} role="img" aria-label="QR code for this selected piece"><rect width="100%" height="100%" fill="#fff"/><path d={handoff.qr.path} fill="#111" shapeRendering="crispEdges"/></svg><a href={handoff.link} target="_blank" rel="noopener noreferrer">Open piece preview</a><button onClick={()=>{if(!navigator.clipboard){setError('Copy is unavailable. Open the preview and copy its address.');return;}void navigator.clipboard.writeText(handoff.link).then(()=>setError('Link copied.')).catch(()=>setError('Copy is unavailable. Open the preview and copy its address.'));}}>Copy piece link</button>{new URL(handoff.link).protocol!=='https:'&&<p>Local preview link: open the published HTTPS site before scanning from another device.</p>}{handoff.omissions.map(note=><p key={note}>{note}</p>)}</>}
  </section>;
}
/** A separate route: deliberately imports no planner, project store, account, cloud or personal-image module. */
export function ArPreviewPage({url=location.href}:{url?:string}) {
  let piece:ArPiece;try{piece=arPieceFromUrl(url);}catch(e){return <main className="ar-piece-page"><h1>Piece preview unavailable</h1><p role="alert">{(e as Error).message}</p><a href="/">Open Nook &amp; Nest</a></main>;}
  const entry=arCatalogEntry(piece.model);
  return <main className="ar-piece-page"><a href="/">Nook &amp; Nest</a><h1>{entry.name}</h1><p>{piece.widthMm} × {piece.depthMm} × {piece.heightMm} mm · width × depth × height</p><ArModelPreview key={encodeArPiece(piece)} piece={piece}/><p>Uses the catalog model and supported plain material colors. Authored textures and surface finishes keep their original appearance.</p><p>This link contains one catalog piece. Phone preview does not open or edit a home project.</p></main>;
}
