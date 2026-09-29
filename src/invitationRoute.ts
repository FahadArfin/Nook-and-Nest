const key='nook-pending-collaboration-invitation-v1';
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
/** Capability stays in the fragment or this tab's bounded session storage, never an auth return URL. */
export function pendingCollaborationInvitation():string|undefined{
  const params=new URLSearchParams(location.hash.slice(1));
  if(['review','remix','idea','plan','share'].some(p=>params.has(p)))return;
  const token=params.get('collaboration-invite');if(valid(token))return token;
  if(!new URLSearchParams(location.search).has('projects'))return;
  try{const v=JSON.parse(sessionStorage.getItem(key)??'null');if(valid(v?.token)&&Number.isFinite(v.expiresAt)&&v.expiresAt>Date.now()&&v.expiresAt<=Date.now()+86400000)return v.token;sessionStorage.removeItem(key);}catch{/* Session storage can be unavailable. */}
}
export function rememberCollaborationInvitation(token:string):boolean{
  if(!valid(token))throw Error('This invitation is incomplete.');
  try{sessionStorage.setItem(key,JSON.stringify({token,expiresAt:Date.now()+86400000}));return true;}catch{return false;}
}
export function clearCollaborationInvitation(){
  try{sessionStorage.removeItem(key);}catch{/* The fragment can still be cleared. */}
  const p=new URLSearchParams(location.hash.slice(1));p.delete('collaboration-invite');window.history.replaceState(window.history.state,'',location.pathname+location.search+(p.size?'#'+p.toString():''));
}
export async function preserveProjectBeforeInvitation(){
  const runtime=await import('./store');if(runtime.plannerCollaborationActive())throw Error('Leave the current shared room before opening another invitation.');
  const current=runtime.usePlanner.getState().plan;
  if(current.id!==runtime.usePlanner.getInitialState().plan.id)await runtime.savePlan(current);
  if(runtime.usePlanner.getState().plan!==current)throw Error('Your project changed while saving. Please try again.');
}
