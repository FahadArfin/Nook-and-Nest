// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {TurnButton} from '../src/TurnButton';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('supports keyboard clicks and stops held rotation when the window loses focus',()=>{
 let frame:FrameRequestCallback=()=>{},now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frame=fn;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());vi.stubGlobal('PointerEvent',MouseEvent);
 const step=vi.fn(),start=vi.fn(),end=vi.fn(),view=render(<TurnButton direction={1} onStep={step} onStart={start} onEnd={end}>Turn</TurnButton>),button=view.getByRole('button');
 fireEvent.click(button,{detail:0});expect(step).toHaveBeenLastCalledWith(-15);expect(end).toHaveBeenCalledTimes(1);
 fireEvent.pointerDown(button,{button:0});now=300;frame(now);expect(step).toHaveBeenLastCalledWith(-3);fireEvent(window,new Event('blur'));const calls=step.mock.calls.length;frame(320);expect(step).toHaveBeenCalledTimes(calls);expect(end).toHaveBeenCalledTimes(2);vi.restoreAllMocks();
});

it('retains numeric angle increments in the precision inspector',()=>{
 const step=vi.fn(),view=render(<TurnButton coordinateStep direction={1} onStep={step}>+15°</TurnButton>);
 fireEvent.click(view.getByRole('button'));expect(step).toHaveBeenCalledWith(15);
});
