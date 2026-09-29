// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {BlueprintStudio} from '../src/BlueprintStudio';
import {recognizeReference} from '../src/blueprintRecognition';
import {createSamplePlan} from '../src/domain';
import {blueprintPlan} from '../src/blueprint';
import {usePlanner} from '../src/store';
import {CAPTURE_ATTEMPT_KEY,captureAttemptReport,loadCaptureAttempts} from '../src/captureAttempt';
import {captureBenchmarkReport,loadCaptureBenchmarks} from '../src/captureBenchmark';

const detection={rooms:[{name:'Timed bedroom',kind:'Bedroom' as const,x:0,y:0,width:500,height:400,enclosed:true,note:'Check the edge.'}],walls:[],dimensions:[{text:'5 m',millimetres:5000,ax:0,ay:0,bx:500,by:0}],fixtures:[],warnings:[]};
vi.mock('../src/blueprintImport',()=>({renderReference:vi.fn(async(file:File,page=1,rotation=0)=>({url:`data:image/png;base64,${btoa(String(page)+':'+rotation)}`,width:1000,height:800,pages:2,name:file.name}))}));
vi.mock('../src/blueprintRecognition',async original=>({...await original<typeof import('../src/blueprintRecognition')>(),recognizeReference:vi.fn()}));
beforeEach(()=>{
  localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};vi.spyOn(window,'confirm').mockReturnValue(true);vi.mocked(recognizeReference).mockReset().mockResolvedValue(structuredClone(detection));
  const p=createSamplePlan('Timing integration','metric');p.floors=p.floors.slice(0,1);p.furniture=[];usePlanner.getState().replacePlan(blueprintPlan(p,p.floors[0].id,{rooms:[{id:'old',name:'Original room',kind:'Bedroom',x:0,z:0,width:3000,depth:3000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]}));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function mount(timing=false){const view=render(<BlueprintStudio onClose={()=>{}}/>);await waitFor(()=>expect(screen.queryByText(/Restoring draft/)).toBeNull());fireEvent.click(screen.getByRole('button',{name:'Import'}));fireEvent.change(screen.getByLabelText('Import method'),{target:{value:'luna'}});if(timing){fireEvent.click(screen.getByText('Local benchmark timing (optional)'));fireEvent.click(screen.getByLabelText(/choose to record upcoming attempts locally/));}return view;}
function upload(){const file=new File(['source'],'Private source.pdf',{type:'application/pdf'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('source').buffer});fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[file]}});}
async function review(){await screen.findByRole('button',{name:/^Timed bedroom/});fireEvent.click(screen.getByText('Check capture & local benchmark'));return within(screen.getByRole('region',{name:'Measured capture review'}));}
function complete(r:ReturnType<typeof within>){for(const [label,value]of [['Start X (px)','0'],['Start Y (px)','0'],['End X (px)','500'],['End Y (px)','0'],['Verified length (mm)','5000']])fireEvent.change(r.getByLabelText(label),{target:{value}});fireEvent.click(r.getByRole('button',{name:'Confirm measured span'}));fireEvent.click(r.getByRole('button',{name:'Keep original'}));fireEvent.change(r.getByLabelText('Detected item'),{target:{value:'dimension:0'}});fireEvent.click(r.getByRole('button',{name:'Keep original'}));for(const text of ['I checked the outer boundary, wall joins and room sizes.','I checked doors/windows against the reference, including missing openings.','I checked room labels and read the analysis notes.'])fireEvent.click(r.getByLabelText(text));fireEvent.click(r.getByRole('button',{name:'Preview reviewed layout'}));}

