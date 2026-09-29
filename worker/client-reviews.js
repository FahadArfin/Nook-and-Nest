import {parseReviewPublication,parseReviewFeedback,REVIEW_LIMITS,reviewId} from '../src/clientReview.ts';
import {encodeStoredPlan,decodeStoredPlan} from './plan-storage.js';

const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const fail=(error,status)=>json({error},status);
const unavailable=()=>fail('This review link is unavailable, expired or revoked.',404);
const summary=r=>({id:r.id,projectId:r.project_id,revision:r.current_revision,createdAt:r.created_at,expiresAt:r.expires_at,revoked:r.revoked_at!==null});
const feedback=r=>({id:r.id,requestId:r.request_id,revision:r.revision,kind:r.kind,authorName:r.author_name,text:r.text,anchor:{kind:r.anchor_kind,...(r.anchor_id?{id:r.anchor_id}:{}),...(r.anchor_floor_id?{floorId:r.anchor_floor_id}:{})},createdAt:r.created_at,resolved:!!r.resolved});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
function token(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function accessHash(request){const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')??'');return match?hash(match[1]):null;}
function expiry(value,now){if(!Number.isSafeInteger(value)||value<1||value>720)throw new Error('Choose link expiry between 1 hour and 30 days.');return now+value*3600000;}
async function body(request){const reader=request.body?.getReader();if(!reader)throw new Error('Missing review.');let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>REVIEW_LIMITS.bodyBytes){await reader.cancel();throw new Error('Review exceeds its upload limit.');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
const active='token_hash = ? AND revoked_at IS NULL AND expires_at > ?';
const owning=async(db,id,owner)=>owner?db.prepare('SELECT * FROM client_reviews WHERE id = ? AND owner_id = ?').bind(id,owner).first():null;
const readable=async(db,id,key,now)=>key?db.prepare(`SELECT * FROM client_reviews WHERE id = ? AND ${active}`).bind(id,key,now).first():null;
const feedbackRows=async(db,id,revision)=>{const q=revision===undefined?'SELECT * FROM client_review_feedback WHERE review_id = ? ORDER BY created_at,id':'SELECT * FROM client_review_feedback WHERE review_id = ? AND revision = ? ORDER BY created_at,id';return (await db.prepare(q).bind(...(revision===undefined?[id]:[id,revision])).all()).results.map(feedback);};

/** Returns null for other APIs. The caller should catch infrastructure failures and return a generic 503. */
export async function clientReviewApi(request,env,clock=Date.now){
 const url=new URL(request.url),prefix='/api/client-reviews';if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return null;
 const path=url.pathname.slice(prefix.length),owner=request.headers.get('oai-authenticated-user-id'),db=env.DB;
 if(path==='/status'&&request.method==='GET')return json({available:!!db,signedIn:!!owner});
 if(!db)return fail('Online reviews are unavailable. Local planning and tour previews still work.',503);
 const match=/^\/([A-Za-z0-9_-]{1,160})(?:\/(view|revisions|access|feedback|media)(?:\/([A-Za-z0-9_-]{1,160}))?(?:\/([A-Za-z0-9_-]{1,160}))?)?$/.exec(path);
 if(path&&!match)return fail('Review route not found.',404);
 const id=match?.[1],action=match?.[2],detail=match?.[3],mediaId=match?.[4];
 const guest=action==='view'||action==='media'||action==='feedback'&&!detail;
 if(!guest&&!owner)return fail('Sign in to manage review links.',401);
 const now=clock();
 if(request.method==='POST'||request.method==='DELETE'){
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return fail('Use reviews from this website.',403);
  if(request.method==='POST'&&!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return fail('Use JSON review data.',415);
 }
 if(!path&&request.method==='GET'){
  const projectId=url.searchParams.get('projectId');if(!projectId||projectId.length>160)return fail('Choose a project.',400);
  return json({reviews:(await db.prepare('SELECT * FROM client_reviews WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 25').bind(owner,projectId).all()).results.map(summary)});
 }
 if(guest){
  const key=await accessHash(request),review=await readable(db,id,key,now);if(!review)return unavailable();
  if(action==='view'&&request.method==='GET'&&!detail){
   const revision=Number(url.searchParams.get('revision')??review.current_revision);if(!Number.isSafeInteger(revision)||revision<1)return fail('Choose a review revision.',400);
   // Join the current access predicate to every read so revocation between queries cannot expose data.
   const row=await db.prepare(`SELECT v.document,r.current_revision,r.expires_at FROM client_review_revisions v JOIN client_reviews r ON r.id=v.review_id WHERE r.id=? AND v.revision=? AND r.${active}`).bind(id,revision,key,now).first();if(!row)return unavailable();
   const media=(await db.prepare(`SELECT m.media_id AS id,m.kind FROM client_review_media m JOIN client_reviews r ON r.id=m.review_id WHERE r.id=? AND m.revision=? AND r.${active}`).bind(id,revision,key,clock()).all()).results;
   const comments=(await db.prepare(`SELECT f.* FROM client_review_feedback f JOIN client_reviews r ON r.id=f.review_id WHERE r.id=? AND f.revision=? AND r.${active} ORDER BY f.created_at,f.id`).bind(id,revision,key,clock()).all()).results.map(feedback);
   if(!await readable(db,id,key,clock()))return unavailable();
   return json({snapshot:await decodeStoredPlan(row.document),revision,currentRevision:row.current_revision,expiresAt:row.expires_at,media,feedback:comments});
  }
  if(action==='media'&&request.method==='GET'&&detail&&mediaId){
   const revision=Number(detail);if(!Number.isSafeInteger(revision)||revision<1)return unavailable();
   const row=await db.prepare(`SELECT m.data_url FROM client_review_media m JOIN client_reviews r ON r.id=m.review_id WHERE r.id=? AND m.revision=? AND m.media_id=? AND r.${active}`).bind(id,revision,mediaId,key,clock()).first();return row?json({dataUrl:row.data_url}):unavailable();
  }
  if(action==='feedback'&&request.method==='POST'&&!detail){
   let input;try{input=await body(request);}catch{return fail('Invalid review response.',400);}
   const revision=input?.revision;if(!Number.isSafeInteger(revision)||revision<1)return fail('Choose a review revision.',400);
   const saved=await db.prepare('SELECT document FROM client_review_revisions WHERE review_id=? AND revision=?').bind(id,revision).first();if(!saved)return fail('Review revision not found.',404);
   try{input=parseReviewFeedback(input,await decodeStoredPlan(saved.document));}catch{return fail('Use a name, a valid review marker and a response up to 2,000 characters.',400);}
   const fingerprint=await hash(JSON.stringify(input));
   const existing=await db.prepare('SELECT * FROM client_review_feedback WHERE review_id=? AND request_id=?').bind(id,input.requestId).first();
   if(existing){if(!await readable(db,id,key,clock()))return unavailable();return existing.fingerprint===fingerprint?json({feedback:feedback(existing)}):fail('This response ID was already used for a different response.',409);}
   const feedbackId=crypto.randomUUID(),writeNow=clock();
   const result=await db.prepare(`INSERT INTO client_review_feedback(id,review_id,revision,request_id,fingerprint,kind,author_name,text,anchor_kind,anchor_id,anchor_floor_id,created_at)
    SELECT ?,id,?,?,?,?,?,?,?,?,?,? FROM client_reviews WHERE id=? AND current_revision=? AND ${active}
    AND (SELECT COUNT(*) FROM client_review_feedback WHERE review_id=?) < ?
    AND (SELECT COUNT(*) FROM client_review_feedback WHERE review_id=? AND created_at>?) < ?
    ON CONFLICT(review_id,request_id) DO NOTHING`).bind(feedbackId,input.revision,input.requestId,fingerprint,input.kind,input.authorName,input.text,input.anchor.kind,input.anchor.id??null,input.anchor.floorId??null,writeNow,id,revision,key,writeNow,id,REVIEW_LIMITS.feedback,id,writeNow-3600000,REVIEW_LIMITS.hourlyFeedback).run();
   if(!result.meta.changes){const current=await readable(db,id,key,clock());if(!current)return unavailable();const duplicate=await db.prepare('SELECT * FROM client_review_feedback WHERE review_id=? AND request_id=?').bind(id,input.requestId).first();if(duplicate)return duplicate.fingerprint===fingerprint?json({feedback:feedback(duplicate)}):fail('This response ID was already used.',409);if(current.current_revision!==revision)return fail('A newer revision is ready. Review it before responding.',409);return fail('This review has reached its response limit. Try again later or contact its owner separately.',429);}
   return json({feedback:{...input,id:feedbackId,createdAt:writeNow,resolved:false}},201);
  }
  return fail('Method not allowed.',405);
 }
 if(id){
  const review=await owning(db,id,owner);if(!review)return fail('Review not found.',404);
  if(!action&&request.method==='GET'){
   const latest=await db.prepare('SELECT document FROM client_review_revisions WHERE review_id=? AND revision=?').bind(id,review.current_revision).first();
   const media=(await db.prepare('SELECT media_id AS id,kind,data_url AS dataUrl FROM client_review_media WHERE review_id=? AND revision=?').bind(id,review.current_revision).all()).results;
   return json({review:summary(review),revisions:(await db.prepare('SELECT revision,created_at AS createdAt FROM client_review_revisions WHERE review_id=? ORDER BY revision DESC').bind(id).all()).results,feedback:await feedbackRows(db,id),publication:{snapshot:await decodeStoredPlan(latest.document),media,includeSelectedMedia:media.length>0}});
  }
  if(!action&&request.method==='DELETE'){
   // Explicit delete frees storage; every statement is owner scoped even if cascading is unavailable.
   await db.batch(['client_review_feedback','client_review_media','client_review_revisions'].map(table=>db.prepare(`DELETE FROM ${table} WHERE review_id IN (SELECT id FROM client_reviews WHERE id=? AND owner_id=?)`).bind(id,owner)).concat(db.prepare('DELETE FROM client_reviews WHERE id=? AND owner_id=?').bind(id,owner)));return json({deleted:true});
  }
  if(action==='feedback'&&detail&&request.method==='POST'){
   let data;try{data=await body(request);if(Object.keys(data).length!==1||typeof data.resolved!=='boolean')throw Error();}catch{return fail('Choose resolved or open.',400);}
   const result=await db.prepare('UPDATE client_review_feedback SET resolved=? WHERE id=? AND review_id IN (SELECT id FROM client_reviews WHERE id=? AND owner_id=?)').bind(data.resolved?1:0,detail,id,owner).run();return result.meta.changes?json({resolved:data.resolved}):fail('Response not found.',404);
  }
  if(action==='access'&&!detail&&request.method==='POST'){
   let data,expiresAt;try{data=await body(request);if(!data||Object.keys(data).some(k=>!['action','expiryHours'].includes(k))||!['revoke','rotate'].includes(data.action))throw Error();expiresAt=data.action==='rotate'?expiry(data.expiryHours,now):review.expires_at;}catch{return fail('Choose revoke or a replacement link lasting 1 hour to 30 days.',400);}
   const secret=data.action==='rotate'?token():null;
   await db.prepare('UPDATE client_reviews SET token_hash=?,revoked_at=?,expires_at=? WHERE id=? AND owner_id=?').bind(secret?await hash(secret):null,secret?null:now,expiresAt,id,owner).run();return json({id,revision:review.current_revision,expiresAt,revoked:!secret,...(secret?{token:secret}:{})});
  }
 }
 if(request.method==='POST'&&(!path||action==='revisions'&&!detail)){
  let data,publication,expiresAt;try{data=await body(request);if(!data||Object.keys(data).some(k=>!['projectId','snapshot','media','includeSelectedMedia','expiryHours','expectedRevision'].includes(k)))throw Error();if(!id&&(!reviewId(data.projectId)||data.expectedRevision!==undefined))throw Error();if(id&&(!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1))throw Error();publication=parseReviewPublication({snapshot:data.snapshot,media:data.media,includeSelectedMedia:data.includeSelectedMedia});expiresAt=expiry(data.expiryHours??168,now);}catch{return fail('Check the tour, selected previews, consent and expiry before publishing.',400);}
  let document;try{document=await encodeStoredPlan(publication.snapshot);}catch{return fail('This review is too large for online storage. Use fewer objects or photos.',413);}
  const operation=crypto.randomUUID(),reviewIdValue=id??crypto.randomUUID(),revision=id?data.expectedRevision+1:1,secret=id?null:token();
  const first=id?db.prepare('UPDATE client_reviews SET current_revision=?,publication_id=? WHERE id=? AND owner_id=? AND current_revision=? AND current_revision<?').bind(revision,operation,id,owner,data.expectedRevision,REVIEW_LIMITS.revisions):db.prepare('INSERT INTO client_reviews(id,owner_id,project_id,current_revision,created_at,expires_at,token_hash,publication_id) SELECT ?,?,?,1,?,?,?,? WHERE (SELECT COUNT(*) FROM client_reviews WHERE owner_id=?)<?').bind(reviewIdValue,owner,data.projectId,now,expiresAt,await hash(secret),operation,owner,REVIEW_LIMITS.reviews);
  // D1 batch is a transaction. The operation marker ensures a failed CAS can never write a winner's revision.
  const guard='SELECT id, current_revision FROM client_reviews WHERE id=? AND owner_id=? AND current_revision=? AND publication_id=?';
  const statements=[first,db.prepare(`INSERT INTO client_review_revisions(review_id,revision,created_at,document) SELECT id,current_revision,?,? FROM (${guard})`).bind(now,document,reviewIdValue,owner,revision,operation),...publication.media.map(m=>db.prepare(`INSERT INTO client_review_media(review_id,revision,media_id,kind,data_url) SELECT id,current_revision,?,?,? FROM (${guard})`).bind(m.id,m.kind,m.dataUrl,reviewIdValue,owner,revision,operation))];
  const results=await db.batch(statements);if(!results[0].meta.changes)return fail(id?'A newer revision exists, or this review has reached 10 revisions. Refresh or create another review.':'You have reached 25 reviews. Delete an old review to create another.',409);
  const current=await owning(db,reviewIdValue,owner);return json({review:summary(current),...(secret?{token:secret}:{})},201);
 }
 return fail('Method not allowed.',405);
}
