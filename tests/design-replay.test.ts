import { afterEach, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createBlankPlan } from '../src/domain';
import { validatePlan } from '../src/planValidation';
import { captureDesignMilestone, saveDesignReplayView, setMilestoneRecording } from '../src/designHistory';
import { exportDesignReplay, MAX_REPLAY_FRAME_BYTES, type DesignReplayBridge, type ReplayFrameRequest, type ReplayCapturedFrame } from '../src/designReplay';
afterEach(() => vi.useRealTimers());
function source() {
  let plan = setMilestoneRecording(createBlankPlan('Replay', 'metric'), true, validatePlan);
  plan = captureDesignMilestone(plan, 'Before <private reference>', plan.floors[0].id, validatePlan, { id: 'first', checkpointId: 'first-frame' });
  plan = { ...plan, furniture: [{ id: 'chair', catalogId: 'chair', floorId: plan.floors[0].id, x: 0, z: 0, rotation: 0, widthMm: 500, depthMm: 500, heightMm: 800, variant: 'oak' }] };
  plan = captureDesignMilestone(plan, 'After', plan.floors[0].id, validatePlan, { id: 'second', checkpointId: 'second-frame' });
  return saveDesignReplayView(plan, { version: 1, kind: 'orbit', floorId: plan.floors[0].id, target: { x: 0, y: 0, z: 0 }, alpha: .7, beta: 1, radius: 12, mode: 0, fov: .8 }, validatePlan);
}
function image(width = 1280, height = 720, size = 24) {
  const bytes = new Uint8Array(size); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); bytes.set([73, 72, 68, 82], 12); const view = new DataView(bytes.buffer); view.setUint32(16, width); view.setUint32(20, height);
  return { blob: new Blob([bytes], { type: 'image/png' }), width, height };
}
it('exports selected images in order with labelled metadata, excludes editable/private reference data and always restores the view', async () => {
  const plan = source(), before = JSON.stringify(plan), bridge = { show: vi.fn(), capture: vi.fn(async (_request: ReplayFrameRequest) => image()), restore: vi.fn() } satisfies DesignReplayBridge;
  const blob = await exportDesignReplay(plan, ['first', 'second'], bridge, new AbortController().signal);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer())), manifest = JSON.parse(strFromU8(files['manifest.json']));
  expect(Object.keys(files)).toEqual(['01-milestone.png', '02-milestone.png', 'manifest.json', 'index.html']);
  expect(manifest.frames.map((f: { title: string }) => f.title)).toEqual(['Before <private reference>', 'After']);
  expect(strFromU8(files['index.html'])).toContain('Before &lt;private reference&gt;'); expect(strFromU8(files['manifest.json'])).not.toContain('snapshot');
  expect(bridge.capture.mock.calls[0][0].label).toContain('Milestone 1/2'); expect(bridge.restore).toHaveBeenCalledTimes(1); expect(JSON.stringify(plan)).toBe(before);
});
it('cancels an in-flight renderer immediately, aborts its signal and restores once without generating more frames', async () => {
  const abort = new AbortController(); let captureSignal: AbortSignal | undefined;
  const bridge: DesignReplayBridge = { show: vi.fn(), capture: vi.fn((_request, signal) => { captureSignal = signal; return new Promise<ReplayCapturedFrame>(() => {}); }), restore: vi.fn() };
  const result = exportDesignReplay(source(), ['first', 'second'], bridge, abort.signal);
  await vi.waitFor(() => expect(bridge.capture).toHaveBeenCalledTimes(1)); abort.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' }); expect(captureSignal!.aborted).toBe(true); expect(bridge.restore).toHaveBeenCalledTimes(1); expect(bridge.show).toHaveBeenCalledTimes(1);
});
it('rejects oversized/mislabeled frames and renderer failures while restoring the working view', async () => {
  for (const capture of [async () => image(1280, 720, MAX_REPLAY_FRAME_BYTES + 1), async () => ({ ...image(4, 4), width: 1280, height: 720 }), async () => { throw new Error('Capture failed'); }]) {
    const bridge = { show: vi.fn(), capture, restore: vi.fn() };
    await expect(exportDesignReplay(source(), ['first'], bridge, new AbortController().signal)).rejects.toThrow(); expect(bridge.restore).toHaveBeenCalledTimes(1);
  }
});
it('times out an unresponsive renderer and reports restoration failure instead of claiming a safe restored view', async () => {
  vi.useFakeTimers(); const bridge = { show: vi.fn(), capture: vi.fn(() => new Promise<ReturnType<typeof image>>(() => {})), restore: vi.fn() };
  const request = exportDesignReplay(source(), ['first'], bridge, new AbortController().signal), checked = expect(request).rejects.toThrow(/too long/);
  await vi.advanceTimersByTimeAsync(30_001); await checked; expect(bridge.restore).toHaveBeenCalledTimes(1);
  const failure = { show: vi.fn(), capture: async () => image(), restore: vi.fn(async () => { throw new Error('View restoration failed'); }) };
  await expect(exportDesignReplay(source(), ['first'], failure, new AbortController().signal)).rejects.toThrow('View restoration failed');
});
