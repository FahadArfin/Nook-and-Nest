import { strToU8, zipSync } from 'fflate';
import { MAX_DESIGN_MILESTONES, milestonePreview, type DesignHistoryPreview, type HistoryPlan } from './designHistory';

export const MAX_REPLAY_FRAME_BYTES = 4_000_000;
export const MAX_REPLAY_EXPORT_BYTES = 20_000_000;
export const REPLAY_SIZES = [{ width: 1280, height: 720, label: 'HD · 1280 × 720' }, { width: 1920, height: 1080, label: 'Full HD · 1920 × 1080' }] as const;
export interface ReplayFrameRequest { width: number; height: number; label: string; index: number; total: number }
export interface ReplayCapturedFrame { blob: Blob; width: number; height: number }
export interface DesignReplayBridge {
  /** Replace the single staged scene. Must ignore stale/aborted requests before mutation. */
  show(preview: DesignHistoryPreview, signal: AbortSignal): void | Promise<void>;
  /** Canvas only; burn the label into the image. Never capture the document or dialogs. */
  capture(request: ReplayFrameRequest, signal: AbortSignal): Promise<ReplayCapturedFrame>;
  /** Restore exact editor plan, selected floor, camera, atmosphere and interaction mode. */
  restore(): void | Promise<void>;
}
export function throwIfReplayAborted(signal: AbortSignal): void { if (signal.aborted) throw new DOMException('Replay export cancelled.', 'AbortError'); }
/** Every renderer operation is cancellable and has a 30s deadline. Late work must honor its signal. */
async function operation<T>(work: (signal: AbortSignal) => Promise<T> | T, signal: AbortSignal): Promise<T> {
  throwIfReplayAborted(signal);
  const local = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const cancel = () => { local.abort(); reject(new DOMException('Replay export cancelled.', 'AbortError')); };
    const timer = setTimeout(() => { local.abort(); reject(new Error('The replay renderer took too long. Try fewer items or HD resolution.')); }, 30_000);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => { throwIfReplayAborted(local.signal); return work(local.signal); }).then(resolve, reject).finally(() => { clearTimeout(timer); signal.removeEventListener('abort', cancel); });
    local.signal.addEventListener('abort', () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); }, { once: true });
  });
}
const escape = (v: string) => v.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function imageDimensions(image: Uint8Array, png: boolean): { width: number; height: number } | undefined {
  if (png) {
    if (image.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => image[i] === b) || ![73, 72, 68, 82].every((b, i) => image[12 + i] === b)) return;
    const data = new DataView(image.buffer, image.byteOffset, image.byteLength); return { width: data.getUint32(16), height: data.getUint32(20) };
  }
  if (image[0] !== 255 || image[1] !== 216) return;
  let offset = 2;
  while (offset + 3 < image.length) {
    if (image[offset++] !== 255) return;
    while (image[offset] === 255) offset++;
    const marker = image[offset++]; if (marker === 217 || marker === 218) return;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = image[offset] * 256 + image[offset + 1]; if (length < 2 || offset + length > image.length) return;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7) return { height: image[offset + 3] * 256 + image[offset + 4], width: image[offset + 5] * 256 + image[offset + 6] };
    offset += length;
  }
}
export async function exportDesignReplay(plan: HistoryPlan, selectedIds: readonly string[], bridge: DesignReplayBridge, signal: AbortSignal, options: { width?: number; height?: number; onProgress?: (complete: number, total: number) => void } = {}): Promise<Blob> {
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (!REPLAY_SIZES.some(size => size.width === width && size.height === height)) throw new Error('Choose HD or Full HD image-sequence export.');
  if (!plan.designHistory?.replayView) throw new Error('Save the replay camera before exporting.');
  if (selectedIds.length < 1 || selectedIds.length > MAX_DESIGN_MILESTONES || new Set(selectedIds).size !== selectedIds.length) throw new Error('Choose between 1 and 10 different milestones.');
  // Copy selection and snapshots once: subsequent editing/deletion cannot alter an active export.
  const previews = structuredClone(selectedIds.map(id => milestonePreview(plan, id)));
  const files: Record<string, Uint8Array> = {}, frames: { file: string; title: string; phase: string; revision: number; capturedAt: string; width: number; height: number }[] = [];
  let bytes = 0;
  try {
    throwIfReplayAborted(signal);
    for (let index = 0; index < previews.length; index++) {
      const preview = previews[index], label = `Milestone ${index + 1}/${previews.length} · ${preview.label}`;
      throwIfReplayAborted(signal); await operation(local => bridge.show(preview, local), signal); throwIfReplayAborted(signal);
      const captured = await operation(local => bridge.capture({ width, height, label, index, total: previews.length }, local), signal); throwIfReplayAborted(signal);
      if (captured.width !== width || captured.height !== height || !['image/png', 'image/jpeg'].includes(captured.blob.type) || captured.blob.size < 8 || captured.blob.size > MAX_REPLAY_FRAME_BYTES) throw new Error('A replay image is unsupported or exceeds 4 MB. Try HD or JPEG capture.');
      bytes += captured.blob.size;
      if (bytes > MAX_REPLAY_EXPORT_BYTES - 100_000) throw new Error('This image sequence exceeds 20 MB. Choose fewer milestones or HD resolution.');
      const image = new Uint8Array(await captured.blob.arrayBuffer()); throwIfReplayAborted(signal);
      const png = captured.blob.type === 'image/png';
      const dimensions = imageDimensions(image, png);
      if (!dimensions || dimensions.width !== width || dimensions.height !== height) throw new Error('The captured image has invalid data or unexpected dimensions.');
      const file = `${String(index + 1).padStart(2, '0')}-milestone.${png ? 'png' : 'jpg'}`;
      files[file] = image; frames.push({ file, title: preview.label, phase: preview.phase, revision: preview.revision, capturedAt: preview.checkpoint.capturedAt, width, height });
      options.onProgress?.(index + 1, previews.length);
    }
    files['manifest.json'] = strToU8(JSON.stringify({ version: 1, kind: 'nook-design-milestones', note: 'Manual design milestones. Images illustrate saved editable designs, not existing-property photographs or construction instructions.', frames }, null, 2));
    files['index.html'] = strToU8(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design milestones</title><style>body{font:16px system-ui;max-width:1000px;margin:32px auto;padding:16px;background:#f7f1e3;color:#344238}img{width:100%;height:auto}figure{margin:32px 0}figcaption{padding:12px 0}small{display:block;margin-top:6px}</style><h1>Design milestones</h1><p>Saved design illustrations. This package contains images only, with no source references or project geometry.</p>${frames.map((f, i) => `<figure><img src="${f.file}" alt="${escape(f.title)}"><figcaption>${i + 1}. ${escape(f.title)}<small>Phase: ${f.phase} · revision ${f.revision} · saved ${escape(f.capturedAt)}</small></figcaption></figure>`).join('')}</html>`);
    throwIfReplayAborted(signal);
    const result = zipSync(files, { level: 0 }); // PNG/JPEG are already compressed; keep CPU bounded.
    if (result.byteLength > MAX_REPLAY_EXPORT_BYTES) throw new Error('This image sequence exceeds 20 MB. Choose fewer milestones.');
    throwIfReplayAborted(signal);
    return new Blob([result as BlobPart], { type: 'application/zip' });
  } finally {
    // The parent callback owns exact camera/view restoration even after abort or capture failure.
    await bridge.restore();
  }
}
