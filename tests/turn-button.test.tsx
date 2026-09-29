// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { TurnButton } from '../src/TurnButton';
import { animationFrames } from './helpers/animationFrames';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('turns 15 degrees on a tap and closes each held action once on cancel, blur or unmount', () => {
  const frames = animationFrames();
  vi.stubGlobal('PointerEvent', MouseEvent);
  const step = vi.fn(), start = vi.fn(), end = vi.fn();
  const view = render(<TurnButton direction={1} onStep={step} onStart={start} onEnd={end}>Turn</TurnButton>);
  const button = view.getByRole('button');
  fireEvent.click(button, { detail: 0 });
  expect(step).toHaveBeenCalledOnce();
  expect(step).toHaveBeenLastCalledWith(-15);
  expect(start).toHaveBeenCalledOnce();
  expect(end).toHaveBeenCalledOnce();

  const hold = () => {
    step.mockClear(); start.mockClear(); end.mockClear();
    fireEvent.pointerDown(button, { button: 0 });
    expect(step).toHaveBeenLastCalledWith(-15);
    frames.advance(300);
    const firstMovement = step.mock.calls.length;
    frames.advance(32);
    expect(step.mock.calls.length).toBeGreaterThan(firstMovement);
    expect(step.mock.calls.every(([degrees]) => Number.isFinite(degrees) && degrees < 0)).toBe(true);
    expect(start).toHaveBeenCalledOnce();
    expect(end).not.toHaveBeenCalled();
  };
  const expectStopped = () => {
    const calls = step.mock.calls.length;
    expect(frames.pending).toBe(0);
    frames.advance(100);
    expect(step).toHaveBeenCalledTimes(calls);
    // One completed gesture creates one undo boundary, regardless of its frame count.
    expect(end).toHaveBeenCalledOnce();
  };

  hold();
  fireEvent.pointerCancel(button);
  fireEvent.lostPointerCapture(button);
  expectStopped();
  hold();
  fireEvent.blur(window);
  fireEvent.pointerUp(button);
  expectStopped();
  hold();
  view.unmount();
  expectStopped();
});

it('retains numeric angle increments in the precision inspector', () => {
  const step = vi.fn(), view = render(<TurnButton coordinateStep direction={1} onStep={step}>+15°</TurnButton>);
  fireEvent.click(view.getByRole('button'));
  expect(step).toHaveBeenCalledWith(15);
});
