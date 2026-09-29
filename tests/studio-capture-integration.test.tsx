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
import {loadStudioRecovery} from '../src/studioRecovery';
import {loadFloorReference} from '../src/studioReference';
const result={rooms:[{name:'Captured bedroom',kind:'Bedroom' as const,x:0,y:0,width:500,height:400,enclosed:true,note:'Check the faint edge.'}],walls:[],dimensions:[{text:'5 m',millimetres:5000,ax:0,ay:0,bx:500,by:0}],fixtures:[{catalogId:'washer',x:100,y:100,width:60,depth:60,rotation:0}],warnings:[]};
vi.mock('../src/blueprintImport',()=>({renderReference:vi.fn(async(file:File,page=1,rotation=0)=>({url:`data:image/png;base64,${btoa(String(page)+':'+rotation)}`,width:1000,height:800,pages:2,name:file.name}))}));
vi.mock('../src/blueprintRecognition',async original=>({...await original<typeof import('../src/blueprintRecognition')>(),recognizeReference:vi.fn(async()=>structuredClone(result))}));
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};vi.spyOn(window,'confirm').mockReturnValue(true);vi.mocked(recognizeReference).mockClear();const p=createSamplePlan('Capture integration','metric');p.floors=p.floors.slice(0,1);p.furniture=[];usePlanner.getState().replacePlan(blueprintPlan(p,p.floors[0].id,{rooms:[{id:'old',name:'Original room',kind:'Bedroom',x:0,z:0,width:3000,depth:3000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function importCapture(){render(<BlueprintStudio onClose={()=>{}}/>);await waitFor(()=>expect(screen.queryByText(/Restoring draft/)).toBeNull());fireEvent.change(screen.getByLabelText('Import method'),{target:{value:'luna'}});const file=new File(['source'],'Private source.pdf',{type:'application/pdf'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('source').buffer});fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[file]}});await screen.findByRole('button',{name:/^Captured bedroom/});fireEvent.click(screen.getByText('Check capture & local benchmark'));return within(screen.getByRole('region',{name:'Measured capture review'}));}
function complete(review:ReturnType<typeof within>){for(const [label,value]of [['Start X (px)','0'],['Start Y (px)','0'],['End X (px)','500'],['End Y (px)','0'],['Verified length (mm)','5000']])fireEvent.change(review.getByLabelText(label),{target:{value}});fireEvent.click(review.getByRole('button',{name:'Confirm measured span'}));fireEvent.click(review.getByRole('button',{name:'Keep original'}));fireEvent.change(review.getByLabelText('Detected item'),{target:{value:'dimension:0'}});fireEvent.click(review.getByRole('button',{name:'Keep original'}));for(const text of ['I checked the outer boundary, wall joins and room sizes.','I checked doors/windows against the reference, including missing openings.','I checked room labels and read the analysis notes.'])fireEvent.click(review.getByLabelText(text));}
it('reviews actual rooms-only recognition, previews without floor mutation, then confirms once and undoes',async()=>{
 const original=usePlanner.getState().plan,review=await importCapture();expect(review.getByText(/does not provide a calibrated confidence/)).toBeVisible();expect(review.getByLabelText('Detected item').textContent).not.toContain('washer');expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
 complete(review);fireEvent.change(review.getByLabelText('Detected item'),{target:{value:'room:0'}});fireEvent.click(review.getByText('Edit this item'));fireEvent.change(review.getByLabelText('Width (px)'),{target:{value:'432.1'}});fireEvent.click(review.getByRole('button',{name:'Use edited geometry'}));fireEvent.click(review.getByRole('button',{name:'Preview reviewed layout'}));expect(usePlanner.getState().plan).toBe(original);expect(usePlanner.getState().past).toHaveLength(0);expect(review.getByText('Optional local accuracy benchmark')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/Confirm & create 3D home/}));});
 await waitFor(()=>expect(usePlanner.getState().past).toHaveLength(1));expect(usePlanner.getState().plan.floors[0].blueprint!.rooms[0].width).toBe(4321);expect(usePlanner.getState().plan.furniture).toHaveLength(0);expect(usePlanner.getState().plan.studioDrafts?.[original.floors[0].id].draft.captureReview?.completedAtMs).toBeDefined();
 act(()=>usePlanner.getState().undo());expect(usePlanner.getState().plan).toEqual(original);expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('manual geometry changes stale old review; explicit restart preserves drawing and resets review without analysis',async()=>{
 const original=usePlanner.getState().plan,review=await importCapture();complete(review);fireEvent.click(screen.getByRole('button',{name:/^Captured bedroom/}));fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'My manual edit'}});
 expect(review.getByText(/reference or drawing changed/)).toBeVisible();expect(review.getByRole('button',{name:'Preview reviewed layout'})).toBeDisabled();fireEvent.click(review.getByRole('button',{name:'Start fresh review'}));expect(screen.getByRole('button',{name:/^My manual edit/})).toBeVisible();expect(review.getByRole('button',{name:'Preview reviewed layout'})).toBeDisabled();expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();expect(usePlanner.getState().plan).toBe(original);
});
it('local recovery and explicit draft save preserve matching source identity without any extra recognition',async()=>{
 const original=usePlanner.getState().plan,review=await importCapture();complete(review);const floor=original.floors[0].id;
 await waitFor(async()=>expect((await loadStudioRecovery(original.id,floor))?.captureSource?.source.id).toBeTruthy(),{timeout:3000});const saved=(await loadStudioRecovery(original.id,floor))!;expect(saved.draft.captureReview?.source.id).toBe(saved.captureSource?.source.id);
 fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await waitFor(()=>expect(usePlanner.getState().plan.studioDrafts?.[floor].draft.captureReview?.source.id).toBe(saved.captureSource?.source.id));
 const local=await loadFloorReference(original.id,usePlanner.getState().plan.floors[0]);expect(local?.captureSource?.source.id).toBe(saved.captureSource?.source.id);expect(usePlanner.getState().plan.floors[0].cells).toEqual(original.floors[0].cells);expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();
});
it('changing source page in manual mode leaves old review stale and does not make a recognition request',async()=>{
 const review=await importCapture();complete(review);fireEvent.change(screen.getByLabelText('Import method'),{target:{value:'manual'}});fireEvent.click(screen.getByRole('button',{name:'View'}));fireEvent.change(screen.getByLabelText('PDF page'),{target:{value:'2'}});await screen.findByText('Reference stays on this device. Calibrate a known length before tracing.');
 const current=within(screen.getByRole('region',{name:'Measured capture review'}));expect(current.getByRole('button',{name:'Preview reviewed layout'})).toBeDisabled();expect(current.queryByRole('button',{name:'Start fresh review'})).toBeNull();expect(vi.mocked(recognizeReference)).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:/^Captured bedroom/})).toBeVisible();
});


