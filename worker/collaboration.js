import {encodeStoredPlan,decodeStoredPlan} from './plan-storage.js';
import {COLLAB_LIMITS,collabId,collabName,collaborationPlan,collaborationLayout,validateCollaborationPlan,parseCollaborationBatch,applyCollaborationBatch,collaborationHash,CollaborationConflict} from '../src/collaborationProtocol.ts';

// NN-27 requires evidence from asynchronous review and a two-editor pilot before a production rollout.
// This compile-time gate is not controllable through a request, query, cookie or client preference.
export const COLLABORATION_PRODUCTION_ENABLED=false;
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const fail=(error,status,extra={})=>response({error,...extra},status);
class ApiError extends Error {constructor(message,status){super(message);this.status=status;}}
async function body(request,max=COLLAB_LIMITS.operationBytes+4096){const reader=request.body?.getReader();if(!reader)throw new ApiError('Send a JSON request.',400);let count=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>max){await reader.cancel();throw new ApiError('This request is too large. Save a local copy.',413);}chunks.push(value);}const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError('Invalid JSON.',400);}}
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new ApiError('Unsupported request fields.',400);return v;};
const token=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const memberView=m=>({id:m.member_id,name:m.name,role:m.role,epoch:m.epoch,active:!!m.active});
const memberQuery=`SELECT m.*,r.archived,r.name AS room_name FROM collaboration_members m JOIN collaboration_rooms r ON r.id=m.room_id WHERE m.room_id=? AND m.user_id=? AND m.active=1`;

