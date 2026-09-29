// @vitest-environment jsdom
import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { ZoomControl } from '../src/ZoomControl';
import { animationFrames } from './helpers/animationFrames';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('zooms in both directions by keyboard or hold and stops on cancel, blur and unmount', () => {
  const frames = animationFrames(), zoom = vi.fn();
  vi.stubGlobal('PointerEvent', MouseEvent);
  const view = render(<ZoomControl onZoom={zoom}/>);
  const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
  const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
  for (const button of [zoomIn, zoomOut]) button.setPointerCapture = vi.fn();

  fireEvent.click(zoomIn, { detail: 0 });
  expect(zoom).toHaveBeenCalledOnce();
  expect(zoom.mock.lastCall![0]).toBeLessThan(1);
  fireEvent.click(zoomOut, { detail: 0 });
  expect(zoom.mock.lastCall![0]).toBeGreaterThan(1);

  const hold = (button: HTMLElement, inward: boolean) => {
    zoom.mockClear();
    fireEvent.pointerDown(button, { button: 0 });
    frames.advance(32);
    const firstMovement = zoom.mock.calls.length;
    expect(firstMovement).toBeGreaterThan(0);
    frames.advance(24);
    expect(zoom.mock.calls.length).toBeGreaterThan(firstMovement);
    expect(zoom.mock.calls.every(([factor]) => Number.isFinite(factor) && factor > 0 && (inward ? factor < 1 : factor > 1))).toBe(true);
  };
  const expectStopped = () => {
    const calls = zoom.mock.calls.length;
    expect(frames.pending).toBe(0);
    frames.advance(100);
    expect(zoom).toHaveBeenCalledTimes(calls);
  };

  hold(zoomIn, true);
  fireEvent.pointerCancel(zoomIn);
  expectStopped();
  hold(zoomOut, false);
  fireEvent.blur(window);
  expectStopped();
  hold(zoomIn, true);
  view.unmount();
  expectStopped();
});
