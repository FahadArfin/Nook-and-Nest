// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,screen,cleanup} from '@testing-library/react';
import {bindTouchNavigation} from '../src/touchNavigation';
import {CatalogLibrary} from '../src/CatalogLibrary';
import {SurfaceBrowser} from '../src/SurfaceBrowser';
import {usePlanner} from '../src/store';
import {createSamplePlan} from '../src/domain';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
function pointer(element:Element,type:string,id:number,x:number,y=10){const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerType:'touch',pointerId:id,clientX:x,clientY:y,button:0});element.dispatchEvent(e);return e}
it('takes over two-finger gestures, suppresses edits until all fingers lift and cleans up',()=>{
 const canvas=document.createElement('canvas');document.body.append(canvas);const begin=vi.fn(),move=vi.fn(),end=vi.fn(),cancel=vi.fn(),edit=vi.fn();const dispose=bindTouchNavigation(canvas,{begin,move,end,cancel});canvas.addEventListener('pointermove',edit);
 pointer(canvas,'pointerdown',1,0);pointer(canvas,'pointermove',1,10);expect(edit).toHaveBeenCalledTimes(1);
 pointer(canvas,'pointerdown',2,110);expect(begin).toHaveBeenCalledTimes(1);
 pointer(canvas,'pointermove',2,210);expect(move).toHaveBeenLastCalledWith(50,0,.5,110,10);expect(edit).toHaveBeenCalledTimes(1);
 pointer(canvas,'pointerup',2,210);pointer(canvas,'pointermove',1,40);expect(edit).toHaveBeenCalledTimes(1);expect(end).not.toHaveBeenCalled();pointer(canvas,'pointerup',1,40);expect(end).toHaveBeenCalledTimes(1);
 pointer(canvas,'pointerdown',3,0);pointer(canvas,'pointercancel',3,0);expect(cancel).toHaveBeenCalledTimes(1);dispose();pointer(canvas,'pointerdown',4,0);pointer(canvas,'pointerdown',5,20);expect(begin).toHaveBeenCalledTimes(1);canvas.remove();
});
it('lets a phone tap start a draft without starting a library drag',()=>{
 usePlanner.getState().replacePlan(createSamplePlan());usePlanner.setState({search:'Daylight laptop',category:'All'});const drag=vi.fn(),start=vi.fn();render(<CatalogLibrary onBeginDrag={drag} onStartPlacement={start}/>);const card=screen.getByRole('button',{name:'Daylight laptop, drag to place'});pointer(card,'pointerdown',1,10);expect(drag).not.toHaveBeenCalled();fireEvent.click(card,{detail:1});expect(start).toHaveBeenCalledTimes(1);expect(start.mock.calls[0][0].id).toBe('laptop');
});
it('keeps the floor tray dedicated to floors even with a wall selected',()=>{
 usePlanner.getState().replacePlan(createSamplePlan());usePlanner.setState({selectedWallId:'wall'});render(<SurfaceBrowser floorOnly/>);expect(screen.queryByRole('button',{name:'Walls'})).toBeNull();expect(screen.getByRole('button',{name:'Whole floor'})).toBeTruthy();const finish=screen.getAllByRole('button',{name:/^Floor:/})[0];fireEvent.click(finish);expect(usePlanner.getState().tool).toBe('floor-finish');
});

