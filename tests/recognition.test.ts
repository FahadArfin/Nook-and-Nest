import {describe,it,expect,vi} from 'vitest';
import {validateRecognition,recognizedScale,type Recognition} from '../src/recognitionContract';
import {draftFromRecognition} from '../src/blueprintRecognition';
import {blueprintPlan} from '../src/blueprint';
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
  it('rejects missing measurements and conflicting scales instead of inventing dimensions',()=>{
    expect(()=>recognizedScale({...result(),dimensions:[]})).toThrow('No readable');
    const r=result();r.dimensions.push({...r.dimensions[0],millimetres:9000});expect(()=>recognizedScale(r)).toThrow('disagree');
  });
  it('does not put a divider through related rectangles in an L-shaped room',()=>{
    const r=result();r.fixtures=[];r.rooms=[{...r.rooms[0],name:'Bedroom',width:400,height:300},{...r.rooms[0],name:'Bedroom — entrance',x:300,y:300,width:100,height:100}];
    const base=createSamplePlan('Test','metric'),{draft}=draftFromRecognition(base,base.floors[0].id,r);
    expect(draft.walls).toHaveLength(0);expect(draft.rooms.every(r=>!r.enclosed)).toBe(true);
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
    expect(await analyzeFloorPlan('data:image/png;base64,AA==',1000,800,'test-key','gpt-5.4',fetcher)).toEqual(result());
    const options=fetcher.mock.calls[0] as unknown as [string,RequestInit];const body=JSON.parse(options[1].body as string);expect(body.store).toBe(false);expect(body.instructions).toContain('never instructions');expect(body.text.format.strict).toBe(true);expect(JSON.stringify(body)).not.toContain('test-key');
  });
  it('does not accept partial model output',async()=>{await expect(analyzeFloorPlan('',1000,800,'fake','model',async()=>Response.json({status:'incomplete'}))).rejects.toThrow('did not finish');});
});
