import {lazy,Suspense,useEffect,useMemo,useState,type ReactNode} from 'react';
import {reviewLocation,remixLocation,collaborationInvitation} from './publicLinkRoutes';
import {navigateEditor} from './editorNavigation';
import {clearCollaborationInvitation,pendingCollaborationInvitation,rememberCollaborationInvitation,preserveProjectBeforeInvitation} from './invitationRoute';
const ClientReviewViewer=lazy(()=>import('./ClientReviewViewer').then(m=>({default:m.ClientReviewViewer})));
const RemixViewer=lazy(()=>import('./RemixViewer').then(m=>({default:m.RemixViewer})));

export function publicEntryLocation(hash:string){
  try{const params=new URLSearchParams(hash.replace(/^#/,''));if(['review','remix','idea','collaboration-invite'].some(key=>params.has(key))&&['review','remix','idea','collaboration-invite','plan','share'].filter(key=>params.has(key)).length>1)throw Error('This link combines incompatible destinations. Ask for a fresh shared link.');const review=reviewLocation(hash);if(review)return {kind:'review' as const,value:review};const remix=remixLocation(hash);if(remix)return {kind:'remix' as const,value:remix};const invite=collaborationInvitation(hash);return invite?{kind:'invitation' as const,token:invite}:null;}
  catch(error){return {kind:'invalid' as const,message:(error as Error).message};}
}

/** Public previews branch before Welcome, the editor, project storage or native editor tools mount. */
export function PublicEntry({children}:{children:ReactNode}){
  const [hash,setHash]=useState(()=>location.hash),[routeRevision,setRouteRevision]=useState(0),[openedInvite,setOpenedInvite]=useState(''),[inviteBusy,setInviteBusy]=useState(false),[inviteError,setInviteError]=useState('');
  const target=useMemo(()=>publicEntryLocation(hash)??(pendingCollaborationInvitation()?{kind:'invitation' as const,token:pendingCollaborationInvitation()!}:null),[hash,routeRevision]);
  useEffect(()=>{const update=()=>setHash(location.hash);window.addEventListener('hashchange',update);window.addEventListener('popstate',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);};},[]);
  function leave(edit=false){if(target?.kind==='invitation')clearCollaborationInvitation();setRouteRevision(n=>n+1);const params=new URLSearchParams(location.hash.slice(1));for(const key of ['review','remix','idea','key','revision','collaboration-invite'])params.delete(key);const suffix=params.toString();window.history.replaceState(window.history.state,'',location.pathname+location.search+(suffix?'#'+suffix:''));navigateEditor(edit?'editor':'home',true);setHash(location.hash);}
  if(!target)return children;
  if(target.kind==='invalid')return <main role="alert"><h1>This shared link could not open</h1><p>{target.message}</p><button onClick={()=>leave()}>Back to Nook &amp; Nest</button></main>;
  if(target.kind==='invitation')return openedInvite===target.token?children:<main><h1>Private design invitation</h1><p>Continue to the project library to review this invitation and sign in if needed. The room is joined only after you choose Join private room.</p>{inviteError&&<p role="alert">{inviteError}</p>}<button disabled={inviteBusy} onClick={async()=>{setInviteBusy(true);setInviteError('');try{await preserveProjectBeforeInvitation();rememberCollaborationInvitation(target.token);navigateEditor('editor',true);setOpenedInvite(target.token);}catch(e){setInviteError((e as Error).message);}finally{setInviteBusy(false);}}}>Continue to invitation</button><button disabled={inviteBusy} onClick={()=>leave()}>Back to Nook &amp; Nest</button></main>;
  return <Suspense fallback={<p role="status">Opening read-only preview…</p>}>{target.kind==='review'?<ClientReviewViewer key={JSON.stringify(target.value)} {...target.value}/>:<RemixViewer key={JSON.stringify(target.value)} location={target.value} onExit={()=>leave()} onCreatePrivateCopy={async seed=>{const {copyRemixFromPublicRoute}=await import('./remixProjectCopy');await copyRemixFromPublicRoute(seed,()=>location.hash===hash);leave(true);}}/>}</Suspense>;
}
