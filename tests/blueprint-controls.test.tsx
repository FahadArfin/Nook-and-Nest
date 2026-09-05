// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {recognizeReference} from '../src/blueprintRecognition';
import { BlueprintStudio } from '../src/BlueprintStudio';
import { BlueprintControls } from '../src/BlueprintControls';
import { blueprintPlan,type BlueprintRoom } from '../src/blueprint';
import { createSamplePlan } from '../src/domain';
import { usePlanner } from '../src/store';
vi.mock('../src/blueprintImport',()=>({renderReference:vi.fn(async(file:File)=>{if(file.name==='broken.pdf')throw new Error('Invalid PDF');return {url:'data:image/png;base64,AA',width:1000,height:800,pages:2,name:file.name};})}));
vi.mock('../src/blueprintRecognition',async(importOriginal)=>({...await importOriginal<typeof import('../src/blueprintRecognition')>(),recognizeReference:vi.fn(async()=>({rooms:[{name:'Detected bedroom',kind:'Bedroom',x:0,y:0,width:500,height:400,enclosed:true,note:''}],dimensions:[{text:'5 m',millimetres:5000,ax:0,ay:0,bx:500,by:0}],fixtures:[],warnings:[]}))}));
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
  it('automatically creates rooms using printed dimensions before any home mutation',async()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf')]}});
    expect(await screen.findByRole('button',{name:/Detected bedroom/})).toHaveTextContent('5.00 × 4.00');
    fireEvent.click(screen.getByRole('button',{name:'View'}));fireEvent.click(screen.getByText('Measurements & analysis notes'));expect(screen.getByText('5 m = 5.000 m')).toBeVisible();expect(screen.getByRole('button',{name:'Review & create 3D →'})).toBeEnabled();expect(usePlanner.getState().plan).toBe(original);
  });
  it('shows a multi-part room once and renames and moves all its parts together',async()=>{
    vi.mocked(recognizeReference).mockResolvedValueOnce({rooms:[{name:'Living room',kind:'Living',x:0,y:0,width:500,height:300,enclosed:false,note:''},{name:'Living room — extension',kind:'Living',x:0,y:300,width:200,height:200,enclosed:false,note:''},{name:'Closet',kind:'Closet',x:500,y:0,width:100,height:100,enclosed:true,note:''}],dimensions:[{text:'5 m',millimetres:5000,ax:0,ay:0,bx:500,by:0}],fixtures:[],warnings:[]});
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf')]}});
    await screen.findByRole('heading',{name:'Rooms & spaces · 2'});expect(screen.getAllByRole('button',{name:/Living room/})).toHaveLength(1);expect(screen.queryByRole('heading',{name:'Closets & circulation'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:/Living room/}));
    fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'Lounge'}});fireEvent.change(screen.getByLabelText('Left (m)'),{target:{value:'1'}});fireEvent.blur(screen.getByLabelText('Left (m)'));
    const parts=screen.getByRole('img',{name:'Top-down floor plan drawing'}).querySelectorAll('[data-object="scan-room-0"] rect');expect(parts).toHaveLength(2);expect(parts[0].getAttribute('x')).toBe('1000');expect(parts[1].getAttribute('x')).toBe('1000');expect(screen.getByRole('heading',{name:'Rooms & spaces · 2'}).parentElement!.querySelectorAll('.bp-room-row')).toHaveLength(2);
  });
  it('keeps the existing draft on analysis failure',async()=>{
    vi.mocked(recognizeReference).mockRejectedValueOnce(new Error('Image analysis is unavailable'));
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf')]}});
    expect(await screen.findByText('Image analysis is unavailable')).toBeVisible();expect(screen.getByRole('button',{name:/Main bedroom/})).toBeVisible();
  });
  it('retains the draft when file rendering fails',async()=>{
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['bad'],'broken.pdf')]}});
    expect(await screen.findByText('Invalid PDF')).toBeVisible();expect(screen.getByRole('button',{name:/Main bedroom/})).toBeVisible();
  });
  it('can cancel analysis without applying a late result',async()=>{
    let finish!:(value:any)=>void;vi.mocked(recognizeReference).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'floor.pdf')]}});
    await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:'Cancel analysis'}));
    await act(async()=>finish({rooms:[],dimensions:[],fixtures:[],warnings:[]}));
    expect(screen.getByRole('button',{name:/Main bedroom/})).toBeVisible();expect(screen.getByText('Analysis canceled. Your drawing is unchanged.')).toBeVisible();
  });
  it('retains conflicting detections for local measurement confirmation without another analysis',async()=>{
    const {recognizeReference}=await import('../src/blueprintRecognition');
    const detected={rooms:[{name:'Recovered bedroom',kind:'Bedroom' as const,x:0,y:0,width:400,height:300,enclosed:true,note:''}],dimensions:[{text:'4 m',millimetres:4000,ax:0,ay:0,bx:400,by:0},{text:'9 m',millimetres:9000,ax:0,ay:0,bx:400,by:0}],fixtures:[],warnings:[]};
    vi.mocked(recognizeReference).mockResolvedValueOnce(detected);
    const beforeCalls=vi.mocked(recognizeReference).mock.calls.length,original=usePlanner.getState().plan;
    render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['pdf'],'scale.pdf')]}});
    await screen.findByRole('heading',{name:'Check one measurement'});
    expect(usePlanner.getState().plan).toBe(original);
    expect(screen.getByLabelText('Printed length (metres)')).toHaveValue(4);
    fireEvent.change(screen.getByLabelText('Detected measurement'),{target:{value:'1'}});expect(screen.getByLabelText('Printed length (metres)')).toHaveValue(9);
    fireEvent.click(screen.getByRole('button',{name:'Mark two endpoints'}));
    const measurement=screen.getByLabelText('Measurement on uploaded floor plan');
    fireEvent.pointerDown(measurement,{clientX:0,clientY:0});expect(screen.getByRole('button',{name:'Confirm measurement & load rooms'})).toBeDisabled();
    fireEvent.pointerDown(measurement,{clientX:500,clientY:0});
    fireEvent.change(screen.getByLabelText('Printed length (metres)'),{target:{value:'5'}});
    fireEvent.click(screen.getByRole('button',{name:'Confirm measurement & load rooms'}));
    fireEvent.click(await screen.findByRole('button',{name:/Recovered bedroom/}));
    expect(screen.getByLabelText('width (m)')).toHaveValue(4);
    expect(vi.mocked(recognizeReference).mock.calls.length-beforeCalls).toBe(1);
    expect(usePlanner.getState().plan).toBe(original);
  });
  it('adds a doorless entrance and moves fixtures independently with undo',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Doors, entrances and windows'}));fireEvent.click(screen.getByRole('button',{name:'Place Entrance'}));
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});
    fireEvent.pointerDown(canvas,{clientX:2500,clientY:0,button:0});
    expect(screen.getByLabelText('Entrance without a door')).toBeChecked();
    fireEvent.click(screen.getByRole('button',{name:'Choose optional fixtures'}));
    fireEvent.click(screen.getByRole('button',{name:'Place Stove'}));fireEvent.pointerDown(canvas,{clientX:1000,clientY:1000,button:0});
    const box=canvas.querySelector('[data-object] rect[fill="#f5c96366"]')!;
    fireEvent.pointerDown(box,{clientX:1000,clientY:1000,button:0});fireEvent.pointerMove(canvas,{clientX:1173,clientY:1237});fireEvent.pointerUp(canvas,{clientX:1173,clientY:1237});
    expect(screen.getByLabelText('Left (m)')).toHaveValue(1.173);expect(screen.getByLabelText('Top (m)')).toHaveValue(1.237);
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));fireEvent.click(screen.getByText('Fixtures & openings · 2'));fireEvent.click(screen.getByRole('button',{name:'Cottage range'}));expect(screen.getByLabelText('Left (m)')).toHaveValue(1);
    expect(usePlanner.getState().plan).toBe(original);
    fireEvent.click(screen.getByRole('button',{name:/Review & create 3D/}));fireEvent.click(screen.getByLabelText('I checked the dimensions, openings and fixtures.'));
    fireEvent.click(screen.getByRole('button',{name:/Confirm & create 3D home/}));
    expect(usePlanner.getState().plan.furniture.find(f=>f.catalogId==='door-flush')?.doorless).toBe(true);
  });
  it('resizes a rectangle with a corner handle, and undo restores the drawing only',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'}),handle=canvas.querySelector('[data-handle="se"]')!;
    fireEvent.pointerDown(handle,{clientX:5000,clientY:5000,button:0});fireEvent.pointerMove(canvas,{clientX:4300,clientY:4700});fireEvent.pointerUp(canvas,{clientX:4300,clientY:4700});
    expect(screen.getByLabelText('width (m)')).toHaveValue(4.3);expect(screen.getByLabelText('depth (m)')).toHaveValue(4.7);
    expect(usePlanner.getState().plan).toBe(original);fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));
    fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));expect(screen.getByLabelText('width (m)')).toHaveValue(5);
  });
  it('lets a user select, rename and delete an overlapped false dining area',()=>{
    const original=usePlanner.getState().plan,base=structuredClone(original),id=base.floors[0].id;
    usePlanner.getState().replacePlan(blueprintPlan(base,id,{rooms:[room,{...room,id:'false-dining',name:'Dining',kind:'Dining',x:1000,z:1000,width:2000,depth:2000}],walls:[],omittedWalls:[],fixtures:[]}));
    render(<BlueprintStudio onClose={()=>{}}/>);const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});
    fireEvent.pointerDown(canvas.querySelector('[data-object="false-dining"] rect')!,{clientX:1500,clientY:1500,button:0});fireEvent.pointerUp(canvas,{clientX:1500,clientY:1500});
    expect(screen.queryByText('Areas at this point')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/^Dining/}));
    fireEvent.change(screen.getByLabelText('Room name'),{target:{value:'Incorrect dining'}});expect(screen.getByLabelText('Room name')).toHaveValue('Incorrect dining');
    fireEvent.click(screen.getByRole('button',{name:'Delete room'}));expect(canvas.querySelector('[data-object="false-dining"]')).toBeNull();expect(canvas.querySelector('[data-object="bedroom"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(canvas.querySelector('[data-object="false-dining"]')).not.toBeNull();
  });
  it('separates and deletes a wrong rectangle without moving the living room',()=>{
    const base=usePlanner.getState().plan,id=base.floors[0].id;
    const parts=[{...room,id:'living',name:'Living',kind:'Living' as const,groupId:'bad-group'},{...room,id:'wrong-part',name:'Living',kind:'Living' as const,groupId:'bad-group',x:0,z:-2000,width:2000,depth:2000}];
    usePlanner.getState().replacePlan(blueprintPlan(base,id,{rooms:parts,walls:[],omittedWalls:[],fixtures:[]}));render(<BlueprintStudio onClose={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:/Living.*5.00/}));fireEvent.click(screen.getByLabelText('Edit individual rectangles'));fireEvent.click(screen.getByRole('button',{name:'Rectangle 2'}));fireEvent.click(screen.getByRole('button',{name:'Separate rectangle'}));
    expect(screen.getByLabelText('Room name')).toHaveValue('Separated area');fireEvent.click(screen.getByRole('button',{name:'Delete room'}));
    expect(screen.getByRole('button',{name:/Living.*5.00/})).toBeInTheDocument();
  });
  it('moves a room in top-down view without moving the saved floor',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'}),rect=canvas.querySelector('[data-object="bedroom"] rect')!;
    fireEvent.pointerDown(rect,{clientX:500,clientY:500,button:0});fireEvent.pointerMove(canvas,{clientX:1500,clientY:1500});fireEvent.pointerUp(canvas,{clientX:1500,clientY:1500});
    expect(screen.getByLabelText('Left (m)')).toHaveValue(1);expect(screen.getByLabelText('Top (m)')).toHaveValue(1);expect(usePlanner.getState().plan).toBe(original);
  });
  it('keeps import and settings in menus and shows the inspector only on selection',()=>{
    render(<BlueprintStudio onClose={()=>{}}/>);
    expect(screen.queryByRole('heading',{name:'Edit room'})).toBeNull();
    expect(screen.queryByLabelText('Analysis model')).toBeNull();
    expect(screen.queryByRole('button',{name:'Import PDF or image…'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'File'}));expect(screen.getByRole('button',{name:'Import PDF or image…'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'File'}));fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));expect(screen.getByRole('heading',{name:'Edit room'})).toBeVisible();
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});fireEvent.pointerDown(canvas,{button:0,clientX:9000,clientY:9000});fireEvent.pointerUp(canvas);
    expect(screen.queryByRole('heading',{name:'Edit room'})).toBeNull();expect(screen.queryByText('Overlapping rooms')).toBeNull();
  });
  it('combines three selected rectangles with one undo and one room entry',()=>{
    const p=usePlanner.getState().plan,id=p.floors[0].id;
    usePlanner.getState().replacePlan(blueprintPlan(p,id,{rooms:[room,{...room,id:'two',name:'Room two',x:5000},{...room,id:'three',name:'Room three',x:10000}],walls:[],omittedWalls:[],fixtures:[]}));
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Combine rooms'}));
    for(const name of ['Main bedroom','Room three','Room two'])fireEvent.click(screen.getByRole('checkbox',{name:`Combine ${name}`}));
    fireEvent.click(screen.getByRole('button',{name:'Combine selected (3)'}));expect(screen.getByRole('heading',{name:'Rooms & spaces · 1'})).toBeVisible();expect(screen.getByLabelText('width (m)')).toHaveValue(15);
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.getByRole('heading',{name:'Rooms & spaces · 3'})).toBeVisible();
  });
  it('click-selects overlapping bedroom pieces and names the combined bedroom in one undo',()=>{
    const p=usePlanner.getState().plan,id=p.floors[0].id;
    const pieces=[{...room,id:'master',name:'M BEDROOM',x:1000,z:0,width:4000,depth:3000},{...room,id:'living4',name:'Living 4',kind:'Living' as const,x:900,z:1200,width:1000,depth:2800,enclosed:false},{...room,id:'living3',name:'Living 3',kind:'Living' as const,x:0,z:4000,width:1900,depth:900,enclosed:false}];
    usePlanner.getState().replacePlan(blueprintPlan(p,id,{rooms:pieces,walls:[],omittedWalls:[],fixtures:[]}));const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});fireEvent.click(screen.getByRole('button',{name:'Combine rooms'}));
    for(const id of ['living3','living4','master']){fireEvent.pointerDown(canvas.querySelector(`[data-object="${id}"] rect`)!,{button:0,clientX:1000,clientY:2000});fireEvent.pointerUp(canvas);}
    expect(screen.getByLabelText('Combined room name')).toHaveValue('Master bedroom');expect(screen.getByLabelText('Combined room type')).toHaveValue('Bedroom');
    fireEvent.click(screen.getByRole('button',{name:'Deselect Living 4'}));expect(screen.getByText('2 areas selected')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:/^Living 4/}));fireEvent.change(screen.getByLabelText('Combined room name'),{target:{value:'Master bedroom'}});
    fireEvent.click(screen.getByRole('button',{name:'Combine selected (3)'}));expect(screen.getByLabelText('Room name')).toHaveValue('Master bedroom');expect(screen.getByRole('heading',{name:'Rooms & spaces · 1'})).toBeVisible();expect(usePlanner.getState().plan).toBe(original);
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.getByRole('heading',{name:'Rooms & spaces · 3'})).toBeVisible();
  });
  it('shows four handles for a combined room and resizes every piece as one object',()=>{
    const p=usePlanner.getState().plan,id=p.floors[0].id;
    usePlanner.getState().replacePlan(blueprintPlan(p,id,{rooms:[{...room,groupId:'joined',width:4000,depth:3000},{...room,id:'extension',groupId:'joined',x:-1000,z:2000,width:1000,depth:1000}],walls:[],omittedWalls:[],fixtures:[]}));
    render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});
    expect(canvas.querySelectorAll('[data-handle]')).toHaveLength(4);expect(screen.queryByRole('button',{name:'Rectangle 2'})).toBeNull();
    fireEvent.pointerDown(canvas.querySelector('[data-handle="se"]')!,{button:0,clientX:4000,clientY:3000});fireEvent.pointerMove(canvas,{clientX:9000,clientY:6000});fireEvent.pointerUp(canvas);
    expect(screen.getByLabelText('width (m)')).toHaveValue(10);expect(screen.getByLabelText('depth (m)')).toHaveValue(6);
    const extension=canvas.querySelector('rect[data-object="extension"]')!;expect(extension.getAttribute('width')).toBe('2000');expect(extension.getAttribute('y')).toBe('4000');
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));fireEvent.click(screen.getByRole('button',{name:/Main bedroom/}));expect(screen.getByLabelText('width (m)')).toHaveValue(5);
    fireEvent.click(screen.getByLabelText('Edit individual rectangles'));expect(canvas.querySelectorAll('[data-handle]')).toHaveLength(8);
  });
  it('drags a fixture icon onto the plan, deletes it, and undoes deletion',()=>{
    const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,right:5000,bottom:5000,width:5000,height:5000,x:0,y:0,toJSON(){}});
    fireEvent.click(screen.getByRole('button',{name:'Choose optional fixtures'}));const stove=screen.getByRole('button',{name:'Place Stove'});
    fireEvent.pointerDown(stove,{button:0,clientX:5100,clientY:500});fireEvent.pointerMove(stove,{clientX:1000,clientY:1200});fireEvent.pointerUp(stove,{clientX:1000,clientY:1200});
    expect(screen.getByLabelText('Left (m)')).toHaveValue(1);expect(screen.getByLabelText('Top (m)')).toHaveValue(1.2);
    expect(canvas.querySelectorAll('[data-object] title')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Delete object'}));expect(canvas.querySelectorAll('[data-object] title')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(canvas.querySelectorAll('[data-object] title')).toHaveLength(1);expect(usePlanner.getState().plan).toBe(original);
  });
  it('snaps a dragged room to a shared wall and undo restores its gap',()=>{
    const p=usePlanner.getState().plan,id=p.floors[0].id;
    usePlanner.getState().replacePlan(blueprintPlan(p,id,{rooms:[room,{...room,id:'two',name:'Room two',x:5300}],walls:[],omittedWalls:[],fixtures:[]}));render(<BlueprintStudio onClose={()=>{}}/>);
    const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'}),part=canvas.querySelector('[data-object="two"] rect')!;
    fireEvent.pointerDown(part,{button:0,clientX:5500,clientY:1000});fireEvent.pointerMove(canvas,{clientX:5240,clientY:1000});expect(screen.getByText('Shared wall snapped')).toBeVisible();fireEvent.pointerUp(canvas);
    expect(screen.getByLabelText('Left (m)')).toHaveValue(5);fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));fireEvent.click(screen.getByRole('button',{name:/Room two/}));expect(screen.getByLabelText('Left (m)')).toHaveValue(5.3);
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
