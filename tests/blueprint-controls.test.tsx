// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BlueprintStudio } from '../src/BlueprintStudio';
import { BlueprintControls } from '../src/BlueprintControls';
import { blueprintPlan,type BlueprintRoom } from '../src/blueprint';
import { createSamplePlan } from '../src/domain';
import { usePlanner } from '../src/store';
vi.mock('../src/blueprintImport',()=>({renderReference:vi.fn(async(file:File)=>{if(file.name==='broken.pdf')throw new Error('Invalid PDF');return {url:'data:image/png;base64,AA',width:1000,height:800,pages:2,name:file.name};})}));
const room:BlueprintRoom={id:'bedroom',name:'Main bedroom',kind:'Bedroom',x:0,z:0,width:5000,depth:5000,enclosed:true};
function setupPlan(){const p=createSamplePlan('Test home','metric');p.gridSizeMm=250;p.floors=p.floors.slice(0,1);p.furniture=[];const plan=blueprintPlan(p,p.floors[0].id,{rooms:[room],walls:[],omittedWalls:[],fixtures:[]});usePlanner.getState().replacePlan(plan);return usePlanner.getState().plan;}
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
  Object.defineProperty(SVGSVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({inverse:()=>({})})});
  for(const name of ['setPointerCapture','releasePointerCapture'])Object.defineProperty(SVGSVGElement.prototype,name,{configurable:true,value:()=>{}});
  Object.defineProperty(SVGSVGElement.prototype,'hasPointerCapture',{configurable:true,value:()=>true});
  vi.stubGlobal('PointerEvent',MouseEvent);vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return this;}});
  vi.spyOn(window,'confirm').mockReturnValue(true);setupPlan();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('floor plan studio flow',()=>{
  it('keeps the 3D home untouched until the explicit review confirmation and supports undo',()=>{
    const original=usePlanner.getState().plan,onClose=vi.fn();render(<BlueprintStudio onClose={onClose}/>);
    fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));
    fireEvent.change(screen.getByLabelText('width (m)'),{target:{value:'4.321'}});fireEvent.blur(screen.getByLabelText('width (m)'));
    expect(usePlanner.getState().plan).toBe(original);expect(usePlanner.getState().past).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));
    expect(screen.getByRole('button',{name:/Confirm & create 3D home/})).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I checked the dimensions, openings and fixtures.'));
    fireEvent.click(screen.getByRole('button',{name:/Confirm & create 3D home/}));
    expect(onClose).toHaveBeenCalledOnce();expect(usePlanner.getState().plan.floors[0].blueprint!.rooms[0].width).toBe(4321);expect(usePlanner.getState().past).toHaveLength(1);
    act(()=>usePlanner.getState().undo());expect(usePlanner.getState().plan).toEqual(original);
  });
  it('has reversible drawing history independent of the home history',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));fireEvent.change(screen.getByLabelText('width (m)'),{target:{value:'4'}});fireEvent.blur(screen.getByLabelText('width (m)'));
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.getByRole('button',{name:/Main bedroom/})).toHaveTextContent('5.00 × 5.00');
    fireEvent.click(screen.getByRole('button',{name:'Redo drawing'}));expect(screen.getByRole('button',{name:/Main bedroom/})).toHaveTextContent('4.00 × 5.00');expect(usePlanner.getState().plan).toBe(original);
  });
  it('loads PDFs into a calibration stage and does not pretend to detect rooms',async()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf',{type:'application/pdf'})]}});
    expect(await screen.findByText(/walls are not detected automatically/)).toBeVisible();expect(screen.getByLabelText('PDF page')).toHaveValue('1');expect(screen.getByRole('button',{name:'Draw room area'})).toBeDisabled();expect(screen.getByRole('button',{name:'Review & create 3D →'})).toBeDisabled();expect(usePlanner.getState().plan).toBe(original);
  });
  it('retains the draft when file rendering fails',async()=>{
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['bad'],'broken.pdf')]}});
    expect(await screen.findByText('Invalid PDF')).toBeVisible();expect(screen.getByRole('button',{name:/Main bedroom/})).toBeVisible();
  });
  it('calibrates a scan, traces a room and keeps the entire stroke in one draft undo',async()=>{
    render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf')]}});
    await screen.findByText(/walls are not detected automatically/);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});
    fireEvent.pointerDown(canvas,{clientX:100,clientY:100,button:0});fireEvent.pointerMove(canvas,{clientX:1100,clientY:100});fireEvent.pointerUp(canvas,{clientX:1100,clientY:100});
    fireEvent.change(screen.getByLabelText('Known length (m)'),{target:{value:'4'}});fireEvent.click(screen.getByRole('button',{name:'Apply scale'}));
    expect(screen.getByRole('button',{name:'Draw room area'})).toBeEnabled();
    fireEvent.pointerDown(canvas,{clientX:1000,clientY:1000,button:0});fireEvent.pointerMove(canvas,{clientX:5000,clientY:4000});fireEvent.pointerUp(canvas,{clientX:5000,clientY:4000});
    expect(screen.getByRole('button',{name:/Living 1/})).toHaveTextContent('4.00 × 3.00');
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.queryByRole('button',{name:/Living 1/})).not.toBeInTheDocument();
  });
  it('moves a room in top-down view without moving the saved floor',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'}),rect=canvas.querySelector('[data-object="bedroom"] rect')!;
    fireEvent.pointerDown(rect,{clientX:500,clientY:500,button:0});fireEvent.pointerMove(canvas,{clientX:1500,clientY:1500});fireEvent.pointerUp(canvas,{clientX:1500,clientY:1500});
    expect(screen.getByLabelText('Left (m)')).toHaveValue(1);expect(screen.getByLabelText('Top (m)')).toHaveValue(1);expect(usePlanner.getState().plan).toBe(original);
  });
  it('rejects conversion when another action has changed the home',()=>{
    render(<BlueprintStudio onClose={()=>{}}/>);act(()=>usePlanner.getState().rename('Changed'));
    expect(screen.getByRole('alert')).toHaveTextContent('home changed');expect(screen.getByRole('button',{name:'Review & create 3D →'})).toBeDisabled();
  });
});
describe('automatic furnishing review',()=>{
  it('previews without saving, discards, and applies in one undo step',()=>{
    const original=usePlanner.getState().plan,onPreview=vi.fn();render(<BlueprintControls busy={false} onPreview={onPreview} onBusy={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Auto furnish'}));expect(onPreview).toHaveBeenCalled();expect(usePlanner.getState().plan).toBe(original);expect(screen.getByRole('dialog',{name:'Review automatic furnishing'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Discard preview'}));expect(onPreview).toHaveBeenLastCalledWith(undefined);expect(usePlanner.getState().plan).toBe(original);
    fireEvent.click(screen.getByRole('button',{name:'Auto furnish'}));fireEvent.click(screen.getByRole('button',{name:'Apply furnishing · one undo'}));expect(usePlanner.getState().plan.furniture).toHaveLength(3);expect(usePlanner.getState().past).toHaveLength(1);
    act(()=>usePlanner.getState().undo());expect(usePlanner.getState().plan).toEqual(original);
  });
  it('discards stale furnishing previews instead of overwriting newer work',()=>{
    const onPreview=vi.fn();render(<BlueprintControls busy={false} onPreview={onPreview} onBusy={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Auto furnish'}));act(()=>usePlanner.getState().rename('Newer home'));
    expect(screen.queryByRole('dialog',{name:'Review automatic furnishing'})).not.toBeInTheDocument();expect(onPreview).toHaveBeenLastCalledWith(undefined);expect(usePlanner.getState().plan.name).toBe('Newer home');
  });
});
