// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SceneAtmospherePanel } from '../src/SceneAtmospherePanel';
import { defaultSceneAtmosphere, type SceneAtmosphereV1 } from '../src/sceneAtmosphere';
afterEach(cleanup);
it('previews and saves a named mood once, keeps sound session-only and discards edits on exit', async () => {
  const apply = vi.fn(), preview = vi.fn(), sound = vi.fn();
  function Harness() { const [value, setValue] = useState<SceneAtmosphereV1>(); return <SceneAtmospherePanel value={value} onChange={v => { apply(v); setValue(v); }} onPreview={preview} onSoundEnabledChange={sound}/>; }
  const view = render(<Harness/>);
  fireEvent.click(screen.getByRole('button', { name: 'Scene mood' })); fireEvent.click(screen.getByRole('button', { name: 'Rainy afternoon' }));
  expect(preview.mock.calls.at(-1)![0].mood.rain).toBeGreaterThan(0); expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Name this mood'), { target: { value: 'Rain at home' } }); fireEvent.click(screen.getByRole('button', { name: 'Keep snapshot' }));
  fireEvent.click(screen.getByLabelText('Ambient sound for this session')); expect(sound).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Apply scene' })); await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][0].savedMoods[0].name).toBe('Rain at home'); expect(apply.mock.calls[0][0]).not.toHaveProperty('soundEnabled');
  fireEvent.click(screen.getByRole('button', { name: 'Morning light' })); fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(apply).toHaveBeenCalledTimes(1); expect(preview.mock.calls.at(-1)![0]).toBeUndefined();
  view.unmount(); expect(preview.mock.calls.at(-1)![0]).toBeUndefined();
});
it('requires missing orientation/location, scrubs without commits, and retains a failed Apply for retry', async () => {
  const apply = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue(undefined), preview = vi.fn();
  render(<SceneAtmospherePanel value={defaultSceneAtmosphere('2026-06-21')} onChange={apply} onPreview={preview}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Sun study' })); expect((screen.getByRole('button', { name: 'Apply scene' }) as HTMLButtonElement).disabled).toBe(true);
  for (const [label, value] of [['Latitude (north + / south −)', '40'], ['Longitude (east + / west −)', '-74'], ['North clockwise from plan up (°)', '0'], ['Standard UTC offset (minutes)', '-300']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByLabelText('Daylight saving is in effect (+60 minutes)'));
  fireEvent.change(screen.getByRole('slider', { name: 'Time of day' }), { target: { value: '600' } }); expect(apply).not.toHaveBeenCalled();
  expect(preview.mock.calls.at(-1)![0].study.minutesLocal).toBe(600);
  fireEvent.click(screen.getByRole('button', { name: 'Apply scene' })); await screen.findByText('Storage unavailable');
  expect(preview.mock.calls.at(-1)![0].mode).toBe('sun-study');
  fireEvent.click(screen.getByRole('button', { name: 'Apply scene' })); await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
});
