import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

import * as pipeline from '../scripts/lib/model-pipeline-inspect.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function solidPng(size, value = 128) {
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const name = Buffer.from(type), header = Buffer.alloc(4), checksum = Buffer.alloc(4);
    header.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([header, name, data, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((size * 3 + 1) * size, value);
  for (let row = 0; row < size; row++) pixels[row * (size * 3 + 1)] = 0;
  return Buffer.concat([png.subarray(0, 8), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const tiledPng = solidPng(1024);

function glbFixture(mutate = () => {}, textureBytes = png) {
  const chunks = [];
  const gltf = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ scale: [.5, .5, .5], children: [1] }, { matrix: [2,0,0,0,0,.78,0,0,0,0,.85,0,0,.78,0,1], mesh: 0 }],
    buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
    meshes: [{ primitives: [] }],
    materials: ['wood-honey-textured', 'upholstery-textured'].map(name => ({ name,
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 0 } },
      normalTexture: { index: 0 }, occlusionTexture: { index: 0 } })),
    textures: [{ source: 0 }], images: [],
  };
  const append = bytes => {
    const offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes, Buffer.alloc((4 - bytes.length % 4) % 4));
    return gltf.bufferViews.length - 1;
  };
  const values = (data, type, components, componentType = 5126) => {
    const bytes = Buffer.alloc(data.length * (componentType === 5126 ? 4 : 2));
    data.forEach((value, i) => componentType === 5126 ? bytes.writeFloatLE(value, i * 4) : bytes.writeUInt16LE(value, i * 2));
    gltf.accessors.push({ bufferView: append(bytes), componentType, count: data.length / components, type });
    return gltf.accessors.length - 1;
  };
  const position = values([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1], 'VEC3', 3);
  // The declared bounds deliberately lie: inspection must read the binary vertices.
  gltf.accessors[position].min = [0,0,0]; gltf.accessors[position].max = [0,0,0];
  const normal = values(Array.from({ length: 8 }, () => [0,1,0]).flat(), 'VEC3', 3);
  const uv = values(Array.from({ length: 8 }, () => [0,0]).flat(), 'VEC2', 2);
  const indices = values([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2], 'SCALAR', 1, 5123);
  for (let material = 0; material < 2; material++) gltf.meshes[0].primitives.push({ attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: uv }, indices, material });
  gltf.images.push({ bufferView: append(textureBytes), mimeType: 'image/png' });
  const binary = Buffer.concat(chunks); gltf.buffers[0].byteLength = binary.length;
  mutate(gltf, binary);
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 32);
  const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + jsonPadding.length + 8 + binary.length, 8);
  header.writeUInt32LE(json.length + jsonPadding.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, jsonPadding, binHeader, binary]);
}

