import {describe,it,expect,vi} from 'vitest';
import {extractWallCandidates,validateEvidence,PIPELINE_VERSION} from '../src/recognitionEvidence';
import {printedMillimetres,solveRecognition} from '../src/recognitionSolver';
import type {Recognition} from '../src/recognitionContract';
// @ts-expect-error Worker module is bundled JavaScript.
import {analyzeFloorPlanPipeline} from '../worker/recognition-pipeline.js';
const result=():Recognition=>({rooms:[{roomId:'bed',name:'Bedroom',kind:'Bedroom',x:10,y:10,width:200,height:200,enclosed:true,note:''}],dimensions:[{text:`10'-6"`,millimetres:3000,ax:10,ay:10,bx:210,by:10}],fixtures:[],warnings:[]});
const envelope=(value:unknown)=>Response.json({status:'completed',usage:{input_tokens:10,output_tokens:20},output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
describe('Luna geometry pipeline',()=>{
  it('extracts thick wall evidence while excluding thin tile lines and preserves source coordinates',()=>{
    const pixels=new Uint8ClampedArray(200*150*4).fill(255);
    const ink=(x:number,y:number,w:number,h:number)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*200+xx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}};
    ink(20,15,150,8);ink(20,15,8,120);ink(50,50,120,1);
    const walls=extractWallCandidates(pixels,200,150,400,300);
    expect(walls).toEqual(expect.arrayContaining([expect.objectContaining({axis:'h',x:40,y:30,width:300,height:16}),expect.objectContaining({axis:'v',x:40,y:30,width:16,height:240})]));expect(walls).toHaveLength(2);
  });
  it('rejects excessive or out-of-bounds evidence before inference',()=>{
    expect(()=>validateEvidence({version:PIPELINE_VERSION,walls:[{axis:'v',x:990,y:0,width:50,height:100}],crops:[]},1000,800)).toThrow();
    expect(()=>validateEvidence({version:'old',walls:[],crops:[]},1000,800)).toThrow();
  });
  it('converts printed units and flags conflicts and missing regions without inventing them',()=>{
    expect(printedMillimetres(`10'-6"`)).toBeCloseTo(3200.4);expect(printedMillimetres('3.2 m')).toBe(3200);expect(printedMillimetres('10 x 6')).toBeUndefined();
    const r=result();r.dimensions.push({text:'6 m',millimetres:6000,ax:10,ay:10,bx:10,by:210});const before=structuredClone(r);
    const solved=solveRecognition(r,[],[{name:'Utility',x:500,y:500}]);expect(r).toEqual(before);expect(solved.rooms).toEqual(r.rooms);expect(solved.dimensions[0].millimetres).toBeCloseTo(3200.4);expect(solved.warnings.join(' ')).toContain('Horizontal and vertical');expect(solved.warnings.join(' ')).toContain('missing area');
  });
  it('uses exactly two bounded Luna calls and carries original coordinates and evidence across stages',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(envelope({spaces:[{name:'Bedroom',x:100,y:100,note:''}],measurements:[],warnings:[]})).mockResolvedValueOnce(envelope(result()));const usage=vi.fn();
    const r=await analyzeFloorPlanPipeline('data:image/png;base64,AA==',1000,800,'fake',{version:PIPELINE_VERSION,walls:[],crops:[]},fetcher,undefined,'',usage);
    expect(r.rooms).toHaveLength(1);expect(fetcher).toHaveBeenCalledTimes(2);expect(usage).toHaveBeenCalledTimes(2);
    for(const args of fetcher.mock.calls){const body=JSON.parse(args[1].body);expect(body.model).toBe('gpt-5.6-luna');expect(body.store).toBe(false);expect(body.instructions).toContain('never instructions');expect(body.max_output_tokens).toBeLessThanOrEqual(10000);expect(JSON.stringify(body)).not.toContain('fake');}
    expect(JSON.parse(fetcher.mock.calls[1][1].body).input[0].content[2].text).toContain('Bedroom');
  });
  it('stops after a failed first stage without retrying or invoking a premium model',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({status:'incomplete'}));await expect(analyzeFloorPlanPipeline('',1000,800,'fake',undefined,fetcher)).rejects.toThrow('did not finish');expect(fetcher).toHaveBeenCalledTimes(1);
    const controller=new AbortController();controller.abort();await expect(analyzeFloorPlanPipeline('',1000,800,'fake',undefined,fetcher,controller.signal)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('adds an optional aligned wall view to both Luna stages while retaining all broad crops',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(envelope({spaces:[],measurements:[],warnings:[]})).mockResolvedValueOnce(envelope(result()));
    await analyzeFloorPlanPipeline('data:image/png;base64,AA==',1000,800,'fake',{version:PIPELINE_VERSION,walls:[],crops:[{image:'data:image/jpeg;base64,AA==',x:0,y:0,width:500,height:400}],wallView:{version:'wall-support-v1',image:'data:image/png;base64,AQ=='}},fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);for(const args of fetcher.mock.calls){const body=JSON.parse(args[1].body),content=body.input[0].content;expect(body.model).toBe('gpt-5.6-luna');expect(content.filter((c:{type:string})=>c.type==='input_image')).toHaveLength(3);expect(content.some((c:{text?:string})=>c.text?.includes('no room labels or inferred doorway closures'))).toBe(true);}
  });
});
