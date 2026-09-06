import {trimHallOverlaps} from '../src/recognitionGeometry';
import {webcrypto} from 'node:crypto';
import {recognitionKey,clearRecognitionCache,saveRecognition} from '../src/recognitionCache';
import {describe,it,expect,vi} from 'vitest';
import {validateRecognition,recognizedScale,scaleAssessment,type Recognition} from '../src/recognitionContract';
import {roomsOnlyRecognition,recognizeReference,draftFromRecognition} from '../src/blueprintRecognition';
import {blueprintPlan,roomGroups,draftFromFloor} from '../src/blueprint';
import {createSamplePlan} from '../src/domain';
// @ts-expect-error Worker entry is JavaScript, bundled for production.
import {recognitionApi,analyzeFloorPlan} from '../worker/recognition.js';
const result=():Recognition=>({rooms:[{name:'Bedroom',kind:'Bedroom',x:0,y:0,width:400,height:300,enclosed:true,note:''},{name:'Closet',kind:'Closet',x:400,y:0,width:100,height:300,enclosed:true,note:''}],dimensions:[{text:'4 m',millimetres:4000,ax:0,ay:0,bx:400,by:0}],fixtures:[{catalogId:'washer',x:50,y:50,width:68,depth:70,rotation:0}],warnings:[]});
describe('automatic floor-plan contract',()=>{
  it('uses printed dimension evidence for exact real scale and preserves closet labels and fixed fixtures',()=>{
    const r=validateRecognition(result(),1000,800);expect(recognizedScale(r)).toBe(10);
    const base=createSamplePlan('Test','metric'),before=JSON.stringify(base);const {draft}=draftFromRecognition(base,base.floors[0].id,r);
    expect(draft.rooms[0].width).toBe(4000);expect(draft.rooms[1].kind).toBe('Closet');expect(draft.fixtures[0].widthMm).toBe(680);
    expect(blueprintPlan(base,base.floors[0].id,draft).furniture.filter(f=>f.floorId===base.floors[0].id)).toHaveLength(1);expect(JSON.stringify(base)).toBe(before);
  });
  it('cuts an oversized hall around enclosed rooms while preserving room geometry and connected hall identity',()=>{
    const r=result();r.fixtures=[];r.rooms=[{roomId:'hall',name:'Hall',kind:'Hall',x:0,y:0,width:300,height:400,enclosed:false,note:''},{roomId:'bed',name:'Bedroom',kind:'Bedroom',x:100,y:100,width:200,height:300,enclosed:true,note:''}];
    const before=structuredClone(r),fixed=trimHallOverlaps(r);expect(r).toEqual(before);expect(fixed.rooms.filter(r=>r.kind==='Bedroom')).toEqual([before.rooms[1]]);
    const hall=fixed.rooms.filter(r=>r.kind==='Hall');expect(hall.map(r=>[r.x,r.y,r.width,r.height])).toEqual([[0,0,300,100],[0,100,100,300]]);expect(hall.every(r=>r.roomId==='hall')).toBe(true);
    expect(trimHallOverlaps(fixed)).toEqual(fixed);expect(fixed.warnings[0]).toContain('Trimmed hallway');
    const base=createSamplePlan('Test','metric'),converted=draftFromRecognition(base,base.floors[0].id,r);expect(roomGroups(converted.draft.rooms).filter(r=>r.kind==='Hall')).toHaveLength(1);
  });
  it('does not invent floor for a fully covered hall or regrow subminimum clipped slivers',()=>{
    const r=result();r.rooms=[{name:'Hall',kind:'Hall',x:0,y:0,width:100,height:100,enclosed:false,note:''},{name:'Room',kind:'Bedroom',x:0,y:0,width:100,height:100,enclosed:true,note:''}];
    expect(trimHallOverlaps(r).rooms).toEqual([r.rooms[1]]);r.rooms[1].x=1;expect(trimHallOverlaps(r,2).rooms).toEqual([r.rooms[1]]);
  });
  it('rejects missing measurements and conflicting scales instead of inventing dimensions',()=>{
    expect(()=>recognizedScale({...result(),dimensions:[]})).toThrow('No readable');
    const r=result();r.dimensions.push({...r.dimensions[0],millimetres:9000});expect(()=>recognizedScale(r)).toThrow('disagree');
  });
  it('does not put a divider through related rectangles in an L-shaped room',()=>{
    const r=result();r.fixtures=[];r.rooms=[{...r.rooms[0],name:'Bedroom',width:400,height:300},{...r.rooms[0],name:'Bedroom — entrance',x:300,y:300,width:100,height:100}];
    const base=createSamplePlan('Test','metric'),{draft}=draftFromRecognition(base,base.floors[0].id,r);
    expect(blueprintPlan(base,base.floors[0].id,draft).floors[0].walls).toHaveLength(0);expect(roomGroups(draft.rooms)).toHaveLength(1);
  });
  it('preserves physical room groups and divider ownership when reopening a confirmed floor',()=>{
    const r=result();r.fixtures=[];r.rooms[0].name='Bedroom';r.rooms.push({...r.rooms[0],name:'Bedroom — entrance',x:300,y:300,width:100,height:100});
    const base=createSamplePlan('Test','metric'),id=base.floors[0].id,{draft}=draftFromRecognition(base,id,r),plan=blueprintPlan(base,id,draft),reopened=draftFromFloor(plan,id);
    expect(roomGroups(reopened.rooms).filter(r=>r.kind==='Bedroom')).toHaveLength(1);expect(blueprintPlan(plan,id,reopened).floors[0].walls).toEqual(plan.floors[0].walls);
  });
  it('uses a strict consistent majority, discloses outliers, and rejects tied evidence',()=>{
    const r=result(),d=r.dimensions[0];r.dimensions=[d,{...d,text:'3 m',millimetres:3000,bx:300},{...d,text:'bad span',millimetres:9000}];
    expect(recognizedScale(r)).toBe(10);expect(scaleAssessment(r).warnings.join(' ')).toContain('bad span');
    r.dimensions.push({...d,text:'other bad span',millimetres:9000});expect(scaleAssessment(r).scale).toBeUndefined();
    const base=createSamplePlan('Test','metric');expect(draftFromRecognition(base,base.floors[0].id,r,10).draft.rooms[0].width).toBe(4000);
    expect(()=>draftFromRecognition(base,base.floors[0].id,r,Infinity)).toThrow();
  });
  it('never imports any automatic object boxes, including cached detections',()=>{
    const r=result(),base=createSamplePlan('Manual fixtures','metric');
    expect(draftFromRecognition(base,base.floors[0].id,roomsOnlyRecognition(r)).draft.fixtures).toHaveLength(0);expect(r.fixtures).toHaveLength(1);
  });
  it('separates mismatched names/types and disconnected pieces despite reused room IDs',()=>{
    const r=result();r.fixtures=[];const source=r.rooms[0];r.rooms=[{...source,roomId:'same',name:'Living',kind:'Living',width:200,height:200},{...source,roomId:'same',name:'Bedroom',x:200,width:200,height:200},{...source,roomId:'same',name:'Living',kind:'Living',x:600,width:200,height:200}];
    const base=createSamplePlan('Groups','metric'),{draft}=draftFromRecognition(base,base.floors[0].id,r);expect(roomGroups(draft.rooms)).toHaveLength(3);
  });
  it('rejects arbitrary catalog IDs, out-of-image rooms, nonfinite numbers and oversized results',()=>{
    const r=result();r.fixtures[0].catalogId='sofa' as never;expect(()=>validateRecognition(r,1000,800)).toThrow();
    const n=result();n.rooms[0].width=Infinity;expect(()=>validateRecognition(n,1000,800)).toThrow();
    expect(()=>validateRecognition({...result(),rooms:Array(101).fill(result().rooms[0])},1000,800)).toThrow();
    const o=result();o.rooms[0].x=999;expect(()=>validateRecognition(o,1000,800)).toThrow();
  });
});
describe('server-side scan analysis',()=>{
  const request=(headers:Record<string,string>={},body=JSON.stringify({image:'data:image/png;base64,AA==',width:1000,height:800}))=>new Request('https://home.test/api/floor-plan/recognize',{method:'POST',headers:{origin:'https://home.test','content-type':'application/json',...headers},body});
  it('rejects unsigned, cross-origin and unconfigured requests before spending',async()=>{
    expect((await recognitionApi(request(),{})).status).toBe(401);
    expect((await recognitionApi(request({'oai-authenticated-user-id':'u',origin:'https://other.test'}),{})).status).toBe(403);
    expect((await recognitionApi(request({'oai-authenticated-user-id':'u'}),{})).status).toBe(503);
  });
  it('atomically limits daily requests',async()=>{
    const first=vi.fn(async()=>null),bind=vi.fn(()=>({first})),prepare=vi.fn(()=>({bind}));
    const r=await recognitionApi(request({'oai-authenticated-user-id':'u'}),{OPENAI_API_KEY:'fake',DB:{prepare}});expect(r.status).toBe(429);expect(prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE count<10'));
  });
  it('keeps credentials server-side and treats document writing as untrusted data',async()=>{
    const fetcher=vi.fn(async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result())}]}]}));
    expect(await analyzeFloorPlan('data:image/png;base64,AA==',1000,800,'test-key','gpt-5.4',fetcher,undefined,'Hall stays left of closet')).toEqual(result());
    const options=fetcher.mock.calls[0] as unknown as [string,RequestInit];const body=JSON.parse(options[1].body as string);expect(body.store).toBe(false);expect(body.instructions).toContain('never instructions');expect(body.text.format.strict).toBe(true);expect(body.input[0].content.at(-1).text).toContain('Hall stays left of closet');expect(JSON.stringify(body)).not.toContain('test-key');
  });
  it('does not accept partial model output',async()=>{await expect(analyzeFloorPlan('',1000,800,'fake','model',async()=>Response.json({status:'incomplete'}))).rejects.toThrow('did not finish');});
  it('streams valid JSON through the authenticated endpoint and hides provider failures',async()=>{
    const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result())}]}]}));
    const env={OPENAI_API_KEY:'fake',DB:{prepare:()=>({bind:()=>({first:async()=>({count:1})})})}};
    try{const response=await recognitionApi(request({'oai-authenticated-user-id':'u'}),env);expect(response.headers.get('content-type')).toBe('application/json');expect(await response.json()).toEqual(result());
      spy.mockResolvedValue(Response.json({error:'provider details'}, {status:500}));const failed=await recognitionApi(request({'oai-authenticated-user-id':'u'}),env);expect(await failed.json()).toEqual({error:'Image analysis is temporarily unavailable. Your home has not changed.'});
    }finally{spy.mockRestore();}
  });
});