function fixture(t, mutate) {
  const root = mkdtempSync(path.join(tmpdir(), 'model-pipeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => { mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); writeFileSync(path.join(root, name), data); };
  const specPath = 'assets-source/model-pipeline/sofa.spec.json';
  const spec = { version: 1, recipe: 'sofa', seed: 4, sourceBlend: 'assets-source/input.blend', dimensionsM: [2,.85,.78],
    materialKeys: ['wood-honey-textured','upholstery-textured'], bake: { resolution: 1, samples: 16, cageExtrusionM: .018, maxRayDistanceM: .045 },
    budgets: { targetTriangles: 50000, maxTriangles: 80000, maxGlbBytes: 12582912, maxPrimitives: 8 },
    outputs: { sourceBlend: 'assets-source/output.blend', glb: 'public/experiments/sofa.glb', receipt: 'assets-source/model-pipeline/sofa.receipt.json', bakeDirectory: 'assets-source/model-pipeline/bakes' } };
  write(specPath, JSON.stringify(spec));
  write(spec.sourceBlend, Buffer.concat([Buffer.from('BLENDER-v300'), Buffer.alloc(1024)]));
  write(spec.outputs.sourceBlend, Buffer.concat([Buffer.from('BLENDER-v300'), Buffer.alloc(1024, 1)]));
  write(spec.outputs.glb, glbFixture(mutate));
  const record = name => ({ path: name, sha256: sha(readFileSync(path.join(root, name))) });
  const maps = [];
  for (const materialKey of spec.materialKeys) for (const kind of ['normal','baseColor','roughness','ao','orm']) {
    const name = `${spec.outputs.bakeDirectory}/${materialKey}-${kind}.png`; write(name, png);
    maps.push({ ...record(name), materialKey, kind });
  }
  const renders = ['front','rear','underside','clay','detail'].map(view => {
    const name = `assets-source/model-pipeline/renders/${view}.png`; write(name, png); return { ...record(name), view };
  });
  const receipt = { version: 1, spec: record(specPath), sourceBlend: record(spec.sourceBlend), outputBlend: record(spec.outputs.sourceBlend), glb: record(spec.outputs.glb), maps, renders };
  const saveReceipt = () => write(spec.outputs.receipt, JSON.stringify(receipt)); saveReceipt();
  return { root, specPath, spec, receipt, saveReceipt, write, record };
}

function tiledFixture(t, mutate = () => {}) {
  const f = fixture(t);
  delete f.spec.bake; delete f.spec.outputs.bakeDirectory;
  f.spec.surface = { method: 'tiled-pbr', resolution: 1024 };
  f.write(f.specPath, JSON.stringify(f.spec)); f.receipt.spec = f.record(f.specPath);
  f.receipt.surface = { ...f.spec.surface };
  f.write(f.spec.outputs.glb, glbFixture((g,b) => {
    g.accessors[0].min = [-1,-1,-1]; g.accessors[0].max = [1,1,1];
    mutate(g,b);
  }, tiledPng));
  f.receipt.glb = f.record(f.spec.outputs.glb);
  f.receipt.maps = [];
  for (const materialKey of f.spec.materialKeys) for (const kind of ['baseColor','normal','orm']) {
    const name = `public/textures/realism/${materialKey}-${kind}.png`; f.write(name, tiledPng);
    f.receipt.maps.push({ ...f.record(name), materialKey, kind, method: 'retained tiled PBR map' });
  }
  f.receipt.inputs = f.receipt.maps.map(({ path: name }) => ({ ...f.record(name), role: 'material' }));
  f.saveReceipt(); return f;
}

test('measures transformed binary vertices, preserving catalog dimensions and floor origin', t => {
  assert.equal(typeof pipeline.inspectPipeline, 'function', 'inspector is available');
  const f = fixture(t); const result = pipeline.inspectPipeline(f.specPath, { root: f.root });
  assert.equal(result.geometry.triangles, 24);
  assert.deepEqual(result.geometry.dimensionsMm.map(Math.round), [2000,850,780]);
  assert.ok(Math.abs(result.geometry.boundsM.min[1]) < .00015);
  assert.equal(result.visualReview.status, 'missing');
  assert.throws(() => pipeline.requireReady(f.specPath, { root: f.root }), /review/i);
});

test('rejects invalid binary coordinates, UVs, indices and missing exported normal maps', t => {
  assert.equal(typeof pipeline.inspectPipeline, 'function', 'inspector is available');
  for (const [name, mutate, expected] of [
    ['position', (g,b) => b.writeFloatLE(NaN, g.bufferViews[g.accessors[0].bufferView].byteOffset), /finite/i],
    ['UV', (g,b) => b.writeFloatLE(Infinity, g.bufferViews[g.accessors[2].bufferView].byteOffset), /finite/i],
    ['index', (g,b) => b.writeUInt16LE(99, g.bufferViews[g.accessors[3].bufferView].byteOffset), /index/i],
    ['normal map', g => delete g.materials[0].normalTexture, /normal/i],
    ['origin', g => { g.nodes[0].translation = [.01,0,0]; }, /origin/i],
  ]) {
    const f = fixture(t, mutate); assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), expected, name);
  }
});

