import 'fake-indexeddb/auto';
import {deleteDB,openDB} from 'idb';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {discoverLocalVideo,downloadLocalVideo,getLocalVideo,loadLocalVideoProfile,localVideoEndpoint,parseLocalVideoJob,readLocalVideoRecord,reserveLocalVideo,saveLocalVideoProfile,submitLocalVideo,updateLocalVideoRecord,type LocalVideoProfile} from '../src/localVideo';

const profile:LocalVideoProfile={endpoint:'https://models.example/v1',model:'MiniMaxAI/MiniMax-H3',adapter:'h3'};
const image='data:image/png;base64,iVBORw0KGgo=';
const input={image,prompt:'Preserve this room and use a slow camera move.',seconds:5,consent:true};
const job={id:'video_123',status:'queued' as const,progress:0};
const fetcher=vi.fn<typeof fetch>();
const values=new Map<string,string>();
beforeEach(()=>{
  values.clear();fetcher.mockReset();vi.stubGlobal('fetch',fetcher);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}});
});
afterEach(async()=>{vi.unstubAllGlobals();vi.restoreAllMocks();await deleteDB('nook-local-video-jobs');});

describe('local video transport',()=>{
  it('normalizes API bases and rejects insecure non-loopback and credential-bearing addresses',()=>{
    for(const [url,expected] of [['https://models.example/','https://models.example/v1'],['https://models.example/proxy/v1/','https://models.example/proxy/v1'],['http://localhost:30010','http://localhost:30010/v1'],['http://[::1]:30010/v1','http://[::1]:30010/v1']])expect(localVideoEndpoint(url)).toBe(expected);
    for(const url of ['http://192.168.1.4:30010','http://localhost.evil.test','https://name:secret@models.example','https://models.example?token=secret','https://models.example/#token','file:///tmp/video','not an address'])expect(()=>localVideoEndpoint(url)).toThrow();
  });
  it('checks models without generating and omits cookies, referrers and redirects',async()=>{
    fetcher.mockResolvedValueOnce(Response.json({data:[{id:profile.model},{id:profile.model},{id:4},{id:'bad\nmodel'},{id:' '},{id:'model-b'}]}));
    expect(await discoverLocalVideo(profile,'memory-token')).toEqual([profile.model,'model-b']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,options]=fetcher.mock.calls[0];
    expect(url).toBe('https://models.example/v1/models');
    expect(options).toMatchObject({redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer memory-token');
    expect(options?.body).toBeUndefined();
  });
  it('sends the native H3 first-frame JSON, reviewed prompt and fixed single-output schedule',async()=>{
    fetcher.mockResolvedValueOnce(Response.json(job));
    expect(await submitLocalVideo(profile,'',input)).toEqual(job);
    const [url,options]=fetcher.mock.calls[0];expect(url).toBe(profile.endpoint+'/videos');
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(options?.body as string)).toEqual({model:profile.model,prompt:input.prompt,enhance_prompt:false,seconds:5,task:'fl2va',conditions:[{type:'image',uri:image,role:'keyframe',frame_index:0}],target:{short_edge:768,aspect_ratio:'auto',duration_seconds:5},num_outputs_per_prompt:1,num_inference_steps:50,flow_shift:12,audio_flow_shift:3});
  });
  it('uses multipart bytes for standard servers and leaves the boundary to the browser',async()=>{
    const webp='data:image/webp;base64,UklGRgAAAABXRUJQ';
    fetcher.mockResolvedValueOnce(Response.json(job));
    await submitLocalVideo({...profile,adapter:'standard'},'',{...input,image:webp,seconds:10});
    const options=fetcher.mock.calls[0][1],form=options?.body as FormData,reference=form.get('input_reference') as File;
    expect([...form.keys()]).toEqual(['model','prompt','seconds','input_reference']);
    expect(form.get('model')).toBe(profile.model);expect(form.get('seconds')).toBe('10');
    expect(reference.name).toBe('reference.webp');expect(reference.type).toBe('image/webp');
    expect(new Uint8Array(await reference.arrayBuffer())).toEqual(Uint8Array.from(atob(webp.split(',')[1]),c=>c.charCodeAt(0)));
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
  });
  it('rejects invalid consent, images, settings and path identifiers before networking',async()=>{
    for(const bad of [{...input,consent:false},{...input,image:'https://external.example/photo.jpg'},{...input,prompt:' '},{...input,prompt:'x'.repeat(2001)},{...input,seconds:60}])await expect(submitLocalVideo(profile,'',bad)).rejects.toThrow();
    await expect(submitLocalVideo({...profile,model:''},'',input)).rejects.toThrow();
    await expect(discoverLocalVideo(profile,'bad\ntoken')).rejects.toThrow('access token');
    for(const id of ['../other','https://external.example/video','abc?x=y']){
      await expect(getLocalVideo(profile,'',id)).rejects.toThrow();
      await expect(downloadLocalVideo(profile,'',id)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('never retries a failed or ambiguous submission',async()=>{
    fetcher.mockRejectedValueOnce(new TypeError('Network lost after acceptance'));
    await expect(submitLocalVideo(profile,'',input)).rejects.toThrow('Cannot reach');
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(Response.json({unexpected:'accepted without a job ID'}));
    await expect(submitLocalVideo(profile,'',input)).rejects.toThrow('unsupported video job');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects redirected responses without a second fetch',async()=>{
    const redirected=Response.json({data:[{id:profile.model}]});
    Object.defineProperties(redirected,{redirected:{value:true},url:{value:'https://external.example/models'}});
    fetcher.mockResolvedValueOnce(redirected);
    await expect(discoverLocalVideo(profile,'private-token')).rejects.toThrow('redirected');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed and oversized JSON and unsupported job states',async()=>{
    for(const body of [null,[],{id:'../path',status:'queued'},{id:'video_123',status:'succeeded'},{...job,progress:NaN},{...job,progress:'50'},{...job,progress:101}])expect(()=>parseLocalVideoJob(body)).toThrow('unsupported video job');
    for(const response of [new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),new Response('{',{headers:{'content-type':'application/json'}}),Response.json({data:[]}),Response.json({data:[{id:profile.model}]},{headers:{'content-length':'1048577'}})]){
      fetcher.mockResolvedValueOnce(response);await expect(discoverLocalVideo(profile,'')).rejects.toThrow();
    }
  });
  it('enforces the streamed byte limit even when Content-Length understates the response',async()=>{
    const cancel=vi.fn();
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(1024*1024+1))},cancel});
    fetcher.mockResolvedValueOnce(new Response(body,{headers:{'content-type':'application/json','content-length':'2'}}));
    await expect(discoverLocalVideo(profile,'')).rejects.toThrow('too large');
    expect(cancel).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('matches the requested job and ignores external result URLs',async()=>{
    fetcher.mockResolvedValueOnce(Response.json({...job,id:'another_job'}));
    await expect(getLocalVideo(profile,'',job.id)).rejects.toThrow('another job');
    fetcher.mockResolvedValueOnce(Response.json({...job,status:'completed',progress:100,url:'https://external.example/private.mp4'}));
    expect(await getLocalVideo(profile,'',job.id)).toEqual({...job,status:'completed',progress:100});
    expect(fetcher.mock.calls.every(([url])=>url===profile.endpoint+'/videos/'+job.id)).toBe(true);
  });
  it('downloads authenticated MP4 bytes only from the configured content endpoint',async()=>{
    const mp4=Uint8Array.from([0,0,0,24,102,116,121,112,105,115,111,109]);
    fetcher.mockResolvedValueOnce(new Response(mp4,{headers:{'content-type':'video/mp4'}}));
    const blob=await downloadLocalVideo(profile,'private-token',job.id);
    expect(blob.type).toBe('video/mp4');expect(new Uint8Array(await blob.arrayBuffer())).toEqual(mp4);
    expect(fetcher.mock.calls[0][0]).toBe(profile.endpoint+'/videos/'+job.id+'/content');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer private-token');
    for(const response of [new Response('<html>login</html>',{headers:{'content-type':'video/mp4'}}),new Response(mp4,{headers:{'content-type':'text/html'}}),new Response(mp4,{headers:{'content-type':'video/mp4','content-length':String(128*1024*1024+1)}})]){
      fetcher.mockResolvedValueOnce(response);await expect(downloadLocalVideo(profile,'',job.id)).rejects.toThrow();
    }
  });
});

describe('local video recovery storage',()=>{
  it('whitelists saved connection and job data so tokens and provider URLs are never persisted by this client',async()=>{
    const extra={...profile,token:'never-save',unknown:'discard'};saveLocalVideoProfile(extra);
    expect(loadLocalVideoProfile()).toEqual(profile);expect([...values.values()].join('')).not.toContain('never-save');
    const record=await reserveLocalVideo('home',extra);
    await updateLocalVideoRecord('home',{...record,job:{...job,url:'https://external.example/video'} as typeof job});
    expect(await readLocalVideoRecord('home')).toEqual({...record,profile,job});
    values.set('nook-local-video-profile',JSON.stringify({...profile,endpoint:'http://evil.test'}));
    expect(loadLocalVideoProfile()).toEqual({endpoint:'',model:'',adapter:'standard'});
  });
  it('allows exactly one concurrent reservation and preserves an ambiguous request across reopening',async()=>{
    const results=await Promise.allSettled([reserveLocalVideo('home',profile),reserveLocalVideo('home',profile)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    const record=await readLocalVideoRecord('home');expect(record?.requestId).toBeTruthy();expect(record?.job).toBeUndefined();
    fetcher.mockRejectedValueOnce(new Error('Interrupted'));
    await expect(submitLocalVideo(profile,'',input)).rejects.toThrow();
    expect(await readLocalVideoRecord('home')).toEqual(record);
    await expect(reserveLocalVideo('home',profile)).rejects.toThrow('already has');expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await reserveLocalVideo('other-home',profile)).toHaveProperty('requestId');
  });
  it('prevents stale tabs from replacing or deleting a newer request',async()=>{
    const old=await reserveLocalVideo('home',profile);await updateLocalVideoRecord('home',old,true);
    const current=await reserveLocalVideo('home',profile);
    await expect(updateLocalVideoRecord('home',{...old,job})).rejects.toThrow('different request');
    await expect(updateLocalVideoRecord('home',old,true)).rejects.toThrow('different request');
    expect(await readLocalVideoRecord('home')).toEqual(current);
  });
  it('protects the accepted server, model and job ID and cannot regress a terminal status',async()=>{
    const record=await reserveLocalVideo('home',profile);
    await updateLocalVideoRecord('home',{...record,job:{...job,status:'in_progress',progress:50}});
    await expect(updateLocalVideoRecord('home',{...record,profile:{...profile,endpoint:'https://other.example/v1'},job})).rejects.toThrow('different request');
    await expect(updateLocalVideoRecord('home',{...record,job:{...job,id:'other'}})).rejects.toThrow('another server job');
    await expect(updateLocalVideoRecord('home',record)).rejects.toThrow('another server job');
    await updateLocalVideoRecord('home',{...record,job:{...job,status:'in_progress',progress:20}});
    expect((await readLocalVideoRecord('home'))?.job?.progress).toBe(50);
    await updateLocalVideoRecord('home',{...record,job:{...job,status:'completed',progress:100}});
    await expect(updateLocalVideoRecord('home',{...record,job})).rejects.toThrow('newer job status');
    expect((await readLocalVideoRecord('home'))?.job?.status).toBe('completed');
  });
  it('keeps corrupt saved records locked and reports a failed transaction instead of pretending a reservation succeeded',async()=>{
    const connection=await openDB('nook-local-video-jobs',1,{upgrade(db){db.createObjectStore('jobs')}});
    await connection.put('jobs',null,'home');connection.close();
    await expect(readLocalVideoRecord('home')).rejects.toThrow('Unreadable');
    await expect(reserveLocalVideo('home',profile)).rejects.toThrow('already has');
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new DOMException('Full','QuotaExceededError')});
    await expect(reserveLocalVideo('new-home',profile)).rejects.toThrow('Full');
    expect(await readLocalVideoRecord('new-home')).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();
    const reserved=await reserveLocalVideo('new-home',profile);
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new DOMException('Full','QuotaExceededError')});
    await expect(updateLocalVideoRecord('new-home',{...reserved,job})).rejects.toThrow('Full');
    expect(await readLocalVideoRecord('new-home')).toEqual(reserved);
    await expect(reserveLocalVideo('new-home',profile)).rejects.toThrow('already has');
  });
});
