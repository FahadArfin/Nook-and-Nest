// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,fireEvent,cleanup,screen} from '@testing-library/react';
import {ZoomControl} from '../src/ZoomControl';
it('supports keyboard steps and stops held zoom on cancel, blur and unmount',()=>{
 const zoom=vi.fn(),cancel=vi.fn();let tick:FrameRequestCallback=()=>{};vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{tick=f;return 1});vi.stubGlobal('cancelAnimationFrame',cancel);vi.stubGlobal('PointerEvent',MouseEvent);
 try{const view=render(<ZoomControl onZoom={zoom}/>),button=screen.getByRole('button',{name:'Zoom in'});button.setPointerCapture=vi.fn();fireEvent.click(button,{detail:0});expect(zoom).toHaveBeenCalledTimes(1);expect(zoom.mock.calls[0][0]).toBeLessThan(1);fireEvent.pointerDown(button,{button:0});tick(performance.now()+16);expect(zoom.mock.calls.length).toBe(3);fireEvent.pointerCancel(button);expect(cancel).toHaveBeenLastCalledWith(1);fireEvent.pointerDown(button,{button:0});fireEvent.blur(window);expect(cancel).toHaveBeenLastCalledWith(1);view.unmount();expect(cancel).toHaveBeenCalled();}finally{cleanup();vi.unstubAllGlobals()}
});
