import {ONLINE_MEDIA_LIMITS as L,parseOnlineMediaManifest,mediaDigest,manifestDigest,mediaId,mediaHash,mediaInteger} from '../src/onlineMedia.ts';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Cookie'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers}),fail=(error,status)=>json({error},status);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
async function bytes(request,max){const reader=request.body?.getReader();if(!reader)throw Error('Missing data.');let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Data exceeds the request limit.');}chunks.push(value);}const result=new Uint8Array(size);let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}return result;}
const body=async request=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,L.manifest+4096)));
const summary=r=>({id:r.id,projectId:r.project_id,name:r.name,state:r.state,stateVersion:r.state_version,baseRevision:r.base_revision,createdAt:r.created_at,expiresAt:r.expires_at,completedAt:r.completed_at,bytes:r.total_bytes,manifestHash:r.manifest_hash});
const upload=(db,owner,id)=>db.prepare('SELECT * FROM online_media_uploads WHERE owner_id=? AND id=?').bind(owner,id).first();
async function detail(db,owner,id){const row=await upload(db,owner,id);if(!row)return null;const project=await db.prepare('SELECT revision,head_id FROM online_media_projects WHERE owner_id=? AND project_id=?').bind(owner,row.project_id).first();if(!project)return null;const received=(await db.prepare('SELECT hash FROM online_media_chunks WHERE owner_id=? AND upload_id=? LIMIT 160').bind(owner,id).all()).results;return {snapshot:summary(row),manifest:parseOnlineMediaManifest(JSON.parse(row.manifest)),projectRevision:project.revision,headId:project.head_id,receivedHashes:received.map(r=>r.hash)};}
/** Platform-injected identity only. Never trusts an owner in a body, query, cookie or custom token. */
async function dispatch(request,env,clock){
 const url=new URL(request.url),path=url.pathname.slice('/api/online-media'.length),method=request.method,db=env.DB,owner=request.headers.get('oai-authenticated-user-id'),enabled=env.ONLINE_MEDIA_STORAGE==='d1-bounded-v1',now=clock();
 if(path==='/status'&&method==='GET'){
  let ready=false;try{if(db){await db.prepare('SELECT project_id FROM online_media_projects LIMIT 1').bind().first();ready=true;}}catch{}
  const used=ready&&owner?Number((await db.prepare('SELECT COALESCE(SUM(total_bytes),0) AS n FROM online_media_uploads WHERE owner_id=?').bind(owner).first()).n):0;
  return json({available:ready&&enabled,manageAvailable:ready,signedIn:!!owner,limits:L,...(owner?{accountKey:await mediaDigest(new TextEncoder().encode('nook-private-media-account-v1:'+owner)),usedBytes:used}:{}),...(!ready||!enabled?{reason:'Online media uploads are paused or not configured. Portable local backups still work; existing online snapshots can be managed when their database is available.'}:{})});
 }
 if(!owner)return fail('Sign in to manage your private online backups.',401);
 if(request.headers.get('x-nook-media-account')!==await mediaDigest(new TextEncoder().encode('nook-private-media-account-v1:'+owner)))return fail('The signed-in account changed. Check online storage again before continuing.',409);
 if(!db)return fail('Private online backup storage is unavailable.',503);
 if(['POST','PUT','DELETE'].includes(method)){
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return fail('Use private backups from this website.',403);
  const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();if(type!==(method==='PUT'?'application/octet-stream':'application/json'))return fail('Unsupported backup request type.',415);
  // Pausing uploads does not take away the owner's ability to recover or delete existing bytes.
  if(method!=='DELETE'&&!enabled)return fail('Online media uploads are not enabled. Use a portable local backup.',503);
 }
 if(path==='/projects'&&method==='GET'){
  const rows=(await db.prepare('SELECT * FROM online_media_projects WHERE owner_id=? ORDER BY project_id LIMIT 40').bind(owner).all()).results;
  const snapshots=(await db.prepare('SELECT * FROM online_media_uploads WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 80').bind(owner).all()).results;
  return json({projects:rows.map(r=>({projectId:r.project_id,revision:r.revision,headId:r.head_id,snapshots:snapshots.filter(s=>s.project_id===r.project_id).map(summary)}))});
 }
 if(path==='/uploads'&&method==='POST'){
  let input,manifest,digest;try{input=await body(request);if(!exact(input,['id','manifest','expectedRevision','uploadConfirmed'])||!mediaId(input.id)||input.uploadConfirmed!==true)throw Error();mediaInteger(input.expectedRevision);manifest=parseOnlineMediaManifest(input.manifest);digest=await manifestDigest(manifest);}catch{return fail('Review the exact backup, inclusion choices and quota before confirming upload.',400);}
  const same=await upload(db,owner,input.id);if(same)return same.manifest_hash===digest&&same.base_revision===input.expectedRevision?json(await detail(db,owner,input.id)):fail('This upload identity already belongs to different bytes or a different head revision.',409);
  const operation=crypto.randomUUID(),day=Math.floor(now/86400000),manifestText=JSON.stringify(manifest);
  const result=await db.batch([
   db.prepare('INSERT INTO online_media_projects(owner_id,project_id) SELECT ?,? WHERE (SELECT COUNT(*) FROM online_media_projects WHERE owner_id=?)<40 AND (SELECT COUNT(*) FROM online_media_projects)<2000 ON CONFLICT(owner_id,project_id) DO NOTHING').bind(owner,manifest.projectId,owner),
   db.prepare('INSERT INTO online_media_uploads(owner_id,id,project_id,name,total_bytes,manifest_hash,manifest,base_revision,created_at,expires_at,operation_id) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM online_media_projects WHERE owner_id=? AND project_id=? AND revision=?) AND (SELECT COALESCE(SUM(total_bytes),0) FROM online_media_uploads WHERE owner_id=? AND project_id=?)+?<=? AND (SELECT COUNT(*) FROM online_media_uploads WHERE owner_id=? AND project_id=?)<? AND (SELECT COALESCE(SUM(total_bytes),0) FROM online_media_uploads WHERE owner_id=?)+?<=? AND (SELECT COUNT(*) FROM online_media_uploads WHERE owner_id=?)<? AND (SELECT COALESCE(SUM(total_bytes),0) FROM online_media_uploads)+?<=? AND (SELECT COUNT(*) FROM online_media_uploads)<? AND NOT EXISTS(SELECT 1 FROM online_media_deleted WHERE owner_id=? AND id=?) AND (SELECT COUNT(*) FROM online_media_deleted WHERE owner_id=?)<1000 AND (SELECT COUNT(*) FROM online_media_deleted)<20000 AND COALESCE((SELECT starts FROM online_media_daily WHERE owner_id=? AND day=?),0)<10 AND COALESCE((SELECT reserved_bytes FROM online_media_daily WHERE owner_id=? AND day=?),0)+?<=104857600 ON CONFLICT(owner_id,id) DO NOTHING').bind(owner,input.id,manifest.projectId,manifest.projectName,manifest.totalBytes,digest,manifestText,input.expectedRevision,now,now+L.pendingDays*86400000,operation,owner,manifest.projectId,input.expectedRevision,owner,manifest.projectId,manifest.totalBytes,L.project,owner,manifest.projectId,L.uploadsPerProject,owner,manifest.totalBytes,L.account,owner,L.uploadsPerAccount,manifest.totalBytes,L.pilot,L.uploadsGlobal,owner,input.id,owner,owner,day,owner,day,manifest.totalBytes),
   db.prepare('INSERT INTO online_media_daily(owner_id,day,starts,reserved_bytes) SELECT ?,?,1,total_bytes FROM online_media_uploads WHERE owner_id=? AND id=? AND operation_id=? ON CONFLICT(owner_id,day) DO UPDATE SET starts=starts+1,reserved_bytes=reserved_bytes+excluded.reserved_bytes').bind(owner,day,owner,input.id,operation),
   db.prepare('DELETE FROM online_media_daily WHERE day<?').bind(day-7),
   db.prepare('DELETE FROM online_media_projects WHERE owner_id=? AND NOT EXISTS(SELECT 1 FROM online_media_uploads u WHERE u.owner_id=online_media_projects.owner_id AND u.project_id=online_media_projects.project_id)').bind(owner)
  ]);
  if(!result[1].meta.changes){const existing=await upload(db,owner,input.id);if(existing?.manifest_hash===digest&&existing.base_revision===input.expectedRevision)return json(await detail(db,owner,input.id));return fail('The current snapshot changed, a quota is full, or the daily upload limit was reached. Refresh storage before preparing another upload.',409);}
  return json(await detail(db,owner,input.id),201);
 }
 const match=/^\/uploads\/([A-Za-z0-9_-]{1,160})(?:\/(finalize|rebase)|\/chunks\/([a-f0-9]{64}))?$/.exec(path);if(!match)return fail('Not found.',404);const id=match[1],action=match[2],chunkHash=match[3],row=await upload(db,owner,id);
 if(!row)return fail('This private snapshot is unavailable.',404);
 if(!action&&!chunkHash&&method==='GET')return json(await detail(db,owner,id));
 if(chunkHash&&method==='GET'){
  const chunk=await db.prepare("SELECT c.data,c.bytes FROM online_media_chunks c JOIN online_media_uploads u ON u.owner_id=c.owner_id AND u.id=c.upload_id WHERE c.owner_id=? AND c.upload_id=? AND c.hash=? AND u.state='complete'").bind(owner,id,chunkHash).first();if(!chunk)return fail('This private backup chunk is unavailable.',404);
  const data=chunk.data instanceof ArrayBuffer?new Uint8Array(chunk.data):new Uint8Array(chunk.data);return new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(chunk.bytes),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
 }
 if(chunkHash&&method==='PUT'){
  const manifest=parseOnlineMediaManifest(JSON.parse(row.manifest)),wanted=manifest.chunks.find(c=>c.hash===chunkHash);if(!wanted)return fail('This chunk is not part of the reserved backup.',400);
  let data;try{data=await bytes(request,L.chunk);if(data.length!==wanted.bytes||await mediaDigest(data)!==chunkHash)throw Error();}catch{return fail('The chunk is damaged or has the wrong size. Retry from the original prepared backup.',400);}
  await db.prepare("INSERT INTO online_media_chunks(owner_id,upload_id,hash,bytes,data) SELECT owner_id,id,?,?,? FROM online_media_uploads WHERE owner_id=? AND id=? AND state='uploading' AND expires_at>? AND EXISTS(SELECT 1 FROM json_each(manifest,'$.chunks') WHERE json_extract(value,'$.hash')=? AND json_extract(value,'$.bytes')=?) ON CONFLICT(owner_id,upload_id,hash) DO NOTHING").bind(chunkHash,data.length,data.buffer,owner,id,now,chunkHash,data.length).run();
  const present=await db.prepare('SELECT bytes FROM online_media_chunks WHERE owner_id=? AND upload_id=? AND hash=?').bind(owner,id,chunkHash).first();return present?.bytes===data.length?json({received:true,hash:chunkHash}):fail('The upload expired, was removed or is no longer accepting chunks.',409);
 }
 if(action==='rebase'&&method==='POST'){
  let input;try{input=await body(request);if(!exact(input,['expectedRevision','expectedVersion','replaceConfirmed'])||input.replaceConfirmed!==true)throw Error();mediaInteger(input.expectedRevision);mediaInteger(input.expectedVersion,1);}catch{return fail('Confirm replacing the current snapshot after checking its latest revision.',400);}
  const changed=await db.prepare("UPDATE online_media_uploads SET base_revision=?,state_version=state_version+1 WHERE owner_id=? AND id=? AND state='uploading' AND state_version=? AND expires_at>? AND EXISTS(SELECT 1 FROM online_media_projects WHERE owner_id=online_media_uploads.owner_id AND project_id=online_media_uploads.project_id AND revision=?)").bind(input.expectedRevision,owner,id,input.expectedVersion,now,input.expectedRevision).run();return changed.meta.changes?json(await detail(db,owner,id)):fail('Storage changed again or the pending upload expired. Refresh before replacing.',409);
 }
 if(action==='finalize'&&method==='POST'){
  let input;try{input=await body(request);if(!exact(input,['manifestHash','expectedVersion'])||!mediaHash(input.manifestHash))throw Error();mediaInteger(input.expectedVersion,1);}catch{return fail('Use the prepared backup hash and current upload version.',400);}
  if(row.manifest_hash!==input.manifestHash)return fail('The prepared backup identity changed.',409);
  if(row.state==='complete')return json(await detail(db,owner,id));
  const complete="NOT EXISTS(SELECT 1 FROM json_each(u.manifest,'$.chunks') j WHERE NOT EXISTS(SELECT 1 FROM online_media_chunks c WHERE c.owner_id=u.owner_id AND c.upload_id=u.id AND c.hash=json_extract(j.value,'$.hash') AND c.bytes=json_extract(j.value,'$.bytes')))";
  const results=await db.batch([
   db.prepare("UPDATE online_media_projects SET head_id=?,revision=revision+1 WHERE owner_id=? AND project_id=? AND revision=? AND EXISTS(SELECT 1 FROM online_media_uploads u WHERE u.owner_id=online_media_projects.owner_id AND u.project_id=online_media_projects.project_id AND u.id=? AND u.state='uploading' AND u.state_version=? AND u.base_revision=online_media_projects.revision AND u.manifest_hash=? AND u.expires_at>? AND "+complete+')').bind(id,owner,row.project_id,row.base_revision,id,input.expectedVersion,input.manifestHash,now),
   db.prepare("UPDATE online_media_uploads SET state='complete',state_version=state_version+1,completed_at=?,committed_revision=? WHERE owner_id=? AND id=? AND state='uploading' AND state_version=? AND base_revision=? AND EXISTS(SELECT 1 FROM online_media_projects p WHERE p.owner_id=online_media_uploads.owner_id AND p.project_id=online_media_uploads.project_id AND p.head_id=online_media_uploads.id AND p.revision=?)").bind(now,row.base_revision+1,owner,id,input.expectedVersion,row.base_revision,row.base_revision+1)
  ]);
  const current=await detail(db,owner,id);return results[0].meta.changes&&results[1].meta.changes||current?.snapshot.state==='complete'?json(current):fail('Chunks are missing, this upload expired, or another snapshot completed first. Your previous complete snapshot is preserved.',409);
 }
 if(!action&&!chunkHash&&method==='DELETE'){
  let input;try{input=await body(request);if(!exact(input,['expectedVersion'])||mediaInteger(input.expectedVersion,1)!==row.state_version)throw Error();}catch{return fail('Refresh the upload before deleting its exact version.',409);}
  const result=await db.batch([
   db.prepare("UPDATE online_media_projects SET head_id=(SELECT id FROM online_media_uploads u WHERE u.owner_id=online_media_projects.owner_id AND u.project_id=online_media_projects.project_id AND u.id<>? AND u.state='complete' ORDER BY committed_revision DESC,id DESC LIMIT 1),revision=revision+1 WHERE owner_id=? AND project_id=? AND head_id=? AND EXISTS(SELECT 1 FROM online_media_uploads u WHERE u.owner_id=online_media_projects.owner_id AND u.id=? AND u.state_version=?)").bind(id,owner,row.project_id,id,id,input.expectedVersion),
   db.prepare('INSERT INTO online_media_deleted(owner_id,id,deleted_at) SELECT owner_id,id,? FROM online_media_uploads WHERE owner_id=? AND id=? AND state_version=? ON CONFLICT(owner_id,id) DO NOTHING').bind(now,owner,id,input.expectedVersion),
   db.prepare('DELETE FROM online_media_uploads WHERE owner_id=? AND id=? AND state_version=?').bind(owner,id,input.expectedVersion),
   db.prepare('DELETE FROM online_media_projects WHERE owner_id=? AND project_id=? AND NOT EXISTS(SELECT 1 FROM online_media_uploads u WHERE u.owner_id=online_media_projects.owner_id AND u.project_id=online_media_projects.project_id)').bind(owner,row.project_id)
  ]);return result[2].meta.changes?json({deleted:true}):fail('The upload changed before deletion. Refresh and check it again.',409);
 }
 return fail('Method not allowed.',405);
}
export async function onlineMediaApi(request,env,clock=Date.now){const path=new URL(request.url).pathname;if(path!=='/api/online-media'&&!path.startsWith('/api/online-media/'))return null;try{return await dispatch(request,env,clock);}catch{return fail('Private backup storage did not complete this operation. Existing complete snapshots are preserved. Refresh before retrying.',503);}}
