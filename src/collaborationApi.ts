import type {CollaborationBatch,CollaborationRole,CollaborationSnapshot} from './collaborationProtocol';
import {validateCollaborationPlan} from './collaborationProtocol';
export class CollaborationApiError extends Error {constructor(message:string,public status:number,public conflicts:string[]=[]){super(message);}}
export interface CollaborationTransport {snapshot(roomId:string,signal?:AbortSignal,revision?:number,known?:CollaborationSnapshot):Promise<CollaborationSnapshot>;submit(roomId:string,batch:CollaborationBatch,signal?:AbortSignal):Promise<{revision:number}>;presence(roomId:string,value:{floorId?:string;selectionId?:string;leave?:boolean},signal?:AbortSignal):Promise<unknown>}
export interface CollaborationRoomSummary {id:string;name:string;role:CollaborationRole;revision:number;archived:number}
export interface CollaborationVersion {revision:number;name:string;label:string;createdAt:number}
export async function collaborationRequest<T>(path:string,body?:unknown,signal?:AbortSignal,token?:string,expectedAccountId?:string):Promise<T>{
 const res=await fetch('/api/collaboration'+path,{credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',signal,...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(expectedAccountId?{'X-Nook-Collaboration-Account':expectedAccountId}:{})}});
 if(!res.headers.get('content-type')?.includes('application/json'))throw new CollaborationApiError('Online collaboration is unavailable in this preview. Your local recovery copy is available.',503);
 const data=await res.json();if(!res.ok)throw new CollaborationApiError(data.error??'Could not reach the room.',res.status,data.conflicts??[]);return data;
}
export const collaborationApiForAccount=(accountId?:string):CollaborationTransport=>({
 async snapshot(id,signal,revision,known){const data=await collaborationRequest<CollaborationSnapshot&{unchanged?:boolean}>('/'+encodeURIComponent(id)+(revision?'?revision='+revision:known?'?after='+known.revision:''),undefined,signal,undefined,accountId);if(data.unchanged){if(!known||known.roomId!==id||data.revision!==known.revision)throw new Error('Invalid shared revision response.');data.plan=known.plan;}else validateCollaborationPlan(data.plan);return data;},
 submit:(id,b,signal)=>collaborationRequest('/'+encodeURIComponent(id)+'/operations',b,signal,undefined,accountId),
 presence:(id,b,signal)=>collaborationRequest('/'+encodeURIComponent(id)+'/presence',b,signal,undefined,accountId),
});
export const collaborationApi=collaborationApiForAccount();
export {collaborationInvitation} from './publicLinkRoutes';
export function collaborationInviteLink(token:string,origin=location.origin){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid invitation.');return origin+'/#collaboration-invite='+token;}
