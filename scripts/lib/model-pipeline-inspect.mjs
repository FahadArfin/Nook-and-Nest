// Integrity checks are deliberately separate from the explicit visual review attestation.
import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_VIEWS = Object.freeze(['front', 'rear', 'underside', 'clay', 'detail']);
const DEFAULT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HASH = /^[a-f0-9]{64}$/;
const TOLERANCE_M = .00015;
const TEXTURED_MATERIAL = /upholstery|wood|oak|walnut/i;
const TILED_MAP_KINDS = Object.freeze(['baseColor', 'normal', 'orm']);
const isTiledSurface = spec => spec.surface?.method === 'tiled-pbr';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

/** Reject traversal, Windows device/stream paths, and existing symlink escapes. */
export function resolveRepoPath(root, relative) {
  assert(typeof relative === 'string' && relative.length > 0 && relative.length < 1024, 'Artifact path must be repository-relative');
  assert(!path.isAbsolute(relative) && !path.win32.isAbsolute(relative) && !relative.includes(':') && !relative.includes('\0'), 'Artifact path must be repository-relative');
  const parts = relative.replaceAll('\\', '/').split('/');
  assert(parts.every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)), 'Artifact path must stay inside repository without traversal');
  const absolute = path.resolve(root, ...parts);
  assert(inside(root, absolute), 'Artifact path escapes repository');
  let ancestor = absolute;
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    assert(parent !== ancestor, 'Artifact path has no existing ancestor'); ancestor = parent;
  }
  assert(inside(realpathSync(root), realpathSync(ancestor)), 'Artifact symlink escapes repository');
  return absolute;
}

function readJson(filename, label) {
  assert(statSync(filename).size <= 2 * 1024 * 1024, `${label}: JSON exceeds 2 MiB`);
  return JSON.parse(readFileSync(filename, 'utf8'));
}

