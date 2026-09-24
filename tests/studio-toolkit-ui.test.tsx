// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {BlueprintStudio} from '../src/BlueprintStudio';
import {blueprintPlan} from '../src/blueprint';
import {createSamplePlan} from '../src/domain';
import {usePlanner} from '../src/store';
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
  Object.defineProperty(SVGSVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({inverse:()=>({})})});
  for(const name of ['setPointerCapture','releasePointerCapture'])Object.defineProperty(SVGSVGElement.prototype,name,{configurable:true,value:()=>{}});
  Object.defineProperty(SVGSVGElement.prototype,'hasPointerCapture',{configurable:true,value:()=>true});
  vi.stubGlobal('PointerEvent',MouseEvent);vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){}matrixTransform(){return this;}});
  const p=createSamplePlan();p.floors=p.floors.slice(0,1);p.furniture=[];
  usePlanner.getState().replacePlan(blueprintPlan(p,p.floors[0].id,{rooms:[{id:'r',name:'Study',kind:'Office',x:0,z:0,width:4000,depth:4000,enclosed:true}],walls:[],omittedWalls:[],fixtures:[]}));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function drag(a:number[],b:number[]){const svg=screen.getByRole('img',{name:'Top-down floor plan drawing'});fireEvent.pointerDown(svg,{button:0,clientX:a[0],clientY:a[1],pointerId:1});fireEvent.pointerMove(svg,{clientX:b[0],clientY:b[1],pointerId:1});fireEvent.pointerUp(svg,{clientX:b[0],clientY:b[1],pointerId:1});}
it('draws a concave room in one undoable step without changing the 3D home',()=>{
  const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Draw L-shaped room'}));drag([5000,0],[9000,4000]);
  expect(screen.getByText('129.17 ft²')).toBeVisible();
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'z',ctrlKey:true});expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
  expect(usePlanner.getState().plan).toBe(original);
});
it('keeps measurements, note edits and layer visibility separate from physical geometry',()=>{
  const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add dimension'}));drag([0,0],[3000,4000]);
  expect(screen.getByRole('graphics-symbol',{name:'Saved dimension'})).toHaveTextContent('16′ 4 7/8″');
  fireEvent.click(screen.getByRole('button',{name:'Add note'}));drag([1000,1000],[1000,1000]);
  fireEvent.change(screen.getByLabelText('Note text'),{target:{value:'Door clearance'}});
  expect(screen.getByRole('graphics-symbol',{name:'Note: Door clearance'})).toBeInTheDocument();
  fireEvent.keyDown(screen.getByLabelText('Note text'),{key:'w'});expect(screen.getByLabelText('Note text')).toBeVisible();
  fireEvent.click(screen.getByText('Layers & visibility'));fireEvent.click(screen.getByLabelText('Dimensions & notes'));
  expect(screen.queryByRole('graphics-symbol')).toBeNull();
  expect(usePlanner.getState().plan).toBe(original);
});
it('finishes a custom concave room with Enter and preserves navigation shortcuts',()=>{
  render(<BlueprintStudio onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  for(const p of [[5000,0],[9000,0],[9000,2000],[11000,2000],[11000,4000],[5000,4000]])drag(p,p);
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Enter'});
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
  expect(screen.getByRole('button',{name:'Pan drawing'})).toHaveAttribute('aria-pressed','true');
  expect(within(screen.getByRole('status')).getByText('Pan / zoom')).toBeVisible();
});