test('approval requires every view and becomes stale when the artifact or source changes', t => {
  assert.equal(typeof pipeline.acceptReview, 'function', 'review gate is available');
  const f = fixture(t);
  const notes = { reviewer: 'fixture-reviewer', decision: 'approved', views: Object.fromEntries(f.receipt.renders.map(({ view }) => [view, `Examined ${view}: acceptable construction and material detail.`])), limitations: ['Synthetic fixture only.'] };
  const incomplete = structuredClone(notes); delete incomplete.views.underside;
  assert.throws(() => pipeline.acceptReview(f.specPath, incomplete, { root: f.root }), /underside/i);
  pipeline.acceptReview(f.specPath, notes, { root: f.root });
  assert.equal(pipeline.requireReady(f.specPath, { root: f.root }).visualReview.status, 'approved');
  f.write(f.spec.sourceBlend, Buffer.concat([Buffer.from('BLENDER-v300'), Buffer.alloc(1024, 7)]));
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /sourceBlend.*hash|hash.*sourceBlend/i);
  f.receipt.sourceBlend = f.record(f.spec.sourceBlend); f.saveReceipt();
  assert.throws(() => pipeline.requireReady(f.specPath, { root: f.root }), /stale/i);
});

test('rejects output traversal and symlink escapes before writing a review', t => {
  assert.equal(typeof pipeline.inspectPipeline, 'function', 'inspector is available');
  const f = fixture(t); f.spec.outputs.receipt = '../escape.json'; f.write(f.specPath, JSON.stringify(f.spec));
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /inside|escape|relative/i);
  const outside = mkdtempSync(path.join(tmpdir(), 'pipeline-outside-')); t.after(() => rmSync(outside, { recursive: true, force: true }));
  const link = path.join(f.root, 'outside-link');
  try { symlinkSync(outside, link, 'junction'); } catch (error) { if (error.code === 'EPERM') return; throw error; }
  f.spec.outputs.receipt = 'outside-link/receipt.json'; f.write(f.specPath, JSON.stringify(f.spec));
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /inside|escape|symlink/i);
});

test('Khronos validation rejects format errors that pass project envelope checks', async () => {
  assert.equal(typeof pipeline.validateKhronosGlb, 'function', 'official validator is available');
  // Only declared bounds are wrong. Binary geometry is valid, but glTF forbids the false declarations.
  await assert.rejects(() => pipeline.validateKhronosGlb(glbFixture()), /Khronos.*error/i);
  const valid = glbFixture(g => { g.accessors[0].min = [-1,-1,-1]; g.accessors[0].max = [1,1,1]; });
  const report = await pipeline.validateKhronosGlb(valid);
  assert.equal(report.numErrors, 0);
  assert.equal(typeof report.numWarnings, 'number');
  assert.ok(Array.isArray(report.messages));
});

test('changed builder code invalidates its receipt and any prior review', t => {
  assert.equal(typeof pipeline.inspectPipeline, 'function', 'inspector is available');
  const f = fixture(t); const builder = 'tools/blender/detail_pipeline/core.py'; f.write(builder, '# original builder\n');
  f.receipt.inputs = [{ ...f.record(builder), role: 'builder' }]; f.saveReceipt();
  pipeline.inspectPipeline(f.specPath, { root: f.root });
  f.write(builder, '# modified builder\n');
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /input.*hash|hash.*input/i);
});

test('retained wood textures must be hash-bound material inputs and use an exported UV set', t => {
  const f = fixture(t, g => {
    g.meshes[0].primitives[0].attributes.TEXCOORD_1 = g.meshes[0].primitives[0].attributes.TEXCOORD_0;
    g.materials[0].normalTexture.texCoord = 1;
  });
  const original = 'assets-source/materials/original-wood.png'; f.write(original, png);
  const map = f.receipt.maps.find(map => map.materialKey === 'wood-honey-textured' && map.kind === 'normal');
  Object.assign(map, f.record(original)); f.saveReceipt();
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /material input|bakeDirectory/i);
  f.receipt.inputs = [{ ...f.record(original), role: 'material' }]; f.saveReceipt();
  assert.equal(pipeline.inspectPipeline(f.specPath, { root: f.root }).geometry.triangles, 24);
});

