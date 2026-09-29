import {afterEach,describe,expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
// @ts-expect-error Worker JavaScript is bundled separately.
import {listingVideoApi,validateVideoRequest,videoImageDimensions,VIDEO_MODEL,VIDEO_LIMITS} from '../worker/listing-video.js';
// @ts-expect-error Worker JavaScript is bundled separately.
import worker from '../worker/projects.js';
import {listingVideoAvailability,submitListingVideo,getListingVideo,deleteListingVideo,validateVideoJob,type ListingVideoRequest} from '../src/listingVideo';

const databases:DatabaseSync[]=[];
function database(){
  const sql=new DatabaseSync(':memory:');databases.push(sql);sql.exec(readFileSync('drizzle/0004_listing_video.sql','utf8'));
  return {sql,prepare(query:string){const statement=sql.prepare(query);return {bind(...args:(string|number|null)[]){return {
    async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};},
  };}};}};
}
// Synthetic image headers exercise byte validation; no test sends media to a paid provider.
function png(width=640,height=480){const bytes=Buffer.alloc(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return 'data:image/png;base64,'+bytes.toString('base64');}
const input=(extra:Partial<ListingVideoRequest>={}):ListingVideoRequest=>({requestId:crypto.randomUUID(),images:[{dataUrl:png(),label:'Living room'}],prompt:'Use oak furniture and a gentle camera move.',duration:5,ratio:'16:9',resolution:'720p',consent:true,...extra});
function request(body?:unknown,path='',method=body===undefined?'GET':'POST',owner='alice',headers:Record<string,string>={}){
  return new Request('https://nest.test/api/listing-video'+path,{method,headers:{origin:'https://nest.test','content-type':'application/json',...(owner?{'oai-authenticated-user-id':owner}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const setup=()=>({DB:database(),ARK_API_KEY:'private-test-key'});
const providerId='cgt-test-task-12345678',videoUrl='https://ark-content-generation.tos-ap-southeast-1.volces.com/video.mp4?token=test';
const accepted=()=>Response.json({id:providerId});
const status=(value:string,extra={})=>Response.json({id:providerId,status:value,...(value==='succeeded'?{content:{video_url:videoUrl}}:{}),...extra});
afterEach(()=>{for(const db of databases.splice(0))db.close();vi.unstubAllGlobals();vi.useRealTimers();vi.restoreAllMocks();});

describe('listing video API and real SQLite ownership',()=>{
  it('reports unconfigured availability without hiding local tools and is wired into the hosted route',async()=>{
    const result=await worker.fetch(request(undefined,'','GET',''),{});expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({available:false,signedIn:false,model:VIDEO_MODEL,provider:'BytePlus'});
    expect((await listingVideoApi(request(input()),{})).status).toBe(503);
    expect((await worker.fetch(request(undefined,'/bad'),{})).status).toBe(404);
  });
  it('rejects anonymous, cross-origin and non-JSON writes before contacting the provider',async()=>{
    const env=setup(),fetcher=vi.fn();
    expect((await listingVideoApi(request(input(),'','POST',''),env,fetcher)).status).toBe(401);
    expect((await listingVideoApi(request(input(),'','POST','alice',{origin:'https://other.test'}),env,fetcher)).status).toBe(403);
    expect((await listingVideoApi(request(input(),'','POST','alice',{'sec-fetch-site':'cross-site'}),env,fetcher)).status).toBe(403);
    expect((await listingVideoApi(request(input(),'','POST','alice',{'content-type':'text/plain'}),env,fetcher)).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();expect(env.DB.sql.prepare('SELECT * FROM listing_video_jobs').all()).toEqual([]);
  });
  it('requires explicit consent and validates image bytes, bounds, prompts and settings before consuming quota',async()=>{
    const env=setup(),fetcher=vi.fn();
    for(const invalid of [input({consent:false as true}),input({images:[]}),input({images:[{label:'Remote',dataUrl:'http://127.0.0.1/private'}]}),input({images:[{label:'Bad',dataUrl:'data:image/png;base64,YQ=='}]}),input({images:[{label:'Small',dataUrl:png(299,480)}]}),input({images:[{label:'Wide',dataUrl:png(1800,300)}]}),input({images:[{label:'Large',dataUrl:png(6001,4000)}]}),input({duration:60 as 5}),input({prompt:'x'.repeat(2001)}),input({requestId:'../other-user'}),input({images:Array(10).fill({label:'room',dataUrl:png()})})]){
      expect((await listingVideoApi(request(invalid),env,fetcher)).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();expect(env.DB.sql.prepare('SELECT * FROM listing_video_usage').all()).toEqual([]);
  });
  it('blocks legacy prompt switches from overriding server duration and output limits',async()=>{
    const env=setup(),fetcher=vi.fn();
    expect((await listingVideoApi(request(input({prompt:'Property video --duration 120 --resolution 4k'})),env,fetcher)).status).toBe(400);
    expect((await listingVideoApi(request(input({images:[{label:'Living room --dur 120',dataUrl:png()}]})),env,fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preflights a new request without reserving a paid job or consuming quota',async()=>{
    const env=setup(),fetcher=vi.fn();
    expect(await(await listingVideoApi(request(input(),'?validate=1'),env,fetcher)).json()).toEqual({valid:true});
    expect((await listingVideoApi(request(input({images:[{label:'too small',dataUrl:png(200,200)}]}),'?validate=1'),env,fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();expect(env.DB.sql.prepare('SELECT * FROM listing_video_jobs').all()).toEqual([]);expect(env.DB.sql.prepare('SELECT * FROM listing_video_usage').all()).toEqual([]);
  });
  it('submits the precise documented Seedance request and stores no source photos, prompt or credentials',async()=>{
    const env=setup(),fetcher=vi.fn(async()=>accepted()),body=input();
    const response=await listingVideoApi(request(body),env,fetcher),job=await response.json();expect(response.status).toBe(202);expect(job.status).toBe('queued');
    expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const [url,options]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks');expect(options.redirect).toBe('error');expect(options.headers).toMatchObject({Authorization:'Bearer private-test-key'});
    const sent=JSON.parse(options.body as string);expect(sent).toMatchObject({model:VIDEO_MODEL,duration:5,ratio:'16:9',resolution:'720p',watermark:true,generate_audio:false});expect(sent.content[1]).toEqual({type:'image_url',image_url:{url:png()},role:'reference_image'});expect(sent.content[0].text).toContain('Preserve the visible room layout');expect(sent.content[0].text).toContain(body.prompt);
    const stored=JSON.stringify(env.DB.sql.prepare('SELECT * FROM listing_video_jobs').all());expect(stored).not.toContain(body.prompt);expect(stored).not.toContain(body.images[0].dataUrl);expect(stored).not.toContain(env.ARK_API_KEY);expect(JSON.stringify(job)).not.toContain(providerId);
  });
  it('uses atomic reservations to deduplicate concurrent paid submissions and rejects changed retry inputs',async()=>{
    const env=setup(),body=input(),fetcher=vi.fn(async()=>accepted());
    const replies=await Promise.all([listingVideoApi(request(body),env,fetcher),listingVideoApi(request(body),env,fetcher)]);
    const jobs=await Promise.all(replies.map((r:Response)=>r.json()));expect(jobs[0].id).toBe(jobs[1].id);expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await listingVideoApi(request({...body,prompt:'A different scene'}),env,fetcher)).status).toBe(409);
    const retried=await(await listingVideoApi(request(body),env,fetcher)).json();expect(retried.id).toBe(jobs[0].id);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('isolates status and cancellation by owner even with a known job ID',async()=>{
    const env=setup(),fetcher=vi.fn(async()=>accepted()),job=await(await listingVideoApi(request(input()),env,fetcher)).json();
    expect((await listingVideoApi(request(undefined,'/'+job.id,'GET','bob'),env,fetcher)).status).toBe(404);
    expect((await listingVideoApi(request({},'/'+job.id,'DELETE','bob'),env,fetcher)).status).toBe(404);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('caps new submissions for both an owner and the whole site, while allowing retries without another charge',async()=>{
    const env=setup(),body=input(),fetcher=vi.fn(async()=>accepted());
    for(let i=0;i<3;i++)expect((await listingVideoApi(request(i===0?body:input()),env,fetcher)).status).toBe(202);
    expect((await listingVideoApi(request(input()),env,fetcher)).status).toBe(429);expect((await listingVideoApi(request(body),env,fetcher)).status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(3);
    env.DB.sql.prepare("UPDATE listing_video_usage SET count=20 WHERE scope='site'").run();
    expect((await listingVideoApi(request(input(),'','POST','bob'),env,fetcher)).status).toBe(429);expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('recovers queued/running/completed jobs and throttles repeated polling across requests',async()=>{
    const env=setup(),fetcher=vi.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(status('running')).mockResolvedValueOnce(status('succeeded'));
    const job=await(await listingVideoApi(request(input()),env,fetcher)).json();
    const running=await(await listingVideoApi(request(undefined,'/'+job.id),env,fetcher)).json();expect(running.status).toBe('running');
    await listingVideoApi(request(undefined,'/'+job.id),env,fetcher);expect(fetcher).toHaveBeenCalledTimes(2);
    env.DB.sql.prepare('UPDATE listing_video_jobs SET next_poll_at=0').run();
    const complete=await(await listingVideoApi(request(undefined,'/'+job.id),env,fetcher)).json();expect(complete).toMatchObject({status:'succeeded',videoUrl});
    await listingVideoApi(request(undefined,'/'+job.id),env,fetcher);expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('never retries an ambiguous submission and retains an explicit uncertain state',async()=>{
    const env=setup(),body=input(),fetcher=vi.fn().mockRejectedValue(new Error('private connection data'));
    const job=await(await listingVideoApi(request(body),env,fetcher)).json();expect(job.status).toBe('submission_unknown');expect(job.error).not.toContain('private connection data');
    expect((await(await listingVideoApi(request(body),env,fetcher)).json()).id).toBe(job.id);expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await listingVideoApi(request({},'/'+job.id,'DELETE'),env,fetcher)).status).toBe(409);
  });
  it('does not advertise success for rejected or malformed provider submissions',async()=>{
    const env=setup(),fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'private details'},{status:400})).mockResolvedValueOnce(Response.json({id:'../../bad'})).mockResolvedValueOnce(Response.json({error:'private details'},{status:503}));
    const failed=await(await listingVideoApi(request(input()),env,fetcher)).json();expect(failed.status).toBe('failed');expect(failed.error).not.toContain('private details');
    expect((await(await listingVideoApi(request(input()),env,fetcher)).json()).status).toBe('submission_unknown');
    expect((await(await listingVideoApi(request(input()),env,fetcher)).json()).status).toBe('submission_unknown');
  });
  it('rejects unsafe output links and hides raw provider failures without discarding the pending job',async()=>{
    const env=setup(),fetcher=vi.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(status('succeeded',{content:{video_url:'http://127.0.0.1/private'}})).mockResolvedValueOnce(status('failed',{error:{message:'private provider details'}}));
    const job=await(await listingVideoApi(request(input()),env,fetcher)).json();expect((await listingVideoApi(request(undefined,'/'+job.id),env,fetcher)).status).toBe(503);
    env.DB.sql.prepare('UPDATE listing_video_jobs SET next_poll_at=0').run();
    const failed=await(await listingVideoApi(request(undefined,'/'+job.id),env,fetcher)).json();expect(failed.status).toBe('failed');expect(failed.error).not.toContain('private provider details');
  });
  it('cancels only queued jobs and removes completed records with the provider DELETE contract',async()=>{
    const env=setup(),fetcher=vi.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(status('queued')).mockResolvedValueOnce(new Response(null,{status:204}));
    const job=await(await listingVideoApi(request(input()),env,fetcher)).json();expect((await(await listingVideoApi(request({},'/'+job.id,'DELETE'),env,fetcher)).json()).status).toBe('cancelled');expect(fetcher.mock.calls[2][1].method).toBe('DELETE');
    fetcher.mockResolvedValueOnce(status('cancelled'));expect((await(await listingVideoApi(request({},'/'+job.id,'DELETE'),env,fetcher)).json()).status).toBe('deleted');
    fetcher.mockResolvedValueOnce(accepted()).mockResolvedValueOnce(status('succeeded')).mockResolvedValueOnce(new Response(null,{status:204}));
    const done=await(await listingVideoApi(request(input()),env,fetcher)).json();expect((await(await listingVideoApi(request({},'/'+done.id,'DELETE'),env,fetcher)).json()).status).toBe('deleted');
  });
  it('refuses running cancellation and respects a provider race from queued to running',async()=>{
    const env=setup(),fetcher=vi.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(status('running'));
    const job=await(await listingVideoApi(request(input()),env,fetcher)).json();expect((await listingVideoApi(request({},'/'+job.id,'DELETE'),env,fetcher)).status).toBe(409);expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(status('queued')).mockResolvedValueOnce(Response.json({error:'running now'},{status:409}));
    expect((await listingVideoApi(request({},'/'+job.id,'DELETE'),env,fetcher)).status).toBe(409);expect(env.DB.sql.prepare('SELECT status FROM listing_video_jobs').get()?.status).not.toBe('cancelled');
  });
  it('bounds the request stream even when Content-Length lies',async()=>{
    const env=setup(),fetcher=vi.fn(),huge=new Request('https://nest.test/api/listing-video',{method:'POST',headers:{origin:'https://nest.test','content-type':'application/json','content-length':'1','oai-authenticated-user-id':'alice'},body:' '.repeat(VIDEO_LIMITS.maxRequestBytes+1)});
    expect((await listingVideoApi(huge,env,fetcher)).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('reference image format validation',()=>{
  it('reads JPEG and WebP dimensions and accepts an image close to the byte ceiling',()=>{
    const jpeg=Uint8Array.from([255,216,255,192,0,17,8,1,224,2,128,3,1,0,0,2,0,0,3,0,0]);expect(videoImageDimensions(jpeg,'jpeg')).toEqual([640,480]);
    const webp=Buffer.alloc(30);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(639,24,3);webp.writeUIntLE(479,27,3);expect(videoImageDimensions(webp,'webp')).toEqual([640,480]);
    const bytes=Buffer.alloc(VIDEO_LIMITS.maxImageBytes);Buffer.from(png().split(',')[1],'base64').copy(bytes);expect(validateVideoRequest(input({images:[{label:'large',dataUrl:'data:image/png;base64,'+bytes.toString('base64')}]})).images).toHaveLength(1);
  });
});

describe('typed listing video client',()=>{
  const id='7ef95643-0820-4c69-acfe-072f152e2903';
  const job=()=>({id,requestId:id,status:'queued',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),retryAfterSeconds:10});
  it('uses same-origin credentials, validates responses, and has no automatic paid retry',async()=>{
    vi.stubGlobal('crypto',webcrypto);const fetcher=vi.fn().mockResolvedValueOnce(Response.json({available:false,signedIn:false,provider:'BytePlus',model:VIDEO_MODEL,limits:VIDEO_LIMITS})).mockResolvedValueOnce(Response.json(job())).mockResolvedValueOnce(Response.json(job())).mockResolvedValueOnce(Response.json({...job(),status:'cancelled'}));vi.stubGlobal('fetch',fetcher);
    expect((await listingVideoAvailability()).available).toBe(false);expect((await submitListingVideo(input())).status).toBe('queued');await getListingVideo(id);await deleteListingVideo(id);
    expect(fetcher.mock.calls.every((call:unknown[]) => (call[1] as RequestInit).credentials==='same-origin')).toBe(true);expect(fetcher.mock.calls[1][1].method).toBe('POST');expect(fetcher.mock.calls[3][1].method).toBe('DELETE');
    fetcher.mockRejectedValueOnce(new Error('offline'));await expect(submitListingVideo(input())).rejects.toThrow('interrupted');expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('rejects malformed jobs, unsafe links and unconsented calls without network access',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    expect(()=>validateVideoJob({...job(),status:'succeeded'})).toThrow('missing');expect(()=>validateVideoJob({...job(),videoUrl:'javascript:alert(1)'})).toThrow();expect(()=>validateVideoJob({...job(),id:'../'})).toThrow();
    await expect(submitListingVideo(input({consent:false as true}))).rejects.toThrow('Confirm');await expect(getListingVideo('../')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
  });
});