export function createCollaborationApi({enabled=COLLABORATION_PRODUCTION_ENABLED,now=()=>Date.now()}={}){
return async function collaboration(request,env){
 const url=new URL(request.url),prefix='/api/collaboration';if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return null;
 const owner=request.headers.get('oai-authenticated-user-id'),db=env.DB;
 if(url.pathname===prefix+'/status'&&request.method==='GET')return response({available:!!db&&enabled,signedIn:!!owner,pilot:true,rollout:'Pilot only; demand and production acceptance remain unproven.'});
 if(!enabled)return fail('Live collaboration is a gated pilot. Local planning, copies and recovery exports remain available.',503);
 if(!owner)return fail('Sign in to join a private collaboration.',401);if(!db)return fail('Online collaboration is unavailable. Keep your local changes.',503);
 const expectedAccount=request.headers.get('x-nook-collaboration-account');
 if(expectedAccount&&expectedAccount!==owner)return fail('Your signed-in account changed. Leave this session; its original account retains the device recovery queue.',401);
 if(!['GET','POST'].includes(request.method))return fail('Method not allowed.',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return fail('Use collaboration on this site.',403);
 if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return fail('Send JSON.',415);
 try{
  const path=url.pathname.slice(prefix.length),time=now();
  if(path===''&&request.method==='GET'){
   const {results}=await db.prepare(`SELECT r.id,r.name,r.archived,m.role,MAX(c.revision) AS revision FROM collaboration_rooms r JOIN collaboration_members m ON m.room_id=r.id JOIN collaboration_commits c ON c.room_id=r.id WHERE m.user_id=? AND m.active=1 GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50`).bind(owner).all();return response({rooms:results});
  }
  if(path===''&&request.method==='POST'){
   const b=exact(await body(request,4096),['sourceProjectId','sourceRevision','name','displayName','reviewed','reviewedHash']);if(!collabId(b.sourceProjectId)||!Number.isSafeInteger(b.sourceRevision)||b.sourceRevision<1||b.reviewed!==true||typeof b.reviewedHash!=='string'||!/^[a-f0-9]{64}$/.test(b.reviewedHash))throw new ApiError('Review a saved project before creating a shared copy.',400);
   const name=collabName(b.name,120),displayName=collabName(b.displayName),source=await db.prepare('SELECT document,revision FROM project_versions WHERE owner_id=? AND project_id=? ORDER BY revision DESC LIMIT 1').bind(owner,b.sourceProjectId).first();
   if(!source)throw new ApiError('Private source project not found.',404);if(source.revision!==b.sourceRevision)throw new ApiError('Your online source changed. Review its latest version.',409);
   const id=crypto.randomUUID(),memberId=crypto.randomUUID(),plan=collaborationPlan(await decodeStoredPlan(source.document),id,name),document=await encodeStoredPlan(plan);
   if(b.reviewedHash!==await collaborationHash({units:plan.units,...collaborationLayout(plan)}))throw new ApiError('The layout you reviewed differs from its online save. Save your latest layout online and review again.',409);
   const result=await db.batch([
    db.prepare(`INSERT INTO collaboration_rooms(id,owner_id,name,created_at,source_project_id,source_revision) SELECT ?,?,?,?,?,? WHERE (SELECT MAX(revision) FROM project_versions WHERE owner_id=? AND project_id=?)=? AND (SELECT COUNT(*) FROM collaboration_rooms WHERE owner_id=?)<?`).bind(id,owner,name,time,b.sourceProjectId,b.sourceRevision,owner,b.sourceProjectId,b.sourceRevision,owner,COLLAB_LIMITS.rooms),
    db.prepare(`INSERT INTO collaboration_members(room_id,user_id,member_id,name,role) SELECT ?,?,?,?,'owner' WHERE EXISTS(SELECT 1 FROM collaboration_rooms WHERE id=? AND owner_id=?)`).bind(id,owner,memberId,displayName,id,owner),
    db.prepare(`INSERT INTO collaboration_commits(room_id,revision,operation_id,operation_hash,member_id,actor_name,label,created_at,document) SELECT ?,1,?,'seed',?,?,'Created shared copy',?,? WHERE EXISTS(SELECT 1 FROM collaboration_rooms WHERE id=? AND owner_id=?)`).bind(id,id,memberId,displayName,time,document,id,owner)
   ]);if(!result[0].meta.changes)throw new ApiError('Source changed or the 10-room pilot limit was reached.',409);return response({id,revision:1},201);
  }
  if(path==='/join'&&request.method==='POST'){
   const b=exact(await body(request,4096),['displayName']),name=collabName(b.displayName),key=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];if(!key)throw new ApiError('Use a complete invitation.',404);
   const hash=await collaborationHash(key),invite=await db.prepare(`SELECT i.* FROM collaboration_invites i JOIN collaboration_rooms r ON r.id=i.room_id WHERE i.token_hash=? AND i.revoked=0 AND i.expires_at>? AND i.claimed_by IS NULL AND r.archived=0`).bind(hash,time).first();if(!invite)throw new ApiError('Invitation expired, was revoked or has already been used.',404);
   const existing=await db.prepare('SELECT active FROM collaboration_members WHERE room_id=? AND user_id=?').bind(invite.room_id,owner).first();if(existing?.active)throw new ApiError('You already belong to this room. Open it from your rooms.',409);
   const memberId=crypto.randomUUID();const results=await db.batch([
    db.prepare(`INSERT INTO collaboration_members(room_id,user_id,member_id,name,role,invitation_id) SELECT i.room_id,?,?,?,?,i.id FROM collaboration_invites i JOIN collaboration_rooms r ON r.id=i.room_id WHERE i.id=? AND i.token_hash=? AND i.claimed_by IS NULL AND i.revoked=0 AND i.expires_at>? AND r.archived=0 AND (SELECT COUNT(*) FROM collaboration_members WHERE room_id=i.room_id AND active=1)<? ON CONFLICT(room_id,user_id) DO UPDATE SET member_id=excluded.member_id,name=excluded.name,role=excluded.role,invitation_id=excluded.invitation_id,active=1,epoch=collaboration_members.epoch+1 WHERE collaboration_members.active=0`).bind(owner,memberId,name,invite.role,invite.id,hash,time,COLLAB_LIMITS.members),
    db.prepare(`UPDATE collaboration_invites SET claimed_by=? WHERE id=? AND claimed_by IS NULL AND EXISTS(SELECT 1 FROM collaboration_members WHERE room_id=? AND user_id=? AND member_id=? AND invitation_id=? AND active=1)`).bind(owner,invite.id,invite.room_id,owner,memberId,invite.id)
   ]);if(!results[0].meta.changes||!results[1].meta.changes)throw new ApiError('The invitation changed or this room is full.',409);return response({id:invite.room_id});
  }
  const match=path.match(/^\/([a-zA-Z0-9_-]{1,160})(?:\/(history|operations|presence|invites|members|archive|delete))?$/);if(!match)return fail('Not found.',404);
  const [,id,action]=match,me=await db.prepare(memberQuery).bind(id,owner).first();if(!me)return fail('Room not found or access ended. Your local recovery copy is still available.',404);
  const requireOwner=()=>{if(me.role!=='owner')throw new ApiError('Only the room owner can change access.',403);};
  if(me.archived&&request.method==='POST'&&action!=='delete')return fail('This room is archived. Recover a local copy from its history.',410);
  if(request.method==='GET'){
   if(action==='invites'){requireOwner();const {results}=await db.prepare('SELECT id,role,expires_at AS expiresAt,revoked,CASE WHEN claimed_by IS NULL THEN 0 ELSE 1 END AS claimed FROM collaboration_invites WHERE room_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all();return response({invites:results});}
   if(action==='history'){const {results}=await db.prepare('SELECT revision,actor_name AS name,label,created_at AS createdAt FROM collaboration_commits WHERE room_id=? ORDER BY revision DESC LIMIT 20').bind(id).all();return response({versions:results});}
   if(action)return fail('Method not allowed.',405);
   const wanted=url.searchParams.get('revision');if(wanted!==null&&(!/^\d{1,9}$/.test(wanted)||Number(wanted)<1))throw new ApiError('Invalid revision.',400);
   const row=wanted?await db.prepare('SELECT revision,document FROM collaboration_commits WHERE room_id=? AND revision=?').bind(id,Number(wanted)).first():await db.prepare('SELECT revision,document FROM collaboration_commits WHERE room_id=? ORDER BY revision DESC LIMIT 1').bind(id).first();if(!row)throw new ApiError('Revision no longer retained. Use an exported recovery copy.',404);
   const {results:members}=await db.prepare('SELECT member_id,name,role,epoch,active FROM collaboration_members WHERE room_id=? AND active=1 LIMIT 8').bind(id).all();
   const {results:presence}=await db.prepare(`SELECT p.member_id AS memberId,m.name,p.floor_id AS floorId,p.selection_id AS selectionId,p.expires_at AS expiresAt FROM collaboration_presence p JOIN collaboration_members m ON m.room_id=p.room_id AND m.member_id=p.member_id WHERE p.room_id=? AND p.expires_at>? AND m.active=1 LIMIT 8`).bind(id,time).all();
   // Recheck access after asynchronous document reads. Nothing is cached publicly.
   const freshMe=await db.prepare(memberQuery).bind(id,owner).first();if(!freshMe)throw new ApiError('Access ended.',404);
   const after=url.searchParams.get('after'),unchanged=!wanted&&after!==null&&/^\d{1,9}$/.test(after)&&Number(after)===row.revision;
   return response({roomId:id,revision:row.revision,...(unchanged?{unchanged:true}:{plan:await decodeStoredPlan(row.document)}),me:memberView(freshMe),members:members.map(memberView),presence,archived:!!freshMe.archived});
  }
  if(action==='operations'){
   if(me.role==='viewer')throw new ApiError('Viewers cannot edit the shared layout.',403);
   const b=parseCollaborationBatch(await body(request)),hash=await collaborationHash(b);if(b.memberEpoch!==me.epoch)throw new ApiError('Your editing permission changed. Review access before retrying.',403);
   for(let attempt=0;attempt<3;attempt++){
    const previous=await db.prepare('SELECT revision,operation_hash,member_id FROM collaboration_commits WHERE room_id=? AND operation_id=?').bind(id,b.id).first();if(previous){if(previous.operation_hash!==hash||previous.member_id!==me.member_id)throw new ApiError('This retry ID already belongs to another edit.',409);return response({revision:previous.revision,idempotent:true});}
    const head=await db.prepare('SELECT revision,document FROM collaboration_commits WHERE room_id=? ORDER BY revision DESC LIMIT 1').bind(id).first();
    if(b.baseRevision<=head.revision-COLLAB_LIMITS.history)throw new ApiError('This edit is older than retained recovery history. Export it and review the latest room.',409);
    const plan=await applyCollaborationBatch(await decodeStoredPlan(head.document),head.revision,b);plan.updatedAt=new Date(time).toISOString();validateCollaborationPlan(plan);const document=await encodeStoredPlan(plan);
    // One atomic statement rechecks CAS, account membership, role, revocation epoch and room deletion/archival.
    const result=await db.prepare(`INSERT INTO collaboration_commits(room_id,revision,operation_id,operation_hash,member_id,actor_name,label,created_at,document) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT MAX(revision) FROM collaboration_commits WHERE room_id=?)=? AND EXISTS(SELECT 1 FROM collaboration_members m JOIN collaboration_rooms r ON r.id=m.room_id WHERE m.room_id=? AND m.user_id=? AND m.member_id=? AND m.epoch=? AND m.active=1 AND m.role IN('owner','editor') AND r.archived=0) ON CONFLICT DO NOTHING`).bind(id,head.revision+1,b.id,hash,me.member_id,me.name,b.label,time,document,id,head.revision,id,owner,me.member_id,b.memberEpoch).run();
    if(result.meta.changes){await db.prepare('DELETE FROM collaboration_commits WHERE room_id=? AND revision<=?').bind(id,head.revision+1-COLLAB_LIMITS.history).run();return response({revision:head.revision+1,rebased:b.baseRevision!==head.revision});}
    const access=await db.prepare(memberQuery).bind(id,owner).first();if(!access||access.archived||access.epoch!==b.memberEpoch||access.role==='viewer')throw new ApiError('Editing access ended or changed. Export your queued changes.',403);
   }throw new ApiError('The room is busy. Your local edit is retained; refresh before retrying.',409);
  }
  if(action==='presence'){
   const b=exact(await body(request,4096),['floorId','selectionId','leave']);for(const key of ['floorId','selectionId'])if(b[key]!==undefined&&!collabId(b[key]))throw new ApiError('Invalid presence.',400);
   if(b.leave===true){await db.prepare('DELETE FROM collaboration_presence WHERE room_id=? AND member_id=?').bind(id,me.member_id).run();return response({left:true});}
   const head=await db.prepare('SELECT document FROM collaboration_commits WHERE room_id=? ORDER BY revision DESC LIMIT 1').bind(id).first(),plan=await decodeStoredPlan(head.document);if(b.floorId&&!plan.floors.some(f=>f.id===b.floorId)||b.selectionId&&!plan.furniture.some(f=>f.id===b.selectionId&&(!b.floorId||f.floorId===b.floorId)))throw new ApiError('Presence target is no longer available.',400);
   await db.prepare(`INSERT INTO collaboration_presence(room_id,member_id,floor_id,selection_id,expires_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM collaboration_members m JOIN collaboration_rooms r ON r.id=m.room_id WHERE m.room_id=? AND m.user_id=? AND m.member_id=? AND m.active=1 AND m.epoch=? AND r.archived=0) ON CONFLICT(room_id,member_id) DO UPDATE SET floor_id=excluded.floor_id,selection_id=excluded.selection_id,expires_at=excluded.expires_at`).bind(id,me.member_id,b.floorId??null,b.selectionId??null,time+COLLAB_LIMITS.presenceMs,id,owner,me.member_id,me.epoch).run();return response({expiresAt:time+COLLAB_LIMITS.presenceMs});
  }
  if(action==='invites'){
   requireOwner();const b=exact(await body(request,4096),['role','revokeId']);
   if(b.revokeId){if(!collabId(b.revokeId))throw new ApiError('Invalid invitation.',400);await db.prepare('UPDATE collaboration_invites SET revoked=1 WHERE room_id=? AND id=? AND EXISTS(SELECT 1 FROM collaboration_rooms WHERE id=? AND owner_id=? AND archived=0)').bind(id,b.revokeId,id,owner).run();return response({revoked:true});}
   if(!['viewer','editor'].includes(b.role))throw new ApiError('Choose Viewer or Editor.',400);const key=token(),hash=await collaborationHash(key),inviteId=crypto.randomUUID();
   const result=await db.prepare(`INSERT INTO collaboration_invites(id,room_id,token_hash,role,created_at,expires_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM collaboration_rooms WHERE id=? AND owner_id=? AND archived=0) AND (SELECT COUNT(*) FROM collaboration_members WHERE room_id=? AND active=1)+(SELECT COUNT(*) FROM collaboration_invites WHERE room_id=? AND revoked=0 AND claimed_by IS NULL AND expires_at>?)<? AND (SELECT COUNT(*) FROM collaboration_invites WHERE room_id=?)<30`).bind(inviteId,id,hash,b.role,time,time+COLLAB_LIMITS.inviteMs,id,owner,id,id,time,COLLAB_LIMITS.members,id).run();
   if(!result.meta.changes)throw new ApiError('Invitation or member limit reached, or this room closed.',409);return response({id:inviteId,token:key,expiresAt:time+COLLAB_LIMITS.inviteMs},201);
  }
  if(action==='members'){
   requireOwner();const b=exact(await body(request,4096),['memberId','epoch','role','revoke']);if(!collabId(b.memberId)||!Number.isSafeInteger(b.epoch)||b.epoch<1||b.revoke!==true&&!['viewer','editor'].includes(b.role))throw new ApiError('Invalid membership change.',400);
   const results=await db.batch([
    db.prepare(`UPDATE collaboration_members SET role=CASE WHEN ?=1 THEN role ELSE ? END,active=CASE WHEN ?=1 THEN 0 ELSE 1 END,epoch=epoch+1 WHERE room_id=? AND member_id=? AND epoch=? AND role<>'owner' AND active=1 AND EXISTS(SELECT 1 FROM collaboration_rooms WHERE id=? AND owner_id=? AND archived=0)`).bind(b.revoke===true?1:0,b.role??'viewer',b.revoke===true?1:0,id,b.memberId,b.epoch,id,owner),
    db.prepare('DELETE FROM collaboration_presence WHERE room_id=? AND member_id=?').bind(id,b.memberId)
   ]);if(!results[0].meta.changes)throw new ApiError('Membership changed. Refresh before retrying.',409);return response({changed:true});
  }
  if(action==='archive'){requireOwner();const b=exact(await body(request,1024),['confirm']);if(b.confirm!==true)throw new ApiError('Confirm archiving this room.',400);const result=await db.prepare('UPDATE collaboration_rooms SET archived=1 WHERE id=? AND owner_id=? AND archived=0').bind(id,owner).run();await db.prepare('DELETE FROM collaboration_presence WHERE room_id=?').bind(id).run();return response({archived:!!result.meta.changes});}
  if(action==='delete'){requireOwner();const b=exact(await body(request,1024),['confirm','expectedRevision']);if(b.confirm!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1)throw new ApiError('Confirm permanent deletion of the archived room and retained history.',400);const result=await db.prepare('DELETE FROM collaboration_rooms WHERE id=? AND owner_id=? AND archived=1 AND (SELECT MAX(revision) FROM collaboration_commits WHERE room_id=?)=?').bind(id,owner,id,b.expectedRevision).run();if(!result.meta.changes)throw new ApiError('Archive the room first and refresh its latest version before deleting.',409);return response({deleted:true});}
  return fail('Not found.',404);
 }catch(error){if(error instanceof CollaborationConflict)return fail(error.message,409,{conflicts:error.conflicts});if(error instanceof ApiError)return fail(error.message,error.status);if(error instanceof RangeError)return fail(error.message,413);if(error instanceof Error&& !/SQL|database|constraint|D1|sqlite/i.test(error.message))return fail(error.message,400);return fail('Collaboration is temporarily unavailable. Your local changes are retained.',503);}
};}
export const collaborationApi=createCollaborationApi();