it('leaves timing absent without opt-in while normal review stays available',async()=>{
  await mount();upload();const r=await review();complete(r);expect(loadCaptureAttempts(localStorage)).toEqual([]);expect(r.queryByText('Optional comparison with manual tracing')).toBeNull();expect(r.getByText(/No source-matched timing/)).toBeTruthy();
});
it('records source-bound analysis plus review timing and enables the manual baseline without changing the floor',async()=>{
  let tick=100,wall=10000;vi.spyOn(performance,'now').mockImplementation(()=>tick);vi.spyOn(Date,'now').mockImplementation(()=>wall);
  vi.mocked(recognizeReference).mockImplementationOnce(async()=>{tick=2100;wall=12000;return structuredClone(detection);});
  const original=usePlanner.getState().plan;await mount(true);upload();const r=await review();wall=18000;complete(r);
  expect(usePlanner.getState().plan).toBe(original);expect(usePlanner.getState().past).toHaveLength(0);expect(r.getByText('Optional comparison with manual tracing')).toBeTruthy();
  const panel=within(r.getByText('Optional local accuracy benchmark').closest('details')!);fireEvent.click(panel.getByText('Optional local accuracy benchmark'));fireEvent.change(panel.getByLabelText('Case label'),{target:{value:'Synthetic rectangle'}});
  fireEvent.change(panel.getByLabelText('Verified width (mm)'),{target:{value:'5000'}});fireEvent.change(panel.getByLabelText('Verified depth (mm)'),{target:{value:'4000'}});fireEvent.click(panel.getByRole('button',{name:'Add measured reference'}));
  fireEvent.click(panel.getByLabelText(/choose to store this geometry/));fireEvent.change(panel.getByLabelText('Recorded manual tracing time (seconds)'),{target:{value:'12'}});fireEvent.click(panel.getByLabelText(/Both runs use/));fireEvent.click(panel.getByRole('button',{name:'Compare and save locally'}));
  const cases=loadCaptureBenchmarks(localStorage),attempts=loadCaptureAttempts(localStorage);expect(cases[0].attempt?.id).toBe(attempts[0].id);expect(cases[0].attempt?.source).toEqual(cases[0].review.source);expect(captureBenchmarkReport(cases)).toMatchObject({pairedTimingCases:1,medianTimeToVerifiedMs:8000,medianPairedTimeSavedMs:4000});
  expect(JSON.stringify(cases)).not.toContain('Private source.pdf');expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('counts failed, cancelled and late completion correctly without touching the floor',async()=>{
  const original=usePlanner.getState().plan;await mount(true);vi.mocked(recognizeReference).mockRejectedValueOnce(Error('Synthetic provider failure'));upload();await screen.findByText('Synthetic provider failure');
  let resolve!:(value:typeof detection)=>void;vi.mocked(recognizeReference).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));upload();await waitFor(()=>expect(loadCaptureAttempts(localStorage)).toHaveLength(2));
  fireEvent.click(screen.getByRole('button',{name:'Cancel analysis'}));await act(async()=>resolve(structuredClone(detection)));
  expect(captureAttemptReport(loadCaptureAttempts(localStorage))).toMatchObject({total:2,failed:1,cancelled:1,proposals:0,failureDenominator:1,failureRate:1});expect(usePlanner.getState().plan).toBe(original);expect(screen.queryByRole('button',{name:/^Timed bedroom/})).toBeNull();expect(JSON.stringify(loadCaptureAttempts(localStorage))).not.toContain('Synthetic provider failure');
});
it('does not attach old timing to a saved and restored review',async()=>{
  const first=await mount(true);upload();const r=await review();complete(r);fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await waitFor(()=>expect(usePlanner.getState().plan.studioDrafts?.[usePlanner.getState().activeFloorId].draft.captureReview?.completedAtMs).toBeDefined());first.unmount();
  render(<BlueprintStudio onClose={()=>{}}/>);await screen.findByRole('region',{name:'Measured capture review'});const restored=within(screen.getByRole('region',{name:'Measured capture review'}));expect(restored.queryByText('Optional comparison with manual tracing')).toBeNull();expect(restored.getByText(/No source-matched timing/)).toBeTruthy();expect(loadCaptureAttempts(localStorage)).toHaveLength(1);expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('drops timing after manual geometry changes and an explicit review restart',async()=>{
  await mount(true);upload();let r=await review();complete(r);fireEvent.click(screen.getByRole('button',{name:/^Timed bedroom/}));fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'My edit'}});expect(r.getByText(/reference or drawing changed/)).toBeTruthy();fireEvent.click(r.getByRole('button',{name:'Start fresh review'}));
  r=within(screen.getByRole('region',{name:'Measured capture review'}));fireEvent.change(r.getByLabelText('Detected item'),{target:{value:'room:0'}});complete(r);expect(r.queryByText('Optional comparison with manual tracing')).toBeNull();expect(r.getByText(/No source-matched timing/)).toBeTruthy();expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('keeps scale-correction attempts pending until an editable proposal exists',async()=>{
  let tick=0;vi.spyOn(performance,'now').mockImplementation(()=>tick);vi.mocked(recognizeReference).mockResolvedValueOnce({...structuredClone(detection),dimensions:[...detection.dimensions,{...detection.dimensions[0],text:'8 m',millimetres:8000}]});
  await mount(true);upload();await screen.findByRole('region',{name:'Check drawing scale'});expect(captureAttemptReport(loadCaptureAttempts(localStorage))).toMatchObject({unfinishedOrUnknown:1,failureDenominator:0});
  tick=4000;fireEvent.click(screen.getByRole('button',{name:'Confirm measurement & load rooms'}));await screen.findByRole('button',{name:/^Timed bedroom/});expect(loadCaptureAttempts(localStorage)[0]).toMatchObject({outcome:'proposal',elapsedMs:4000});expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('stops before recognition when an opted-in attempt cannot be recorded',async()=>{
  const original=usePlanner.getState().plan;await mount(true);const setItem=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){if(key===CAPTURE_ATTEMPT_KEY)throw Error('Synthetic local quota');setItem.call(this,key,value);});
  upload();await screen.findByText('Synthetic local quota');expect(vi.mocked(recognizeReference)).not.toHaveBeenCalled();expect(loadCaptureAttempts(localStorage)).toEqual([]);expect(usePlanner.getState().plan).toBe(original);
});
