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
it('ignores an unused starting point when reviewing and creates the completed home',()=>{
  const created=vi.fn();render(<BlueprintStudio onClose={()=>{}} onCreated={created}/>);
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));drag([5000,0],[5000,0]);
  fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));
  expect(screen.queryByText('One unfinished outline remains')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Confirm & create 3D home'}));
  expect(created).toHaveBeenCalledOnce();
});
it('reveals hidden unfinished lines in review and can discard only the sketch before successful conversion',()=>{
  const created=vi.fn();render(<BlueprintStudio onClose={()=>{}} onCreated={created}/>);
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  drag([5000,0],[5000,0]);drag([8000,0],[8000,0]);
  // Switching via the palette can hide the active sketch without clearing it.
  fireEvent.click(screen.getByRole('button',{name:'Select and move rooms'}));
  fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));
  expect(screen.getByText('One unfinished outline remains')).toBeVisible();
  expect(screen.getByRole('button',{name:'Confirm & create 3D home'})).toBeDisabled();
  expect(screen.getByRole('img',{name:'Top-down floor plan drawing'}).querySelector('[data-preview="polygon"]')).toHaveAttribute('points','5000,0 8000,0');
  fireEvent.click(screen.getByRole('button',{name:'Continue drawing outline'}));
  expect(screen.getByText('2 corners · any angle')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));
  fireEvent.click(screen.getByRole('button',{name:'Discard unfinished outline'}));
  expect(screen.getByText('Your completed rooms are unchanged.',{exact:false})).toBeVisible();
  expect(screen.getByRole('button',{name:'Confirm & create 3D home'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm & create 3D home'}));
  expect(created).toHaveBeenCalledOnce();
});
it('creates named rooms immediately on closure and on a crossing partition, with toolbar undo and redo',()=>{
  const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
  expect(screen.queryByRole('button',{name:'Draw connected rooms'})).toBeNull();
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  for(const p of [[5000,0],[11000,0],[11000,6000],[5000,6000]])drag(p,p);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
  drag([5000,0],[5000,0]);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  expect(screen.getByText('New room created.',{exact:false})).toBeVisible();
  expect(screen.queryByRole('button',{name:'Apply rooms'})).toBeNull();
  expect(screen.getByRole('button',{name:'Draw custom room',hidden:true})).toHaveAttribute('aria-pressed','true');
  for(const p of [[8000,-1000],[8000,7000],[4500,7000],[4500,3000],[11500,3000]])drag(p,p);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 5'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));
  expect(screen.getByRole('heading',{name:'Rooms & regions · 3'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Redo drawing'}));
  expect(screen.getByRole('heading',{name:'Rooms & regions · 5'})).toBeVisible();
  expect(usePlanner.getState().plan).toBe(original);
});
it('uses an existing room edge to close a new room without an extra confirmation',()=>{
  render(<BlueprintStudio onClose={()=>{}}/>);if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  for(const p of [[4000,1000],[7000,1000],[7000,3000],[4000,3000]])drag(p,p);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  expect(screen.getByRole('img',{name:'Top-down floor plan drawing'}).querySelector('rect[x="4000"][y="1000"][width="3000"][height="2000"]')).not.toBeNull();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'z',ctrlKey:true});
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
});
it('leaves an open outline unfilled and lets toolbar undo and cancellation clear it safely',()=>{
  render(<BlueprintStudio onClose={()=>{}}/>);if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  for(const p of [[5000,0],[9000,0],[9000,4000]])drag(p,p);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Undo drawing'}));
  expect(screen.getByText('2 corners · any angle')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Cancel outline'}));
  expect(screen.getByText('0 corners · any angle')).toBeVisible();
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
});
it('draws a concave room in one undoable step without changing the 3D home',()=>{
  const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
  if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw L-shaped room'}));drag([5000,0],[9000,4000]);
  expect(screen.getByText('129.17 ft²')).toBeVisible();
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'z',ctrlKey:true});expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
  expect(usePlanner.getState().plan).toBe(original);
});
it('keeps measurements, note edits and layer visibility separate from physical geometry',()=>{
  const original=usePlanner.getState().plan;render(<BlueprintStudio onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Add dimension'}));drag([0,0],[3000,4000]);
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
  render(<BlueprintStudio onClose={()=>{}}/>);if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  for(const p of [[5000,0],[9000,0],[9000,2000],[11000,2000],[11000,4000],[5000,4000]])drag(p,p);
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Enter'});
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
  expect(screen.getByRole('button',{name:'Pan drawing'})).toHaveAttribute('aria-pressed','true');
  expect(within(screen.getByRole('status')).getByText('Pan / zoom')).toBeVisible();
});
it('previews the exact wall snap and creates the room on the snapped shared-edge return',()=>{
  Object.defineProperty(SVGSVGElement.prototype,'getScreenCTM',{configurable:true,value:()=>({a:.1,b:0,inverse:()=>({})})});
  render(<BlueprintStudio onClose={()=>{}}/>);if(screen.getByRole('button',{name:'More tools'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'More tools'}));fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
  const svg=screen.getByRole('img',{name:'Top-down floor plan drawing'});
  fireEvent.pointerMove(svg,{clientX:4130,clientY:1000,pointerId:1});
  const snappedX=svg.querySelector('[data-snap="wall"] circle')!.getAttribute('cx')!;
  expect(Number(snappedX)).toBeCloseTo(4000,0);
  drag([4130,1000],[4130,1000]);
  expect(svg.querySelector('[data-preview="polygon"]')).toHaveAttribute('points',expect.stringContaining(`${snappedX},1000`));
  drag([7000,1000],[7000,1000]);drag([7000,3000],[7000,3000]);
  fireEvent.pointerMove(svg,{clientX:4120,clientY:3100,pointerId:1});
  expect(svg.querySelector('[data-preview="polygon"]')).toHaveAttribute('points',`${snappedX},1000 7000,1000 7000,3000 ${snappedX},3000`);
  drag([4120,3100],[4120,3100]);
  expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
  const added=svg.querySelector('rect[y="1000"][height="2000"]');
  expect(added).not.toBeNull();expect(Number(added!.getAttribute('x'))).toBeCloseTo(Number(snappedX),0);
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'z',ctrlKey:true});
  expect(screen.getByRole('heading',{name:'Rooms & regions · 1'})).toBeVisible();
});

it('draws a triangle directly, has no yellow square handles, and keeps it after conversion',()=>{
 render(<BlueprintStudio onClose={()=>{}}/>);
 expect(screen.queryByRole('button',{name:'Draw room options'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Draw custom room'}));
 for(const p of [[5000,0],[9000,0],[5000,3000],[5000,0]])drag(p,p);
 expect(screen.getByRole('heading',{name:'Rooms & regions · 2'})).toBeVisible();
 const svg=screen.getByRole('img',{name:'Top-down floor plan drawing'});expect(svg.querySelector('[data-handle]')).toBeNull();expect(svg.querySelector('[data-preview="enclosure"]')).toBeNull();expect(svg.querySelector('polygon[data-object]')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Review & create 3D →'}));fireEvent.click(screen.getByRole('button',{name:'Confirm & create 3D home'}));
 expect(usePlanner.getState().plan.floors[0].blueprint?.rooms.some(r=>r.polygon?.length===3)).toBe(true);
});