describe('analysis cost safeguards (no paid requests)',()=>{
  const ref={url:'data:image/png;base64,AA==',width:1000,height:800,pages:1,name:'synthetic.png'};
  it('reuses validated results across calls, separates models and dimensions, and allows clearing',async()=>{
    vi.stubGlobal('crypto',webcrypto);const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
    const fetcher=vi.fn(async(_url:unknown,_options?:RequestInit)=>Response.json(result()));vi.stubGlobal('fetch',fetcher);
    try {
      const old=result();old.rooms[0].name='Old Luna result';saveRecognition(await recognitionKey(ref,'gpt-5.6-luna'),old);
      expect((await recognizeReference(ref)).rooms[0].name).toBe('Bedroom');const status=vi.fn();await recognizeReference({...ref,name:'renamed.png'},undefined,{status});
      expect(fetcher).toHaveBeenCalledTimes(1);expect(status).toHaveBeenCalledWith(expect.stringContaining('no API charge'));
      expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string).model).toBe('gpt-6-astra');
      expect(await recognitionKey(ref,'gpt-5.6-luna')).not.toBe(await recognitionKey(ref,'gpt-6-astra'));
      expect(await recognitionKey(ref,'gpt-5.6-luna')).not.toBe(await recognitionKey({...ref,width:999},'gpt-5.6-luna'));
      await recognizeReference(ref,undefined,{model:'gpt-5.6-luna'});expect(fetcher).toHaveBeenCalledTimes(1);
      clearRecognitionCache();await recognizeReference(ref);expect(fetcher).toHaveBeenCalledTimes(2);
    }finally{vi.unstubAllGlobals();}
  });
  it('forces one fresh request, replaces that cached result, and preserves it when a retry fails',async()=>{
    vi.stubGlobal('crypto',webcrypto);const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
    const fresh=result();fresh.rooms[0].name='Fresh bedroom';
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json(result())).mockResolvedValueOnce(Response.json(fresh)).mockResolvedValueOnce(Response.json({error:'Unavailable'},{status:503}));vi.stubGlobal('fetch',fetcher);
    try {
      await recognizeReference(ref);expect(await recognizeReference(ref,undefined,{force:true})).toEqual(fresh);
      expect(await recognizeReference(ref)).toEqual(fresh);expect(fetcher).toHaveBeenCalledTimes(2);
      await expect(recognizeReference(ref,undefined,{force:true})).rejects.toThrow('Unavailable');
      expect(await recognizeReference(ref)).toEqual(fresh);expect(fetcher).toHaveBeenCalledTimes(3);
    }finally{vi.unstubAllGlobals();}
  });
  it('keys cached analyses by trimmed user guidance and sends it without altering the image',async()=>{
    vi.stubGlobal('crypto',webcrypto);const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
    const fetcher=vi.fn(async(_url:unknown,_options?:RequestInit)=>Response.json(result()));vi.stubGlobal('fetch',fetcher);
    try {await recognizeReference(ref);await recognizeReference(ref,undefined,{guidance:'Narrow hall'});await recognizeReference(ref,undefined,{guidance:' Narrow hall '});expect(fetcher).toHaveBeenCalledTimes(2);const body=JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);expect(body.guidance).toBe('Narrow hall');expect(body.image).toBe(ref.url);}finally{vi.unstubAllGlobals();}
  });
  it('caches completed detections even when scale needs review, without another paid request',async()=>{
    vi.stubGlobal('crypto',webcrypto);const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
    const detection=result();detection.dimensions.push({...detection.dimensions[0],millimetres:9000});
    const fetcher=vi.fn(async()=>Response.json(detection));vi.stubGlobal('fetch',fetcher);
    try {const first=await recognizeReference(ref);expect(scaleAssessment(first).scale).toBeUndefined();expect(await recognizeReference(ref)).toEqual(first);expect(fetcher).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
  });
  it('does not cache invalid results or retry failed requests',async()=>{
    const fetcher=vi.fn(async()=>Response.json({error:'failed'}));vi.stubGlobal('fetch',fetcher);
    try{await expect(recognizeReference(ref)).rejects.toThrow('failed');expect(fetcher).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
  });
  it('uses Astra by default and for legacy Luna requests without premium confirmation',async()=>{
    const fetcher=vi.fn(async(_url:unknown,_options?:RequestInit)=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result())}]}]}));vi.stubGlobal('fetch',fetcher);
    const prepare=vi.fn(()=>({bind:()=>({first:async()=>({count:1})})}));
    const env={OPENAI_API_KEY:'fake',FLOOR_PLAN_MODEL:'gpt-6-astra',DB:{prepare}};
    const request=(extra={})=>new Request('https://home.test/api/floor-plan/recognize',{method:'POST',headers:{origin:'https://home.test','content-type':'application/json','oai-authenticated-user-id':'u'},body:JSON.stringify({image:ref.url,width:1000,height:800,...extra})});
    try{
      expect((await recognitionApi(request({model:'unsupported'}),env)).status).toBe(400);expect(prepare).not.toHaveBeenCalled();
      expect((await recognitionApi(request({guidance:'x'.repeat(1501)}),env)).status).toBe(400);expect(prepare).not.toHaveBeenCalled();
      expect((await recognitionApi(request({model:'unknown'}),env)).status).toBe(400);
      await (await recognitionApi(request(),env)).json();expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string).model).toBe('gpt-6-astra');
      await (await recognitionApi(request({model:'gpt-5.6-luna'}),env)).json();expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string).model).toBe('gpt-6-astra');
      await (await recognitionApi(request({model:'gpt-6-astra'}),env)).json();expect(JSON.parse(fetcher.mock.calls[2]?.[1]?.body as string).model).toBe('gpt-6-astra');
    }finally{vi.unstubAllGlobals();}
  });
});