test('native tiled PBR accepts real 1K retained maps without claiming an atlas bake', async t => {
  const f = tiledFixture(t);
  const result = pipeline.inspectPipeline(f.specPath, { root: f.root });
  assert.equal(result.geometry.images[0].width, 1024);
  assert.equal(result.geometry.images[0].height, 1024);
  assert.equal(result.geometry.materialMaps.length, 8);
  assert.equal((await pipeline.validateKhronosGlb(readFileSync(path.join(f.root, f.spec.outputs.glb)))).numErrors, 0);
  const notes = { reviewer: 'fixture-reviewer', decision: 'approved', views: Object.fromEntries(f.receipt.renders.map(({ view }) => [view, `Examined ${view}: native geometry and tiled material inspected.`])), limitations: ['Synthetic fixture only.'] };
  pipeline.acceptReview(f.specPath, notes, { root: f.root });
  assert.equal(pipeline.requireReady(f.specPath, { root: f.root }).visualReview.status, 'approved');
  f.receipt.inputs.splice(0, 1); f.saveReceipt();
  assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /hash-bound retained material input/);
});

test('native tiled PBR rejects ambiguous modes, fake bake claims and stale surface metadata', t => {
  for (const [name, mutate, expected] of [
    ['unknown mode', f => { f.spec.surface.method = 'bake-ish'; }, /unsupported explicit surface method/],
    ['invalid resolution', f => { f.spec.surface.resolution = 1023; }, /power of two/],
    ['bake parameters', f => { f.spec.bake = { resolution: 1024 }; }, /must not declare an atlas bake/],
    ['bake directory', f => { f.spec.outputs.bakeDirectory = 'assets-source/bakes'; }, /must not declare an atlas bake/],
    ['missing receipt mode', f => { delete f.receipt.surface; }, /surface method or resolution differs/],
    ['mismatched receipt mode', f => { f.receipt.surface.resolution = 2048; }, /surface method or resolution differs/],
    ['receipt bake claim', f => { f.receipt.bake = { passes: ['normal'] }; }, /must not claim an atlas bake/],
  ]) {
    const f = tiledFixture(t); mutate(f);
    f.write(f.specPath, JSON.stringify(f.spec)); f.receipt.spec = f.record(f.specPath); f.saveReceipt();
    assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), expected, name);
  }
});

test('native tiled maps require wood and fabric triplets, declared resolution and exact embedded ORM bytes', t => {
  for (const materialKey of ['wood-honey-textured', 'upholstery-textured']) {
    const f = tiledFixture(t);
    f.receipt.maps = f.receipt.maps.filter(map => !(map.materialKey === materialKey && map.kind === 'orm')); f.saveReceipt();
    assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /missing.*orm tiled texture/);
  }
  {
    const f = tiledFixture(t), map = f.receipt.maps[0];
    f.receipt.maps.push({ ...map, kind: 'ao' }); f.saveReceipt();
    assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), /packed orm only/);
  }
  for (const [label, replacement, expected] of [
    ['wrong dimensions', png, /tiled texture dimensions differ/],
    ['changed ORM', solidPng(1024, 64), /orm embedded bytes do not match/],
  ]) {
    const f = tiledFixture(t), map = f.receipt.maps.find(map => map.materialKey === 'upholstery-textured' && map.kind === 'orm');
    f.write(map.path, replacement); Object.assign(map, f.record(map.path));
    Object.assign(f.receipt.inputs.find(input => input.path === map.path), f.record(map.path)); f.saveReceipt();
    assert.throws(() => pipeline.inspectPipeline(f.specPath, { root: f.root }), expected, label);
  }
});
