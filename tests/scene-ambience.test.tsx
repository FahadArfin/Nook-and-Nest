// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { defaultSceneAtmosphere, resolveAtmosphere } from '../src/sceneAtmosphere';
import { useSceneAmbience } from '../src/useSceneAmbience';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('creates audio only after opt-in, reuses the context across weather changes, pauses hidden tabs and closes on mute/unmount', () => {
  const contexts: FakeContext[] = [];
  function node() { const n = { connect: vi.fn(() => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 0 }, frequency: { value: 0 } }; return n; }
  class FakeContext {
    state = 'running'; sampleRate = 100; destination = {};
    suspend = vi.fn(async () => { this.state = 'suspended'; }); resume = vi.fn(async () => { this.state = 'running'; }); close = vi.fn(async () => { this.state = 'closed'; });
    createGain = vi.fn(node); createOscillator = vi.fn(node); createBufferSource = vi.fn(node); createBiquadFilter = vi.fn(node);
    createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(200) }));
    constructor() { contexts.push(this); }
  }
  vi.stubGlobal('AudioContext', FakeContext); let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const value = defaultSceneAtmosphere(); value.mode = 'mood'; value.mood.rain = .5; const frame = resolveAtmosphere(value)!;
  const hook = renderHook(({ enabled, rain }) => useSceneAmbience(enabled, { ...frame, rain }), { initialProps: { enabled: false, rain: .5 } });
  expect(contexts).toHaveLength(0); hook.rerender({ enabled: true, rain: .5 }); expect(contexts).toHaveLength(1);
  const context = contexts[0]; hook.rerender({ enabled: true, rain: 1 }); expect(contexts).toHaveLength(1);
  hidden = true; document.dispatchEvent(new Event('visibilitychange')); expect(context.suspend).toHaveBeenCalledTimes(1);
  hidden = false; document.dispatchEvent(new Event('visibilitychange')); expect(context.resume).toHaveBeenCalledTimes(2);
  hook.rerender({ enabled: false, rain: 1 }); expect(context.close).toHaveBeenCalledTimes(1);
  for (const result of [...context.createOscillator.mock.results, ...context.createBufferSource.mock.results]) expect(result.value.stop).toHaveBeenCalledTimes(1);
  document.dispatchEvent(new Event('visibilitychange')); expect(context.resume).toHaveBeenCalledTimes(2);
  hook.rerender({ enabled: true, rain: 0 }); expect(contexts).toHaveLength(2); hook.unmount(); expect(contexts[1].close).toHaveBeenCalledTimes(1);
});