function fileHash(filename) {
  const digest = createHash('sha256'); const descriptor = openSync(filename, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try { let count; while ((count = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, count)); }
  finally { closeSync(descriptor); }
  return digest.digest('hex');
}

function validateRecord(root, record, label, expectedPath) {
  assert(record && HASH.test(record.sha256), `${label}: missing SHA256`);
  const absolute = resolveRepoPath(root, record.path);
  if (expectedPath) assert.equal(absolute, resolveRepoPath(root, expectedPath), `${label}: path does not match spec`);
  assert(statSync(absolute).isFile(), `${label}: expected a file`);
  assert.equal(fileHash(absolute), record.sha256, `${label}: file hash differs from build receipt`);
  return absolute;
}

function assertBlend(filename, label) {
  assert(statSync(filename).size > 12, `${label}: empty Blender source`);
  const descriptor = openSync(filename, 'r'); const header = Buffer.alloc(12);
  try { readSync(descriptor, header, 0, header.length, 0); } finally { closeSync(descriptor); }
  const blender = header.toString('ascii', 0, 7) === 'BLENDER';
  const gzip = header[0] === 0x1f && header[1] === 0x8b;
  const zstd = header.readUInt32LE(0) === 0xfd2fb528;
  assert(blender || gzip || zstd, `${label}: not a Blender file or supported compressed Blender container`);
}

/** Decode image dimensions from the embedded PNG/JPEG header, never image names. */
export function imageDimensions(bytes, label = 'image') {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    assert.equal(bytes.readUInt32BE(8), 13, `${label}: invalid PNG IHDR`);
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${label}: PNG missing IHDR`);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    assert(width > 0 && height > 0 && width <= 16384 && height <= 16384, `${label}: invalid PNG dimensions`);
    return { width, height, mimeType: 'image/png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      assert(bytes[offset++] === 0xff, `${label}: invalid JPEG marker`);
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      assert(offset + 2 <= bytes.length, `${label}: truncated JPEG`);
      const length = bytes.readUInt16BE(offset);
      assert(length >= 2 && offset + length <= bytes.length, `${label}: invalid JPEG segment`);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        assert(length >= 8, `${label}: invalid JPEG frame`);
        const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5);
        assert(width > 0 && height > 0 && width <= 16384 && height <= 16384, `${label}: invalid JPEG dimensions`);
        return { width, height, mimeType: 'image/jpeg' };
      }
      offset += length;
    }
  }
  throw new Error(`${label}: unsupported or malformed PNG/JPEG image`);
}

/** Independent format validation supplements project-specific binary and receipt checks. */
export async function validateKhronosGlb(bytes, { uri = 'model.glb' } = {}) {
  const validator = await import('gltf-validator');
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri, format: 'glb', maxIssues: 200, writeTimestamp: false,
    externalResourceFunction: () => Promise.reject(new Error('External glTF resources are not permitted')) });
  const issues = report.issues;
  assert(issues && Number.isInteger(issues.numErrors), 'Khronos validator returned no issue counts');
  const diagnostics = { validatorVersion: validator.version(), numErrors: issues.numErrors, numWarnings: issues.numWarnings,
    numInfos: issues.numInfos, numHints: issues.numHints, truncated: issues.truncated ?? false,
    codes: [...new Set(issues.messages.map(message => message.code))], messages: issues.messages };
  if (issues.numErrors > 0) {
    const error = new Error(`Khronos glTF validation found ${issues.numErrors} error(s): ${issues.messages.filter(message => message.severity === 0).map(message => message.code).join(', ')}`);
    error.diagnostics = diagnostics; throw error;
  }
  return diagnostics;
}

function parseGlb(bytes) {
  assert(bytes.length >= 28 && bytes.toString('ascii', 0, 4) === 'glTF', 'GLB: invalid binary header');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB: only version 2 supported');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB: declared file length differs');
  let offset = 12; const chunks = [];
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, 'GLB: truncated chunk header');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert(length % 4 === 0 && offset + 8 + length <= bytes.length, 'GLB: invalid chunk length');
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) }); offset += 8 + length;
  }
  assert(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'GLB: expected JSON then BIN chunks');
  assert(chunks[0].bytes.length <= 4 * 1024 * 1024, 'GLB: JSON chunk too large');
  const json = JSON.parse(chunks[0].bytes.toString('utf8'));
  assert.equal(json.asset?.version, '2.0', 'GLB: invalid glTF asset version');
  assert(!/"(?:authoring_owner|lab_review_owner|pipeline_owner|pipeline_session_id)"\s*:/.test(JSON.stringify(json)), 'GLB: operational ownership tags must not be exported');
  assert(json.buffers?.length === 1 && !json.buffers[0].uri, 'GLB: external buffers are not allowed');
  const length = json.buffers[0].byteLength;
  assert(Number.isSafeInteger(length) && length > 0 && length <= chunks[1].bytes.length && chunks[1].bytes.length - length <= 3, 'GLB: invalid buffer length');
  assert(!json.skins?.length && !json.animations?.length, 'GLB: this static-model recipe does not support skins or animation');
  return { json, binary: chunks[1].bytes.subarray(0, length) };
}

function transform(node, point) {
  if (node.matrix) {
    const m = node.matrix;
    assert(m.length === 16 && m.every(Number.isFinite) && m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'GLB: invalid affine node matrix');
    assert(!node.translation && !node.rotation && !node.scale, 'GLB: node mixes matrix and TRS');
    return [0,1,2].map(i => m[i] * point[0] + m[i + 4] * point[1] + m[i + 8] * point[2] + m[i + 12]);
  }
  const scale = node.scale ?? [1,1,1], translation = node.translation ?? [0,0,0], rotation = node.rotation ?? [0,0,0,1];
  assert(scale.length === 3 && translation.length === 3 && rotation.length === 4 && [...scale,...translation,...rotation].every(Number.isFinite), 'GLB: node transform must be finite');
  assert(Math.abs(rotation.reduce((sum, value) => sum + value * value, 0) - 1) < .0001, 'GLB: non-unit rotation quaternion');
  const v = point.map((value, i) => value * scale[i]), [x,y,z,w] = rotation;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx].map((value, i) => value + translation[i]);
}

export function inspectGlb(bytes, spec, maps = []) {
  assert(bytes.length <= spec.budgets.maxGlbBytes, 'GLB: byte budget exceeded');
  const { json: g, binary } = parseGlb(bytes);
  assert(g.scenes?.length === 1 && (g.scene ?? 0) === 0, 'GLB: expected one default scene');
  const viewBytes = index => {
    const view = g.bufferViews?.[index];
    assert(view?.buffer === 0 && !view.extensions, 'GLB: missing or unsupported bufferView');
    const offset = view.byteOffset ?? 0, length = view.byteLength;
    assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(length) && length > 0 && offset + length <= binary.length, 'GLB: bufferView exceeds binary');
    return binary.subarray(offset, offset + length);
  };
  for (let i = 0; i < (g.bufferViews?.length ?? 0); i++) viewBytes(i);
  const readAccessor = (index, type, indexData = false) => {
    const accessor = g.accessors?.[index];
    assert(accessor && !accessor.sparse && !accessor.normalized && accessor.type === type, 'GLB: invalid accessor shape');
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const componentSize = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
    assert(indexData ? [5121,5123,5125].includes(accessor.componentType) : accessor.componentType === 5126, 'GLB: unsupported accessor component type');
    assert(Number.isSafeInteger(accessor.count) && accessor.count > 0 && accessor.count <= 2000000, 'GLB: invalid accessor count');
    const buffer = viewBytes(accessor.bufferView), view = g.bufferViews[accessor.bufferView];
    const stride = view.byteStride ?? components * componentSize, offset = accessor.byteOffset ?? 0;
    assert(Number.isSafeInteger(stride) && stride >= components * componentSize && stride % componentSize === 0 && stride <= 252, 'GLB: invalid accessor stride');
    assert(Number.isSafeInteger(offset) && offset >= 0 && offset % componentSize === 0 && offset + (accessor.count - 1) * stride + components * componentSize <= buffer.length, 'GLB: accessor exceeds bufferView');
    return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: components }, (_, component) => {
      const start = offset + i * stride + component * componentSize;
      const value = indexData ? buffer.readUIntLE(start, componentSize) : buffer.readFloatLE(start);
      assert(Number.isFinite(value), 'GLB: every vertex, normal and UV value must be finite'); return value;
    }));
  };
  const low = [Infinity,Infinity,Infinity], high = [-Infinity,-Infinity,-Infinity];
  let triangles = 0, primitives = 0; const seenNodes = new Set(), usedMaterials = new Set(), materialUvs = new Map();
  const visit = (index, ancestors = []) => {
    assert(Number.isInteger(index) && !seenNodes.has(index) && ancestors.length < 128, 'GLB: cyclic or multiply-parented node hierarchy');
    seenNodes.add(index); const node = g.nodes?.[index]; assert(node && node.camera === undefined && node.skin === undefined, 'GLB: invalid model node');
    transform(node, [0,0,0]);
    if (node.mesh !== undefined) {
      const mesh = g.meshes?.[node.mesh]; assert(mesh?.primitives?.length, 'GLB: missing mesh primitives');
      for (const primitive of mesh.primitives) {
        assert((primitive.mode ?? 4) === 4 && !primitive.targets && !primitive.extensions, 'GLB: only uncompressed static triangles supported by this authoring validator');
        assert(g.materials?.[primitive.material], 'GLB: missing primitive material'); usedMaterials.add(primitive.material);
        assert(++primitives <= spec.budgets.maxPrimitives, 'GLB: primitive budget exceeded');
        const positions = readAccessor(primitive.attributes?.POSITION, 'VEC3');
        const normals = readAccessor(primitive.attributes?.NORMAL, 'VEC3');
        const uvs = readAccessor(primitive.attributes?.TEXCOORD_0, 'VEC2');
        assert(positions.length === normals.length && positions.length === uvs.length, 'GLB: position/normal/UV count mismatch');
        const uvSets = new Set([0]);
        for (const [attribute, accessor] of Object.entries(primitive.attributes)) {
          if (!/^TEXCOORD_[1-9][0-9]*$/.test(attribute)) continue;
          assert.equal(readAccessor(accessor, 'VEC2').length, positions.length, 'GLB: additional UV count mismatch');
          uvSets.add(Number(attribute.slice(9)));
        }
        const previousSets = materialUvs.get(primitive.material);
        materialUvs.set(primitive.material, previousSets ? new Set([...previousSets].filter(index => uvSets.has(index))) : uvSets);
        assert(normals.every(n => Math.hypot(...n) > .5 && Math.hypot(...n) < 1.5), 'GLB: invalid normal length');
        if (primitive.attributes?.TANGENT !== undefined) assert.equal(readAccessor(primitive.attributes.TANGENT, 'VEC4').length, positions.length, 'GLB: tangent count mismatch');
        const indices = primitive.indices === undefined ? positions.map((_, i) => [i]) : readAccessor(primitive.indices, 'SCALAR', true);
        assert(indices.length % 3 === 0, 'GLB: triangle index count must divide by three');
        triangles += indices.length / 3; assert(triangles <= spec.budgets.maxTriangles, 'GLB: triangle budget exceeded');
        for (const [vertex] of indices) assert(vertex < positions.length, 'GLB: index out of vertex bounds');
        // Count all exported vertices, including unused ones: stray geometry must not evade envelope checks.
        for (let point of positions) {
          for (const id of [index, ...ancestors]) point = transform(g.nodes[id], point);
          assert(point.every(Number.isFinite), 'GLB: transformed coordinates must be finite');
          point.forEach((value, axis) => { low[axis] = Math.min(low[axis], value); high[axis] = Math.max(high[axis], value); });
        }
      }
    }
    for (const child of node.children ?? []) visit(child, [index, ...ancestors]);
  };
  for (const index of g.scenes[0].nodes ?? []) visit(index);
  assert(triangles > 0, 'GLB: no exported triangle geometry');
  const expected = [spec.dimensionsM[0], spec.dimensionsM[2], spec.dimensionsM[1]];
  expected.forEach((dimension, axis) => {
    assert(Math.abs(high[axis] - low[axis] - dimension) <= TOLERANCE_M, `GLB: measured dimension ${axis} differs from catalog by more than 0.15 mm`);
    assert(Math.abs(axis === 1 ? low[axis] : (low[axis] + high[axis]) / 2) <= TOLERANCE_M, `GLB: origin ${axis} must be floor-centered within 0.15 mm`);
  });
  assert.deepEqual((g.materials ?? []).map(material => material.name).sort(), [...spec.materialKeys].sort(), 'GLB: material keys differ from saved placement contract');
  assert.equal(usedMaterials.size, spec.materialKeys.length, 'GLB: every catalog material must be used');
  const images = (g.images ?? []).map((image, index) => {
    assert(image.uri === undefined && image.bufferView !== undefined, 'GLB: images must be embedded');
    const content = viewBytes(image.bufferView), dimensions = imageDimensions(content, `GLB image ${index}`);
    assert.equal(image.mimeType, dimensions.mimeType, 'GLB: image MIME type does not match bytes');
    return { index, ...dimensions, bytes: content.length, sha256: sha(content) };
  });
  const materialMaps = [];
  for (const material of g.materials.filter(material => TEXTURED_MATERIAL.test(material.name))) {
    const required = [
      ['baseColor', material.pbrMetallicRoughness?.baseColorTexture], ['normal', material.normalTexture],
      ['orm', material.pbrMetallicRoughness?.metallicRoughnessTexture], ['orm', material.occlusionTexture],
    ];
    for (const [kind, reference] of required) {
      assert(reference, `GLB: missing ${kind} map on ${material.name}`);
      const texCoord = reference.extensions?.KHR_texture_transform?.texCoord ?? reference.texCoord ?? 0;
      assert(Number.isSafeInteger(texCoord) && texCoord >= 0 && materialUvs.get(g.materials.indexOf(material))?.has(texCoord), `GLB: ${kind} texture uses an unexported UV set on ${material.name}`);
      const texture = g.textures?.[reference.index], image = images[texture?.source];
      assert(image && !texture.extensions, `GLB: missing embedded ${kind} image on ${material.name}`);
      const receiptMap = maps.find(map => map.materialKey === material.name && map.kind === kind && map.sha256 === image.sha256);
      assert(receiptMap, `GLB: ${material.name} ${kind} embedded bytes do not match a receipt map`);
      if (isTiledSurface(spec)) assert(image.width === spec.surface.resolution && image.height === spec.surface.resolution, `GLB: ${kind} tiled texture resolution differs from spec`);
      else if (/upholstery/i.test(material.name)) assert(image.width === spec.bake.resolution && image.height === spec.bake.resolution, `GLB: ${kind} bake resolution differs from spec`);
      materialMaps.push({ materialKey: material.name, kind, image: image.index });
    }
  }
  return { triangles, primitives, bytes: bytes.length, boundsM: { min: low, max: high }, dimensionsMm: [high[0] - low[0], high[2] - low[2], high[1] - low[1]].map(v => v * 1000), materialKeys: g.materials.map(material => material.name), images, materialMaps, sha256: sha(bytes) };
}

function loadSpec(specPath, root) {
  const relative = path.isAbsolute(specPath) ? path.relative(root, specPath).replaceAll('\\', '/') : specPath.replaceAll('\\', '/');
  assert(relative.startsWith('assets-source/model-pipeline/') && relative.endsWith('.spec.json'), 'Spec must be an assets-source/model-pipeline/*.spec.json file');
  const filename = resolveRepoPath(root, relative), spec = readJson(filename, 'spec');
  assert(spec.version === 1 && spec.recipe === 'sofa', 'Spec: version 1 sofa recipe required');
  assert(Number.isSafeInteger(spec.seed), 'Spec: integer seed required');
  assert(Array.isArray(spec.dimensionsM) && spec.dimensionsM.length === 3 && spec.dimensionsM.every(value => Number.isFinite(value) && value > 0 && value < 100), 'Spec: width/depth/height dimensionsM must be positive metres');
  assert(Array.isArray(spec.materialKeys) && spec.materialKeys.length > 0 && spec.materialKeys.every(value => typeof value === 'string' && value.length > 0) && new Set(spec.materialKeys).size === spec.materialKeys.length, 'Spec: distinct material keys required');
  if (spec.surface !== undefined) {
    assert(isTiledSurface(spec), 'Spec: unsupported explicit surface method');
    const resolution = spec.surface.resolution;
    assert(Number.isSafeInteger(resolution) && resolution > 0 && resolution <= 8192 && (resolution & (resolution - 1)) === 0, 'Spec: tiled texture resolution must be a power of two up to 8192');
    assert(spec.bake === undefined && spec.outputs?.bakeDirectory === undefined, 'Spec: tiled PBR surfaces must not declare an atlas bake');
  } else {
    const resolution = spec.bake?.resolution;
    assert(Number.isSafeInteger(resolution) && resolution > 0 && resolution <= 8192 && (resolution & (resolution - 1)) === 0, 'Spec: bake resolution must be a power of two up to 8192');
    assert(Number.isSafeInteger(spec.bake.samples) && spec.bake.samples > 0 && spec.bake.samples <= 4096, 'Spec: bounded bake samples required');
    assert(['cageExtrusionM','maxRayDistanceM'].every(key => Number.isFinite(spec.bake[key]) && spec.bake[key] > 0 && spec.bake[key] < 1), 'Spec: bounded positive bake cage and ray distance required');
  }
  assert(['targetTriangles','maxTriangles','maxGlbBytes','maxPrimitives'].every(key => Number.isSafeInteger(spec.budgets?.[key]) && spec.budgets[key] > 0), 'Spec: positive integer budgets required');
  assert(spec.budgets.targetTriangles <= spec.budgets.maxTriangles && spec.budgets.maxTriangles <= 2000000 && spec.budgets.maxGlbBytes <= 128 * 1024 * 1024 && spec.budgets.maxPrimitives <= 128, 'Spec: budgets exceed bounded authoring limits');
  resolveRepoPath(root, spec.sourceBlend);
  for (const key of ['sourceBlend','glb','receipt', ...(isTiledSurface(spec) ? [] : ['bakeDirectory'])]) resolveRepoPath(root, spec.outputs?.[key]);
  const distinct = [relative,spec.sourceBlend,spec.outputs.sourceBlend,spec.outputs.glb,spec.outputs.receipt].map(value => resolveRepoPath(root, value));
  assert.equal(new Set(distinct).size, distinct.length, 'Spec: source, output, receipt and spec paths must be distinct');
  return { spec, relative, filename, reviewPath: relative.replace(/\.spec\.json$/, '.review.json') };
}

function reviewNotes(notes) {
  assert(notes?.decision === 'approved', 'Visual review must explicitly be approved');
  assert(typeof notes.reviewer === 'string' && notes.reviewer.trim().length > 0, 'Visual review must name its reviewer');
  for (const view of REQUIRED_VIEWS) assert(typeof notes.views?.[view] === 'string' && notes.views[view].trim().length >= 12, `Visual review needs explicit ${view} inspection notes`);
  assert(Array.isArray(notes.limitations) && notes.limitations.every(value => typeof value === 'string'), 'Visual review needs a limitations array (empty is allowed)');
}

export function inspectPipeline(specPath, { root = DEFAULT_ROOT } = {}) {
  root = realpathSync(root);
  const { spec, relative, filename, reviewPath } = loadSpec(specPath, root);
  const receiptFilename = resolveRepoPath(root, spec.outputs.receipt), receipt = readJson(receiptFilename, 'receipt');
  assert.equal(receipt.version, 1, 'Receipt: unsupported version');
  if (isTiledSurface(spec)) {
    assert(receipt.surface?.method === spec.surface.method && receipt.surface?.resolution === spec.surface.resolution, 'Receipt: tiled surface method or resolution differs from spec');
    assert(receipt.bake === undefined, 'Receipt: tiled PBR surfaces must not claim an atlas bake');
  }
  validateRecord(root, receipt.spec, 'spec', relative);
  assertBlend(validateRecord(root, receipt.sourceBlend, 'sourceBlend', spec.sourceBlend), 'sourceBlend');
  assertBlend(validateRecord(root, receipt.outputBlend, 'outputBlend', spec.outputs.sourceBlend), 'outputBlend');
  const glbFilename = validateRecord(root, receipt.glb, 'glb', spec.outputs.glb);
  assert(receipt.inputs === undefined || (Array.isArray(receipt.inputs) && receipt.inputs.length <= 128), 'Receipt: inputs must be a bounded array');
  const inputPaths = new Set();
  const inputs = (receipt.inputs ?? []).map(input => {
    assert(['builder','material'].includes(input.role), 'Receipt: input role must be builder or material');
    const filename = validateRecord(root, input, `input ${input.path}`);
    assert(!inputPaths.has(filename), 'Receipt: duplicate input path'); inputPaths.add(filename);
    return { path: input.path, role: input.role, sha256: input.sha256 };
  });
  assert(Array.isArray(receipt.maps) && receipt.maps.length > 0 && receipt.maps.length <= 128, 'Receipt: bounded maps list required');
  const tiled = isTiledSurface(spec);
  const bakeRoot = tiled ? null : resolveRepoPath(root, spec.outputs.bakeDirectory), mapKeys = new Set();
  const maps = receipt.maps.map((map, index) => {
    assert(spec.materialKeys.includes(map.materialKey) && ['baseColor','normal','roughness','ao','orm'].includes(map.kind), `map ${index}: invalid materialKey or kind`);
    if (tiled) assert(TILED_MAP_KINDS.includes(map.kind), `map ${index}: tiled PBR receipts contain baseColor, normal and packed orm only`);
    const key = `${map.materialKey}/${map.kind}`; assert(!mapKeys.has(key), `Receipt: duplicate map ${key}`); mapKeys.add(key);
    const mapFilename = validateRecord(root, map, `map ${key}`);
    const baked = bakeRoot !== null && inside(bakeRoot, mapFilename) && mapFilename !== bakeRoot;
    const retained = inputs.some(input => input.role === 'material' && input.sha256 === map.sha256 && resolveRepoPath(root, input.path) === mapFilename);
    assert(baked || retained, tiled ? `map ${key}: tiled texture must be a hash-bound retained material input` : `map ${key}: must be inside bakeDirectory or a hash-bound retained material input`);
    assert(statSync(mapFilename).size <= 64 * 1024 * 1024, `map ${key}: image exceeds 64 MiB`);
    const dimensions = imageDimensions(readFileSync(mapFilename), `map ${key}`);
    if (tiled) assert(dimensions.width === spec.surface.resolution && dimensions.height === spec.surface.resolution, `map ${key}: tiled texture dimensions differ from spec`);
    else if (/upholstery/i.test(map.materialKey)) assert(dimensions.width === spec.bake.resolution && dimensions.height === spec.bake.resolution, `map ${key}: bake dimensions differ from spec`);
    return { ...map, ...dimensions };
  });
  if (tiled) {
    for (const material of spec.materialKeys.filter(key => TEXTURED_MATERIAL.test(key))) for (const kind of TILED_MAP_KINDS) assert(mapKeys.has(`${material}/${kind}`), `Receipt: missing ${material} ${kind} tiled texture`);
  } else {
    for (const material of spec.materialKeys.filter(key => /upholstery/i.test(key))) for (const kind of ['baseColor','normal','roughness','ao','orm']) assert(mapKeys.has(`${material}/${kind}`), `Receipt: missing ${material} ${kind} bake`);
  }
  assert(Array.isArray(receipt.renders) && receipt.renders.length <= 32, 'Receipt: bounded renders list required (empty until rendered)');
  const seenViews = new Set();
  const renders = receipt.renders.map(render => {
    assert(REQUIRED_VIEWS.includes(render.view) && !seenViews.has(render.view), 'Receipt: invalid or duplicate render view'); seenViews.add(render.view);
    const renderFilename = validateRecord(root, render, `render ${render.view}`);
    assert(statSync(renderFilename).size <= 64 * 1024 * 1024, 'Receipt: render exceeds 64 MiB');
    return { ...render, ...imageDimensions(readFileSync(renderFilename), `render ${render.view}`) };
  });
  const geometry = { path: spec.outputs.glb, ...inspectGlb(readFileSync(glbFilename), spec, maps) };
  const artifactHashes = { spec: fileHash(filename), receipt: fileHash(receiptFilename), sourceBlend: receipt.sourceBlend.sha256, outputBlend: receipt.outputBlend.sha256, glb: receipt.glb.sha256,
    inputs, maps: maps.map(({ path: filePath, materialKey, kind, sha256 }) => ({ path: filePath, materialKey, kind, sha256 })), renders: renders.map(({ path: filePath, view, sha256 }) => ({ path: filePath, view, sha256 })) };
  const artifactSetSha256 = sha(JSON.stringify(artifactHashes));
  const reviewFilename = resolveRepoPath(root, reviewPath); let visualReview = { status: 'missing', path: reviewPath };
  if (existsSync(reviewFilename)) {
    try {
      const review = readJson(reviewFilename, 'review'); reviewNotes(review);
      assert(review.version === 1 && review.artifactSetSha256 === artifactSetSha256 && JSON.stringify(review.artifactHashes) === JSON.stringify(artifactHashes), 'review hashes are stale');
      assert(REQUIRED_VIEWS.every(view => seenViews.has(view)), 'review renders incomplete');
      visualReview = { status: 'approved', path: reviewPath, reviewer: review.reviewer, reviewedAt: review.reviewedAt, limitations: review.limitations };
    } catch (error) { visualReview = { status: 'stale', path: reviewPath, reason: error.message }; }
  }
  return { version: 1, spec: relative, recipe: spec.recipe, geometry, artifactHashes, artifactSetSha256, renders, visualReview,
    limits: ['File and geometry checks do not establish aesthetic quality.', 'Blender source signatures and hashes do not prove editable construction; inspect the source in Blender.', 'Visual approval is an explicit reviewer attestation bound to these artifacts.'] };
}

export function acceptReview(specPath, notes, { root = DEFAULT_ROOT, expectedArtifactSetSha256 } = {}) {
  root = realpathSync(root); reviewNotes(notes);
  const result = inspectPipeline(specPath, { root });
  if (expectedArtifactSetSha256) assert.equal(result.artifactSetSha256, expectedArtifactSetSha256, 'Artifacts changed after format validation; inspect again before approval');
  for (const view of REQUIRED_VIEWS) assert(result.renders.some(render => render.view === view), `Visual review is missing the ${view} render`);
  const filename = resolveRepoPath(root, result.visualReview.path);
  const review = { version: 1, reviewedAt: new Date().toISOString(), reviewer: notes.reviewer.trim(), decision: 'approved', views: Object.fromEntries(REQUIRED_VIEWS.map(view => [view, notes.views[view].trim()])), limitations: notes.limitations,
    artifactSetSha256: result.artifactSetSha256, artifactHashes: result.artifactHashes };
  mkdirSync(path.dirname(filename), { recursive: true });
  // The review path is spec-derived, constrained to assets-source/model-pipeline, and rechecked before writing.
  resolveRepoPath(root, result.visualReview.path);
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' }); renameSync(temporary, filename); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
  return inspectPipeline(specPath, { root });
}

export function requireReady(specPath, options = {}) {
  const result = inspectPipeline(specPath, options);
  assert.equal(result.visualReview.status, 'approved', `Visual review is ${result.visualReview.status}: inspect renders and record approval for these exact artifacts`);
  return result;
}
