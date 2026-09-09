import {MAX_PLAN_BYTES} from '../src/planValidation.ts';

// D1 limits a complete row to 2 MB; leave room for its identifiers and metadata.
export const MAX_STORED_PLAN_BYTES = 1_900_000;
const encoder = new TextEncoder();
export async function encodeStoredPlan(plan) {
  const document = JSON.stringify(plan), bytes = encoder.encode(document);
  if (bytes.length > MAX_PLAN_BYTES) throw new RangeError('Project exceeds the 8 MB save limit.');
  if (bytes.length < 500_000) return document;
  const compressed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < compressed.length; i += 8192) binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
  const stored = JSON.stringify({storageEncoding:'gzip-v1', data:btoa(binary)});
  if (encoder.encode(stored).length > MAX_STORED_PLAN_BYTES) throw new RangeError('Project is too large for online storage. Export a backup instead.');
  return stored;
}

export async function decodeStoredPlan(document) {
  const stored = JSON.parse(document);
  if (stored.storageEncoding !== 'gzip-v1') return stored;
  const binary = atob(stored.data), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let size = 0; const chunks = [];
  for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.length;
    if (size > MAX_PLAN_BYTES) { await reader.cancel(); throw new RangeError('Stored project exceeds the save limit.'); }
    chunks.push(value);
  }
  const expanded = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { expanded.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(expanded));
}
