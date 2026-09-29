import {afterEach,describe,expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createSamplePlan} from '../src/domain';
import {cameraReviewMarker,parseReviewPublication,parseReviewSnapshot,parseReviewFeedback,REVIEW_LIMITS} from '../src/clientReview';
import {getClientReview,reviewLink,reviewLocation} from '../src/clientReviewApi';
// @ts-expect-error Worker JavaScript is bundled by the server build.
import {clientReviewApi} from '../worker/client-reviews.js';

const databases:DatabaseSync[]=[];
function database(){const sql=new DatabaseSync(':memory:');databases.push(sql);sql.exec('PRAGMA foreign_keys=ON');sql.exec(readFileSync('drizzle/0005_client_reviews.sql','utf8'));const db={sql,beforeRun:null as null|((query:string)=>void),prepare(query:string){return {bind(...args:(string|number|null)[]){const execute=()=>{db.beforeRun?.(query);return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};};return {_run:execute,async run(){return execute();},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};}};}};},async batch(statements:{_run:()=>unknown}[]){sql.exec('BEGIN');try{const result=statements.map(s=>s._run());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};return db;}
const now=1800000000000;
function input(){const plan=createSamplePlan(),floorId=plan.floors[0].id;return {projectId:plan.id,expiryHours:24,includeSelectedMedia:false,snapshot:{version:1,title:'Our home',plan,stops:[{id:'welcome',title:'Welcome',caption:'A proposed design',narration:'Look at the reading corner.',floorId,camera:{version:1,kind:'orbit',floorId,target:{x:1,y:1,z:1},alpha:1,beta:1,radius:5,mode:0,fov:.8},marker:{xMm:1000,zMm:1000,facingDeg:90}}]},media:[]};}
function request(path='',body?:unknown,owner='alice',token?:string,method=body===undefined?'GET':'POST',headers:Record<string,string>={}){return new Request('https://nest.test/api/client-reviews'+path,{method,headers:{origin:'https://nest.test','content-type':'application/json',...(owner?{'oai-authenticated-user-id':owner}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const respond=(extra={})=>({requestId:crypto.randomUUID(),revision:1,kind:'comment',authorName:'Alex',text:'Move the reading chair.',anchor:{kind:'stop',id:'welcome'},...extra});
async function create(env:{DB:ReturnType<typeof database>},body=input()){const response=await clientReviewApi(request('',body),env,()=>now);expect(response.status).toBe(201);return response.json();}
const png=(width=32,height=32)=>{const bytes=Buffer.alloc(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return 'data:image/png;base64,'+bytes.toString('base64');};
afterEach(()=>{for(const db of databases.splice(0))db.close();vi.unstubAllGlobals();});

describe('immutable client reviews with real SQLite access checks',()=>{
 it('strips private and unknown metadata, validates photo consent/size and binds camera/floor and room anchors',()=>{
  const body=input(),raw=body.snapshot.plan as any;raw.secret='private';raw.moodboards={version:1,boards:[{id:'private-board',name:'Private inspiration',createdAt:raw.createdAt,updatedAt:raw.updatedAt,pins:[{id:'private-photo',label:'Private photo',kind:'image',assetId:'sha256:'+'b'.repeat(64)}],palette:[],bindings:[]}]};raw.floors[0].referenceId='a'.repeat(64);raw.floors[0].privateNotes='never publish';raw.furniture=[{id:'chair',catalogId:'armchair',floorId:raw.floors[0].id,x:1000,z:1000,rotation:0,widthMm:800,depthMm:800,heightMm:900,variant:'cream',privateCost:999,personalItem:{version:1,itemId:'my-chair',name:'My chair',representation:'catalog-proxy',status:'keep',notes:'private note',photoAssetId:'sha256:'+'a'.repeat(64)}}];
  const clean=parseReviewSnapshot(body.snapshot);expect(JSON.stringify(clean)).not.toMatch(/private|referenceId|personalItem|moodboards/);expect(clean.plan.id).toBe('review-snapshot');expect(raw.floors[0].referenceId).toBe('a'.repeat(64));
  expect(()=>parseReviewSnapshot({...body.snapshot,stops:[{...body.snapshot.stops[0],floorId:'different'}]})).toThrow();
  const withPhoto={snapshot:{...body.snapshot,stops:[{...body.snapshot.stops[0],mediaId:'photo'}]},media:[{id:'photo',kind:'photo',dataUrl:png()}],includeSelectedMedia:true};expect(parseReviewPublication(withPhoto).media).toHaveLength(1);expect(()=>parseReviewPublication({...withPhoto,includeSelectedMedia:false})).toThrow();expect(()=>parseReviewPublication({...withPhoto,media:[{...withPhoto.media[0],dataUrl:png(20000)}]})).toThrow();expect(()=>parseReviewPublication({...withPhoto,media:[{...withPhoto.media[0],dataUrl:'https://private.invalid/image'}]})).toThrow();
  expect(()=>parseReviewFeedback(respond({anchor:{kind:'room',id:'unknown'}}),clean)).toThrow();expect(()=>parseReviewFeedback(respond({authorName:'<img onerror=alert(1)>'}),clean)).toThrow();
  const marker=cameraReviewMarker({...clean.stops[0].camera,target:{x:1,y:1,z:1},alpha:Math.PI/2,beta:Math.PI/2,radius:2});expect(marker.xMm).toBeCloseTo(1000);expect(marker.zMm).toBeCloseTo(3000);expect(marker.facingDeg).toBe(0);
 });
 it('requires owner authentication and origin for management; tokens expose only one sanitized snapshot',async()=>{
  const env={DB:database()};for(const [owner,headers,status] of [['',{},401],['alice',{origin:'https://evil.test'},403],['alice',{'sec-fetch-site':'cross-site'},403],['alice',{'content-type':'text/plain'},415]] as const)expect((await clientReviewApi(request('',input(),owner,undefined,'POST',headers),env,()=>now)).status).toBe(status);
  const a=await create(env),b=await create(env);const stored=env.DB.sql.prepare('SELECT * FROM client_reviews WHERE id=?').get(a.review.id)!;expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(stored)).not.toContain(a.token);
  for(const path of ['/'+a.review.id,'/'+a.review.id+'/access','/'+a.review.id+'/revisions'])expect((await clientReviewApi(request(path,path.endsWith('access')?{action:'revoke'}:path.endsWith('revisions')?{...input(),expectedRevision:1}:undefined,'bob'),env,()=>now)).status).toBe(404);
  expect((await clientReviewApi(request('/'+b.review.id+'/view',undefined,'',a.token),env,()=>now)).status).toBe(404);
  const response=await clientReviewApi(request('/'+a.review.id+'/view?revision=1',undefined,'',a.token),env,()=>now);expect(response.headers.get('cache-control')).toBe('no-store');expect(JSON.stringify(await response.json())).not.toMatch(/owner_id|projectId|email|token_hash/);
 });
 it('checks expiry, rotation and revocation for snapshots, media and feedback',async()=>{
  const env={DB:database()},body=input() as any;body.includeSelectedMedia=true;body.snapshot.stops[0].mediaId='photo';body.media=[{id:'photo',kind:'staged',dataUrl:png()}];const created=await create(env,body),path='/'+created.review.id;
  expect((await clientReviewApi(request(path+'/media/1/photo',undefined,'',created.token),env,()=>now)).status).toBe(200);
  const owned=await(await clientReviewApi(request(path),env,()=>now)).json();expect(owned.publication).toMatchObject({includeSelectedMedia:true,media:[{id:'photo',kind:'staged',dataUrl:png()}]});expect(owned.publication.snapshot.stops[0].mediaId).toBe('photo');
  for(const [suffix,payload] of [['/view',undefined],['/media/1/photo',undefined],['/feedback',respond()]] as const)expect((await clientReviewApi(request(path+suffix,payload,'',created.token),env,()=>now+24*3600000)).status).toBe(404);
  const rotated=await(await clientReviewApi(request(path+'/access',{action:'rotate',expiryHours:1}),env,()=>now)).json();expect(rotated.token).not.toBe(created.token);expect((await clientReviewApi(request(path+'/view',undefined,'',created.token),env,()=>now)).status).toBe(404);
  expect((await clientReviewApi(request(path+'/feedback',respond(),'bob',rotated.token),env,()=>now)).status).toBe(201);await clientReviewApi(request(path+'/access',{action:'revoke'}),env,()=>now);
  for(const [suffix,payload] of [['/view',undefined],['/media/1/photo',undefined],['/feedback',respond()]] as const)expect((await clientReviewApi(request(path+suffix,payload,'',rotated.token),env,()=>now)).status).toBe(404);
 });
 it('publishes one immutable revision under competing saves and rejects stale approvals without moving old feedback',async()=>{
  const env={DB:database()},body=input(),created=await create(env,body),path='/'+created.review.id;
  await clientReviewApi(request(path+'/feedback',respond(),' ',created.token),env,()=>now);
  const replies=await Promise.all(['First','Second'].map(title=>clientReviewApi(request(path+'/revisions',{...body,snapshot:{...body.snapshot,title},expectedRevision:1}),env,()=>now+1)));expect(replies.map((r:Response)=>r.status).sort()).toEqual([201,409]);
  const old=await(await clientReviewApi(request(path+'/view?revision=1',undefined,'',created.token),env,()=>now+2)).json();expect(old).toMatchObject({revision:1,currentRevision:2,snapshot:{title:'Our home'}});expect(old.feedback).toHaveLength(1);expect(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM client_review_revisions').get()?.n).toBe(2);
  expect((await clientReviewApi(request(path+'/feedback',respond({kind:'approval',text:'',anchor:{kind:'snapshot'}}),'',created.token),env,()=>now+2)).status).toBe(409);
 });
 it('enforces stale/revoked checks inside the write, idempotency and exact hourly boundary',async()=>{
  const env={DB:database()},created=await create(env),path='/'+created.review.id;
  env.DB.beforeRun=query=>{if(query.startsWith('INSERT INTO client_review_feedback')){env.DB.beforeRun=null;env.DB.sql.prepare('UPDATE client_reviews SET revoked_at=? WHERE id=?').run(now,created.review.id);}};
  expect((await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now)).status).toBe(404);expect(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM client_review_feedback').get()?.n).toBe(0);
  env.DB.sql.prepare('UPDATE client_reviews SET revoked_at=NULL WHERE id=?').run(created.review.id);
  env.DB.beforeRun=query=>{if(query.startsWith('INSERT INTO client_review_feedback')){env.DB.beforeRun=null;env.DB.sql.prepare('UPDATE client_reviews SET current_revision=2 WHERE id=?').run(created.review.id);}};
  expect((await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now)).status).toBe(409);env.DB.sql.prepare('UPDATE client_reviews SET current_revision=1 WHERE id=?').run(created.review.id);
  const response=respond();const pair=await Promise.all([clientReviewApi(request(path+'/feedback',response,'',created.token),env,()=>now),clientReviewApi(request(path+'/feedback',response,'',created.token),env,()=>now)]);expect(pair.map((r:Response)=>r.status).sort()).toEqual([200,201]);expect((await clientReviewApi(request(path+'/feedback',{...response,text:'Changed'},'',created.token),env,()=>now)).status).toBe(409);
  for(let i=1;i<REVIEW_LIMITS.hourlyFeedback-1;i++)expect((await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now)).status).toBe(201);
  const boundary=await Promise.all([clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now),clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now)]);expect(boundary.map((r:Response)=>r.status).sort()).toEqual([201,429]);
  expect((await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now+3599999)).status).toBe(429);expect((await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now+3600000)).status).toBe(201);
 });
 it('keeps moderation and deletion owner-only and rolls back a failed publication batch',async()=>{
  const env={DB:database()},body=input(),created=await create(env,body),path='/'+created.review.id;
  const posted=await(await clientReviewApi(request(path+'/feedback',respond(),'',created.token),env,()=>now)).json();expect((await clientReviewApi(request(path+'/feedback/'+posted.feedback.id,{resolved:true},'bob'),env,()=>now)).status).toBe(404);
  expect((await clientReviewApi(request(path+'/feedback/'+posted.feedback.id,{resolved:true}),env,()=>now)).status).toBe(200);
  env.DB.beforeRun=query=>{if(query.startsWith('INSERT INTO client_review_revisions'))throw new Error('simulated storage failure');};await expect(clientReviewApi(request(path+'/revisions',{...body,expectedRevision:1}),env,()=>now)).rejects.toThrow('simulated');env.DB.beforeRun=null;expect(env.DB.sql.prepare('SELECT current_revision FROM client_reviews WHERE id=?').get(created.review.id)?.current_revision).toBe(1);
  expect((await clientReviewApi(request(path,undefined,'bob',undefined,'DELETE'),env,()=>now)).status).toBe(404);expect((await clientReviewApi(request(path,undefined,'alice',undefined,'DELETE'),env,()=>now)).status).toBe(200);for(const table of ['client_reviews','client_review_revisions','client_review_feedback'])expect(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM '+table).get()?.n).toBe(0);
 });
 it('keeps capability keys out of request URLs and cookies and rejects incomplete fragment links',async()=>{
  const secret='a'.repeat(43),snapshot=parseReviewSnapshot(input().snapshot),fetcher=vi.fn(async()=>Response.json({snapshot,revision:1,currentRevision:1,expiresAt:now+3600000,media:[],feedback:[]}));vi.stubGlobal('fetch',fetcher);
  const url=new URL(reviewLink('https://nest.test','review-id',secret,1));expect(url.search).toBe('');expect(reviewLocation(url.hash)).toEqual({id:'review-id',token:secret,revision:1});expect(()=>reviewLocation('#review=review-id')).toThrow();await getClientReview('review-id',secret,1);
  const [path,options]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(path).not.toContain(secret);expect(options).toMatchObject({credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+secret}});
 });
});
