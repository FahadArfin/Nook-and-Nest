// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {BlueprintStudio} from '../src/BlueprintStudio';
import {createSamplePlan} from '../src/domain';
import {usePlanner} from '../src/store';
import {prepareWallFirst} from '../src/wallFirst';
import {recognizeReference} from '../src/blueprintRecognition';
import type {BlueprintDraft} from '../src/blueprint';
vi.mock('../src/blueprintImport',()=>({renderReference:vi.fn(async()=>({url:'data:image/png;base64,AA',width:600,height:600,pages:1,name:'plan.png'}))}));
vi.mock('../src/wallFirst',()=>({prepareWallFirst:vi.fn()}));
vi.mock('../src/blueprintRecognition',async original=>({...await original<typeof import('../src/blueprintRecognition')>(),recognizeReference:vi.fn()}));
const proposal=():BlueprintDraft=>({wallFirst:true,referenceScale:10,referenceCalibrated:false,rooms:[{id:'footprint:0',groupId:'footprint',name:'Home footprint',kind:'Hall',enclosed:false,x:0,z:0,width:6000,depth:6000}],walls:[{id:'top',ax:8,az:12,bx:24,bz:12},{id:'left',ax:8,az:12,bx:8,bz:20},{id:'bottom',ax:8,az:20,bx:24,bz:20},{id:'hall',ax:0,az:20,bx:4,bz:20}],omittedWalls:[],fixtures:[],regionDividers:[]});
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
  Object.defineProperty(SVGSVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({inverse:()=>({})})});
  for(const name of ['setPointerCapture','releasePointerCapture'])Object.defineProperty(SVGSVGElement.prototype,name,{configurable:true,value:()=>{}});
  Object.defineProperty(SVGSVGElement.prototype,'hasPointerCapture',{configurable:true,value:()=>true});
  vi.stubGlobal('PointerEvent',MouseEvent);vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return this;}});
  vi.spyOn(window,'confirm').mockReturnValue(true);const p=createSamplePlan();p.gridSizeMm=250;p.units='metric';p.floors=p.floors.slice(0,1);p.floors[0].cells=[];p.floors[0].walls=[];p.furniture=[];usePlanner.getState().replacePlan(p);vi.mocked(prepareWallFirst).mockResolvedValue(proposal());vi.mocked(recognizeReference).mockClear();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const drag=(a:[number,number],b:[number,number])=>{const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'});fireEvent.pointerDown(canvas,{button:0,clientX:a[0],clientY:a[1]});fireEvent.pointerMove(canvas,{clientX:b[0],clientY:b[1]});fireEvent.pointerUp(canvas);};
async function imported(){render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['plan'],'plan.png')]}});await screen.findByRole('heading',{name:'Outline → walls → regions'});}
it('defaults to local extraction, then supports scale, doorway division, generation, Combine and Undo',async()=>{
  const before=usePlanner.getState().plan;await imported();expect(recognizeReference).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'3. Generate regions'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'1. Set scale'}));drag([0,0],[6000,0]);fireEvent.change(screen.getByLabelText('Known length (m)'),{target:{value:'6'}});fireEvent.click(screen.getByRole('button',{name:'Apply scale'}));
  fireEvent.click(screen.getByRole('button',{name:'Draw region divider'}));drag([1000,5000],[2000,5000]);expect(screen.getByLabelText('Region divider')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'3. Generate regions'}));expect(screen.getByRole('heading',{name:'Rooms & regions · 3'})).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox',{name:'Combine Region 1'}));fireEvent.click(screen.getByRole('checkbox',{name:'Combine Region 3'}));fireEvent.click(screen.getByRole('button',{name:'Combine selected (2)'}));expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.getByRole('heading',{name:'Rooms & regions · 3'})).toBeVisible();expect(usePlanner.getState().plan).toBe(before);
});
it('restores scale together with its geometry on Undo',async()=>{await imported();fireEvent.click(screen.getByRole('button',{name:'1. Set scale'}));drag([0,0],[6000,0]);fireEvent.change(screen.getByLabelText('Known length (m)'),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'Apply scale'}));expect(screen.getByRole('button',{name:'3. Generate regions'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));expect(screen.getByRole('button',{name:'3. Generate regions'})).toBeDisabled();expect(screen.getByRole('img',{name:'Top-down floor plan drawing'}).querySelector('image')).toHaveAttribute('width','6000');});
it('retains the current drawing when local extraction fails',async()=>{vi.mocked(prepareWallFirst).mockRejectedValueOnce(new Error('No clear walls'));render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.change(screen.getByLabelText('Upload floor plan reference'),{target:{files:[new File(['plan'],'plan.png')]}});expect(await screen.findByRole('alert')).toHaveTextContent('No clear walls');expect(recognizeReference).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Toggle rooms panel'}));expect(screen.getByRole('heading',{name:'Rooms & regions · 0'})).toBeVisible();});

it('pans after import and locks selected footprint geometry until explicitly edited',async()=>{
 await imported();expect(screen.getByRole('button',{name:'Pan drawing'})).toHaveAttribute('aria-pressed','true');
 const canvas=screen.getByRole('img',{name:'Top-down floor plan drawing'}),rect=canvas.querySelector('[data-object="footprint:0"] rect')??canvas.querySelector('rect[data-object="footprint:0"]')!;
 const before=rect.getAttribute('x');const view=canvas.getAttribute('viewBox');
 fireEvent.pointerDown(rect,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:500,clientY:500});fireEvent.pointerUp(canvas);
 expect(rect).toHaveAttribute('x',before);expect(canvas.getAttribute('viewBox')).not.toBe(view);
 fireEvent.click(screen.getByRole('button',{name:'Select and resize rooms'}));fireEvent.pointerDown(rect,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:500,clientY:500});fireEvent.pointerUp(canvas);
 expect(rect).toHaveAttribute('x',before);expect(canvas.querySelector('[data-handle]')).toBeNull();expect(screen.getByRole('button',{name:'Move room left'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'2. Edit footprint'}));expect(canvas.querySelector('[data-handle]')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Done editing footprint'}));expect(screen.getByRole('button',{name:'Pan drawing'})).toHaveAttribute('aria-pressed','true');expect(canvas.querySelector('[data-handle]')).toBeNull();
});
