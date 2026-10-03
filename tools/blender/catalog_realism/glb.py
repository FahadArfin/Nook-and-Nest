"""Preserve catalog GLB contracts while merging explicitly authored detail.

This module uses only Python's standard library. Baseline material factors and
protected texture indices remain intact; new normal/ORM channels are opt-in
additions. Explicit licensed scan records may replace ordinary albedo images.
Dynamic branches are copied as graphs with shared mesh references, never baked
into a single static mesh. All edits are validated in memory before replacement.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import zlib

MAX_BYTES = 256 * 1024 * 1024


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(source):
    """Return JSON and the unpadded embedded BIN bytes from a file or bytes."""
    raw = bytes(source) if isinstance(source, (bytes, bytearray, memoryview)) else Path(source).read_bytes()
    _require(20 <= len(raw) <= MAX_BYTES, 'Invalid GLB size')
    _require(raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2, 'Invalid GLB header')
    _require(struct.unpack_from('<I', raw, 8)[0] == len(raw), 'GLB length mismatch')
    offset, document, binary = 12, None, None
    while offset < len(raw):
        _require(offset + 8 <= len(raw), 'Truncated GLB chunk')
        size, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        _require(size % 4 == 0 and offset + size <= len(raw), 'Invalid GLB chunk length')
        payload = raw[offset:offset + size]
        if kind == 0x4e4f534a:
            _require(document is None and offset == 20, 'GLB requires one leading JSON chunk')
            document = json.loads(payload.rstrip(b' \t\r\n').decode('utf8'))
        elif kind == 0x004e4942:
            _require(document is not None and binary is None, 'Duplicate or misplaced GLB BIN chunk')
            binary = payload
        else:
            raise ValueError('Unsupported GLB chunk; refusing to discard unknown data')
        offset += size
    _require(document and document.get('asset', {}).get('version') == '2.0', 'glTF 2.0 required')
    buffers = document.get('buffers', [])
    if buffers:
        _require(len(buffers) == 1 and not buffers[0].get('uri') and binary is not None, 'One embedded GLB buffer required')
        length = buffers[0].get('byteLength')
        _require(isinstance(length, int) and 0 <= length <= len(binary) and len(binary) - length <= 3, 'Invalid GLB buffer length')
        binary = binary[:length]
    else:
        _require(binary in (None, b''), 'Unbound GLB BIN data')
    return document, binary or b''


def write_glb(destination, document, binary):
    """Atomically save one embedded GLB without mutating the supplied JSON."""
    document = copy.deepcopy(document)
    binary = bytes(binary)
    if binary or document.get('buffers'):
        _require(len(document.get('buffers', [{}])) == 1, 'One embedded GLB buffer required')
        document['buffers'] = [{**document.get('buffers', [{}])[0], 'byteLength': len(binary)}]
        document['buffers'][0].pop('uri', None)
    encoded = json.dumps(document, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf8')
    encoded += b' ' * (-len(encoded) % 4)
    payload = struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
    if binary or document.get('buffers'):
        padded = binary + b'\x00' * (-len(binary) % 4)
        payload += struct.pack('<II', len(padded), 0x004e4942) + padded
    raw = b'glTF' + struct.pack('<II', 2, 12 + len(payload)) + payload
    _require(len(raw) <= MAX_BYTES, 'GLB exceeds 256 MiB bound')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name('.' + destination.name + '.preserving.tmp')
    try:
        temporary.write_bytes(raw)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def _view_bytes(document, binary, index):
    views = document.get('bufferViews', [])
    _require(isinstance(index, int) and 0 <= index < len(views), 'Missing bufferView')
    view = views[index]
    _require(view.get('buffer') == 0 and not view.get('extensions'), 'Compressed or external bufferView requires a dedicated preserving codec')
    offset, length = view.get('byteOffset', 0), view.get('byteLength')
    _require(isinstance(offset, int) and isinstance(length, int) and offset >= 0 and length > 0 and offset + length <= len(binary), 'bufferView escapes GLB BIN')
    return binary[offset:offset + length]


def image_bytes(document, binary, index):
    images = document.get('images', [])
    _require(isinstance(index, int) and 0 <= index < len(images), 'Missing texture image')
    image = images[index]
    _require('uri' not in image and 'bufferView' in image, 'Texture must be embedded')
    return _view_bytes(document, binary, image['bufferView'])


def _append_view(document, binary, data, template=None):
    binary.extend(b'\0' * (-len(binary) % 4))
    record = copy.deepcopy(template or {})
    record.update(buffer=0, byteOffset=len(binary), byteLength=len(data))
    index = len(document.setdefault('bufferViews', []))
    document['bufferViews'].append(record)
    binary.extend(data)
    return index


def compact_document(document, binary):
    """Prune orphan geometry/views and share identical BIN payloads losslessly.

    Material, image, texture and sampler array indices remain stable, including
    literal indices inside material extensions. Accessor/view references are
    patched, while their payload bytes, strides, offsets within views and types
    remain exact. Unsupported encoded buffer references fail closed.
    """
    value = copy.deepcopy(document)
    _require(not any(view.get('extensions') for view in value.get('bufferViews', [])), 'Compressed bufferViews require a dedicated lossless compactor')
    _require('KHR_animation_pointer' not in value.get('extensionsUsed', []), 'Animated JSON pointers require a dedicated lossless compactor')
    used_meshes = sorted({node['mesh'] for node in value.get('nodes', []) if 'mesh' in node})
    mesh_map = {old: new for new, old in enumerate(used_meshes)}
    original_meshes = value.get('meshes', [])
    _require(all(isinstance(index, int) and 0 <= index < len(original_meshes) for index in used_meshes), 'Node refers to missing mesh')
    value['meshes'] = [original_meshes[index] for index in used_meshes]
    for node in value.get('nodes', []):
        if 'mesh' in node:
            node['mesh'] = mesh_map[node['mesh']]
    accessors = set()
    for mesh in value['meshes']:
        _require(not mesh.get('extensions'), 'Extended meshes require a dedicated lossless compactor')
        for primitive in mesh.get('primitives', []):
            _require(not primitive.get('extensions'), 'Encoded/extended primitives require a dedicated lossless compactor')
            accessors.update(primitive.get('attributes', {}).values())
            if 'indices' in primitive:
                accessors.add(primitive['indices'])
            for target in primitive.get('targets', []):
                accessors.update(target.values())
    for skin in value.get('skins', []):
        if 'inverseBindMatrices' in skin:
            accessors.add(skin['inverseBindMatrices'])
    for animation in value.get('animations', []):
        for sampler in animation.get('samplers', []):
            accessors.update((sampler['input'], sampler['output']))
    for node in value.get('nodes', []):
        extension = node.get('extensions', {}).get('EXT_mesh_gpu_instancing')
        if extension:
            accessors.update(extension.get('attributes', {}).values())
    used_accessors = sorted(accessors)
    accessor_map = {old: new for new, old in enumerate(used_accessors)}
    original_accessors = value.get('accessors', [])
    _require(all(isinstance(index, int) and 0 <= index < len(original_accessors) for index in used_accessors), 'Geometry refers to missing accessor')
    value['accessors'] = [original_accessors[index] for index in used_accessors]
    for mesh in value['meshes']:
        for primitive in mesh.get('primitives', []):
            primitive['attributes'] = {key: accessor_map[index] for key, index in primitive.get('attributes', {}).items()}
            if 'indices' in primitive:
                primitive['indices'] = accessor_map[primitive['indices']]
            if 'targets' in primitive:
                primitive['targets'] = [{key: accessor_map[index] for key, index in target.items()} for target in primitive['targets']]
    for skin in value.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
    for animation in value.get('animations', []):
        for sampler in animation.get('samplers', []):
            sampler['input'], sampler['output'] = accessor_map[sampler['input']], accessor_map[sampler['output']]
    for node in value.get('nodes', []):
        extension = node.get('extensions', {}).get('EXT_mesh_gpu_instancing')
        if extension:
            extension['attributes'] = {key: accessor_map[index] for key, index in extension['attributes'].items()}
    references = []
    for accessor in value['accessors']:
        _require(not accessor.get('extensions'), 'Extended accessors require a dedicated lossless compactor')
        if 'bufferView' in accessor:
            references.append(accessor)
        for record in accessor.get('sparse', {}).values():
            if isinstance(record, dict) and 'bufferView' in record:
                references.append(record)
    for image in value.get('images', []):
        _require('bufferView' in image and 'uri' not in image, 'Compactor requires embedded images')
        references.append(image)
    used_views = sorted({record['bufferView'] for record in references})
    view_map, payloads, packed, result_views, duplicate_count = {}, {}, bytearray(), [], 0
    for index in used_views:
        payload = _view_bytes(document, binary, index)
        record = copy.deepcopy(document['bufferViews'][index])
        identity = (_sha(payload), len(payload))
        if identity in payloads:
            offset = payloads[identity]
            duplicate_count += 1
        else:
            packed.extend(b'\0' * (-len(packed) % 4))
            offset = len(packed)
            payloads[identity] = offset
            packed.extend(payload)
        record.update(buffer=0, byteOffset=offset, byteLength=len(payload))
        view_map[index] = len(result_views)
        result_views.append(record)
    for record in references:
        record['bufferView'] = view_map[record['bufferView']]
    value['bufferViews'] = result_views
    if packed or value.get('buffers'):
        value['buffers'] = [{**value.get('buffers', [{}])[0], 'byteLength': len(packed)}]
        value['buffers'][0].pop('uri', None)
    return value, bytes(packed), {'removedMeshes': len(original_meshes)-len(used_meshes), 'removedAccessors': len(original_accessors)-len(used_accessors),
                                 'removedBufferViews': len(document.get('bufferViews', []))-len(used_views), 'deduplicatedPayloads': duplicate_count,
                                 'beforeBinaryBytes': len(binary), 'afterBinaryBytes': len(packed)}


def compact_glb(candidate_path):
    """Compact one already-authored candidate in place, returning measured cost."""
    candidate_path = Path(candidate_path)
    before = candidate_path.stat().st_size
    document, binary = read_glb(candidate_path)
    document, binary, result = compact_document(document, binary)
    write_glb(candidate_path, document, binary)
    return {'beforeBytes': before, 'afterBytes': candidate_path.stat().st_size, **result}


def decode_png_rgb(raw):
    """Decode bounded, noninterlaced 8-bit RGB/RGBA PNG into RGB bytes."""
    _require(raw[:8] == b'\x89PNG\r\n\x1a\n', 'ORM must be lossless PNG')
    offset, header, packed = 8, None, bytearray()
    while offset + 12 <= len(raw):
        length = struct.unpack_from('>I', raw, offset)[0]
        _require(offset + 12 + length <= len(raw), 'PNG chunk escapes image')
        kind, data = raw[offset + 4:offset + 8], raw[offset + 8:offset + 8 + length]
        _require(zlib.crc32(kind + data) & 0xffffffff == struct.unpack_from('>I', raw, offset + 8 + length)[0], 'PNG checksum mismatch')
        if kind == b'IHDR':
            _require(header is None and length == 13, 'Invalid PNG IHDR')
            header = struct.unpack('>IIBBBBB', data)
        elif kind == b'IDAT':
            packed.extend(data)
        offset += length + 12
        if kind == b'IEND':
            break
    _require(header is not None, 'Missing PNG header')
    width, height, depth, color, compression, filtering, interlace = header
    _require(0 < width <= 4096 and 0 < height <= 4096 and depth == 8 and color in (2, 6) and compression == filtering == interlace == 0, 'ORM PNG must be bounded noninterlaced RGB/RGBA8')
    channels = 3 if color == 2 else 4
    stride, limit = width * channels, (width * channels + 1) * height
    inflater = zlib.decompressobj()
    decoded = inflater.decompress(bytes(packed), limit + 1)
    _require(len(decoded) == limit and inflater.eof and not inflater.unconsumed_tail, 'PNG decoded size mismatch')
    previous, output = bytearray(stride), bytearray()
    for y in range(height):
        method = decoded[y * (stride + 1)]
        _require(method <= 4, 'Invalid PNG filter')
        row = bytearray(stride)
        for x in range(stride):
            a, b, c = row[x - channels] if x >= channels else 0, previous[x], previous[x - channels] if x >= channels else 0
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            predicted = 0 if method == 0 else a if method == 1 else b if method == 2 else (a + b) // 2 if method == 3 else a if pa <= pb and pa <= pc else b if pb <= pc else c
            row[x] = (decoded[y * (stride + 1) + 1 + x] + predicted) & 255
        output.extend(value for x, value in enumerate(row) if x % channels < 3)
        previous = row
    return width, height, bytes(output)


def _encode_png_rgb(width, height, rgb):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    rows = b''.join(b'\0' + rgb[y * width * 3:(y + 1) * width * 3] for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')


def _texture_source(texture):
    sources = [texture['source']] if 'source' in texture else []
    for extension in texture.get('extensions', {}).values():
        if isinstance(extension, dict) and 'source' in extension:
            sources.append(extension['source'])
    _require(sources, 'Texture has no image source')
    return sources


def _effective_uv(reference):
    value = reference.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', reference.get('texCoord', 0))
    _require(isinstance(value, int) and 0 <= value <= 7, 'Invalid texture coordinate set')
    return value


def _root_path(path, root):
    path = Path(path).resolve()
    try:
        return path.relative_to(root).as_posix()
    except ValueError as error:
        raise ValueError('Map output must stay in the selected repository') from error


def _record_bytes(root, record):
    relative = record.get('path')
    _require(isinstance(relative, str) and relative and not Path(relative).is_absolute() and '..' not in Path(relative).parts and '\\' not in relative, 'Invalid scan input path')
    file = (root/relative).resolve()
    _root_path(file, root)
    raw = file.read_bytes()
    _require(0 < len(raw) <= 32*1024*1024 and _sha(raw) == record.get('sha256') and ('bytes' not in record or len(raw) == record['bytes']), 'Scan source/provenance hash changed')
    return raw


def _motion_material_keys(document):
    animated = {channel.get('target', {}).get('node') for animation in document.get('animations', []) for channel in animation.get('channels', [])}
    result = set()
    def visit(index, inherited=False):
        node = document['nodes'][index]
        protected = inherited or _is_protected(node) or index in animated or 'skin' in node
        if protected and 'mesh' in node:
            for primitive in document['meshes'][node['mesh']]['primitives']:
                if 'material' in primitive:
                    result.add(document['materials'][primitive['material']]['name'])
        for child in node.get('children', []):
            visit(child, protected)
    for scene in document.get('scenes', []):
        for index in scene.get('nodes', []):
            visit(index)
    return result


def _scan_payload(root, request, key, record, original, original_bin, old_reference, protected):
    kind = request.get('kind')
    _require(kind in ('baseColor','normal','orm') and request.get('materialKey') == key and request.get('profile') == record.get('profile') in ('wood', 'fabric', 'canvas') and not record.get('protectedReason'), 'Only explicit unprotected wood/fabric scan channels are implemented')
    old = next(material for material in original['materials'] if material['name'] == key)
    _require(key not in protected and not re.search(r'artwork|original[-_]|screen|display|label|marking|globe|countertop|surface-stone|door-surface|glass|mirror|flame|water|light|emissi', key, re.I), 'Scan replacement targets a protected artwork or motion material')
    pbr = old.get('pbrMetallicRoughness', {})
    _require(old.get('alphaMode', 'OPAQUE') == 'OPAQUE' and pbr.get('baseColorFactor', [1,1,1,1])[3] == 1 and old.get('emissiveFactor', [0,0,0]) == [0,0,0] and 'emissiveTexture' not in old and not any(ext in old.get('extensions', {}) for ext in ('KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_unlit')), 'Scan replacement targets a protected optical material')
    _require(request.get('texCoord') == 1, 'A scan requires metric TEXCOORD_1')
    if old_reference:
        sources = _texture_source(original['textures'][old_reference['index']])
        _require(len(set(sources)) == 1 and _sha(image_bytes(original, original_bin, sources[0])) == request.get('oldSha256'), 'Scan old image hash differs from baseline')
    else:
        _require('oldSha256' not in request and kind != 'baseColor', 'New scan channel cannot claim an original image')
    if kind == 'orm':
        _require(pbr.get('metallicFactor',1) == 0, 'Coherent ORM scans require original dielectric metallic factor zero')
    repeat = request.get('repeatM')
    _require(isinstance(repeat, list) and len(repeat) == 2 and all(isinstance(v, (int,float)) and math.isfinite(v) and .02 <= v <= 4 for v in repeat), 'Scan physical repeat must be bounded metres')
    _require(isinstance(request.get('reason'), str) and len(request['reason'].strip()) >= 12, 'Scan replacement needs a documented reason')
    provenance = json.loads(_record_bytes(root, request['provenance']))
    family = provenance.get('materials', {}).get(request.get('family'), {})
    _require(family.get('license') == 'CC0-1.0' and family.get(kind) == request['source']['path'] and [family.get('repeatM')]*2 == repeat, 'Scan source/scale must match retained CC0 family provenance')
    payload = _record_bytes(root, request['source'])
    mime = 'image/png' if payload.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if payload.startswith(b'\xff\xd8\xff') else None
    _require(mime, 'Full-quality scan source must be PNG or JPEG')
    return payload, mime


def reconcile_materials(candidate_path, baseline_path, source_name_to_key, material_records, output_map_dir, root=None):
    """Restore baseline material contracts, adding declared detail channels.

    Run this before ``preserve_protected_subtrees``. ``material_records`` is the
    list returned by materials.apply_materials. Existing channels are immutable.
    Profiles permit newly textured roughness to use the native export factor;
    metallic and every other scalar remain the baseline values. New ORM blue is
    made neutral, because Blender may bake the metallic scalar into that image.
    Base RGBA, alpha, emission, protected extension JSON and original image bytes
    stay exact. Explicit scan replacement records alone may redirect ordinary
    wood/fabric albedo to a separately retained licensed image. Original image
    table indices stay intact. Operational Blender extras are never copied.
    """
    root = Path(root).resolve() if root else Path(__file__).resolve().parents[3]
    map_dir = Path(output_map_dir)
    if not map_dir.is_absolute():
        map_dir = root / map_dir
    _root_path(map_dir, root)
    _require(Path(candidate_path).resolve() != Path(baseline_path).resolve(), 'Candidate must not overwrite baseline')
    original, original_bin = read_glb(baseline_path)
    candidate, candidate_bin = read_glb(candidate_path)
    document, binary = copy.deepcopy(candidate), bytearray(candidate_bin)
    old_materials = original.get('materials', [])
    names = [material.get('name') for material in old_materials]
    _require(names and all(isinstance(name, str) and name for name in names) and len(set(names)) == len(names), 'Baseline material keys must be distinct')
    key_indices = {name: i for i, name in enumerate(names)}
    canonical_indices, native_by_key = {}, {}
    for index, material in enumerate(candidate.get('materials', [])):
        name = material.get('name')
        key = source_name_to_key.get(name, name)
        _require(key in key_indices, 'Unknown exported material key: ' + str(name))
        canonical_indices[index] = key_indices[key]
        native_by_key.setdefault(key, []).append(material)
    for mesh in document.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            _require(primitive.get('material') in canonical_indices, 'Primitive has an unknown material')
            primitive['material'] = canonical_indices[primitive['material']]
    # Keeping baseline array order also preserves texture indices embedded in
    # arbitrary material extensions, which must remain literal JSON matches.
    document['materials'] = copy.deepcopy(old_materials)
    for key in ('textures', 'samplers', 'images'):
        if key in original:
            document[key] = copy.deepcopy(original[key])
        else:
            document.pop(key, None)
    for image in document.get('images', []):
        source_index = image['bufferView']
        image['bufferView'] = _append_view(document, binary, _view_bytes(original, original_bin, source_index))
    for kind in ('extensionsUsed', 'extensionsRequired'):
        values = list(dict.fromkeys([*original.get(kind, []), *candidate.get(kind, [])]))
        if values:
            document[kind] = values
    records = {}
    for record in material_records:
        key = record.get('materialKey')
        _require(key in key_indices, 'Material record has unknown key')
        _require(key not in records, 'Duplicate material record for ' + key)
        records[key] = record
    new_maps, pending_files, surface_adjustments, replacements = [], [], [], []
    protected_keys = _motion_material_keys(original)
    if Path(baseline_path).stem.endswith('-aquarium'):
        protected_keys.update(names)
    for key, record in records.items():
        for adjustment in record.get('surfaceAdjustments', []):
            _require(record.get('profile') in ('fabric', 'canvas') and not record.get('protectedReason'), 'Cloth sheen adjustment requires an explicit unprotected cloth profile')
            _require(adjustment.get('property') == 'extensions.KHR_materials_sheen.sheenColorFactor', 'Unsupported material surface adjustment')
            value, reason = adjustment.get('value'), adjustment.get('reason')
            _require(isinstance(value, list) and len(value) == 3 and all(isinstance(v, (float, int)) and math.isfinite(v) and 0 <= v <= .2 for v in value), 'Cloth sheen RGB must be bounded to 0..0.2')
            _require(isinstance(reason, str) and len(reason.strip()) >= 12, 'Cloth sheen adjustment needs a documented reason')
            target = document['materials'][key_indices[key]]
            sheen = target.get('extensions', {}).get('KHR_materials_sheen')
            _require(sheen is not None and 'sheenColorFactor' in sheen, 'Only an existing authored sheen factor may be adjusted')
            _require(all(value[i] <= sheen['sheenColorFactor'][i] for i in range(3)), 'Cloth sheen adjustment cannot increase the original sheen')
            _require(not any(a['materialKey'] == key and a['property'] == adjustment['property'] for a in surface_adjustments), 'Duplicate material surface adjustment')
            sheen['sheenColorFactor'] = list(value)
            surface_adjustments.append({'materialKey': key, 'property': adjustment['property'], 'value': list(value), 'reason': reason})
        if not record.get('profile') or record.get('protectedReason'):
            continue
        declared = {entry.get('kind'): entry for entry in record.get('maps', [])}
        _require(set(declared) <= {'baseColor', 'normal', 'orm'}, 'Only explicitly declared albedo/normal/ORM detail is supported')
        requested = {entry.get('kind'): entry for entry in record.get('textureReplacements', [])}
        _require(len(requested) == len(record.get('textureReplacements', [])) and set(requested) <= set(declared), 'Duplicate or undeclared scan replacement')
        target = document['materials'][key_indices[key]]
        old = old_materials[key_indices[key]]
        for kind, declaration in declared.items():
            property_name = 'baseColorTexture' if kind == 'baseColor' else 'metallicRoughnessTexture'
            old_reference = old.get('normalTexture') if kind == 'normal' else old.get('pbrMetallicRoughness', {}).get(property_name)
            request = requested.get(kind)
            _require(kind != 'baseColor' or request, 'Albedo changes require an explicit scan replacement')
            scan_source = declaration.get('scanSource')
            if request and scan_source:
                _require(all(request.get(field) == scan_source.get(field) for field in ('materialKey','kind','profile','family','repeatM','source','provenance','texCoord')), 'Scan replacement differs from its map declaration')
            scan_request = request or scan_source
            scan = _scan_payload(root, scan_request, key, record, original, original_bin, old_reference, protected_keys) if scan_request else None
            if old_reference and not request:
                continue
            available = []
            for native in native_by_key.get(key, []):
                reference = native.get('normalTexture') if kind == 'normal' else native.get('pbrMetallicRoughness', {}).get(property_name)
                if reference:
                    texture = candidate.get('textures', [])[reference['index']]
                    sources = _texture_source(texture)
                    _require(len(set(sources)) == 1, 'New detail texture must have one unambiguous embedded image')
                    available.append((native, reference, texture, sources[0], image_bytes(candidate, candidate_bin, sources[0])))
            _require(available, f'Declared {key}/{kind} was not exported')
            signatures = {json.dumps({'reference': entry[1], 'texture': entry[2], 'hash': _sha(entry[4])}, sort_keys=True) for entry in available}
            _require(len(signatures) == 1, 'Colliding native material maps disagree for ' + key)
            native, reference, texture, image_index, payload = available[0]
            uv = _effective_uv(reference)
            if declaration.get('uvLayer') == 'RealismUV':
                _require(uv == 1, 'RealismUV must export as TEXCOORD_1')
            for mesh in document.get('meshes', []):
                for primitive in mesh.get('primitives', []):
                    if primitive['material'] == key_indices[key]:
                        _require('TEXCOORD_' + str(uv) in primitive.get('attributes', {}), f'{key}/{kind} refers to unexported TEXCOORD_{uv}')
            image = copy.deepcopy(candidate['images'][image_index])
            if scan:
                _require(uv == scan_request['texCoord'], 'Scan export changed the declared UV set')
                payload, image['mimeType'] = scan
            if kind == 'orm' and not scan:
                width, height, rgb = decode_png_rgb(payload)
                if any(value != 255 for value in rgb[2::3]):
                    neutral = bytearray(rgb)
                    neutral[2::3] = bytes([255]) * (width * height)
                    payload = _encode_png_rgb(width, height, neutral)
                image['mimeType'] = 'image/png'
                factor = native.get('pbrMetallicRoughness', {}).get('roughnessFactor', 1)
                _require(isinstance(factor, (int, float)) and math.isfinite(factor) and 0 <= factor <= 1, 'Invalid native roughness factor')
                target.setdefault('pbrMetallicRoughness', {})['roughnessFactor'] = factor
            image['bufferView'] = _append_view(document, binary, payload)
            image.pop('uri', None)
            new_image_index = len(document.setdefault('images', []))
            document['images'].append(image)
            texture = copy.deepcopy(texture)
            if 'source' in texture:
                texture['source'] = new_image_index
            for extension in texture.get('extensions', {}).values():
                if isinstance(extension, dict) and 'source' in extension:
                    extension['source'] = new_image_index
            if 'sampler' in texture:
                sampler = copy.deepcopy(candidate['samplers'][texture['sampler']])
                texture['sampler'] = len(document.setdefault('samplers', []))
                document['samplers'].append(sampler)
            new_texture_index = len(document.setdefault('textures', []))
            document['textures'].append(texture)
            reference = copy.deepcopy(reference)
            reference['index'] = new_texture_index
            if kind == 'normal':
                target['normalTexture'] = reference
            else:
                target.setdefault('pbrMetallicRoughness', {})[property_name] = reference
            suffix = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}.get(image.get('mimeType'))
            _require(suffix, 'Unsupported exported detail-map MIME type')
            safe_name = re.sub(r'[^a-zA-Z0-9._-]', '-', key)[:80]
            digest = _sha(payload)
            destination = map_dir / f'{safe_name}-{kind}-{digest[:16]}{suffix}'
            new_maps.append({'materialKey': key, 'kind': kind, 'path': _root_path(destination, root), 'sha256': digest, 'bytes': len(payload), 'texCoord': uv})
            if scan_request:
                new_maps[-1]['scanSource'] = {field:copy.deepcopy(scan_request[field]) for field in ('materialKey','kind','profile','family','repeatM','source','provenance','reason','texCoord')}
            if request:
                replacements.append({**copy.deepcopy(request), 'newSha256': digest})
            pending_files.append((destination, payload))
    # No candidate changes are written until all material and UV contracts pass.
    for destination, payload in pending_files:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            _require(destination.read_bytes() == payload, 'Hashed map output already contains different bytes')
        else:
            destination.write_bytes(payload)
    document, binary, compacted = compact_document(document, binary)
    write_glb(candidate_path, document, binary)
    return {'newMaps': new_maps, 'surfaceAdjustments': surface_adjustments, 'textureReplacements': replacements, 'materialKeys': names, 'preservedImages': len(original.get('images', [])), 'compaction': compacted, 'candidateSha256': _sha(Path(candidate_path).read_bytes())}


class _GraphCopier:
    """Append mesh/accessor dependencies while retaining sharing identity."""
    def __init__(self, target, binary, source, source_binary, material_names=None):
        self.target, self.binary, self.source, self.source_binary = target, binary, source, source_binary
        self.views, self.accessors, self.meshes, self.nodes = {}, {}, {}, {}
        self.material_names = material_names or {}
        self.material_indices = {m['name']: i for i, m in enumerate(target.get('materials', []))}

    def view(self, index):
        if index not in self.views:
            self.views[index] = _append_view(self.target, self.binary, _view_bytes(self.source, self.source_binary, index), self.source['bufferViews'][index])
        return self.views[index]

    def accessor(self, index):
        if index not in self.accessors:
            value = copy.deepcopy(self.source['accessors'][index])
            _require(not value.get('extensions'), 'Accessor extensions require an explicit preserving codec')
            if 'bufferView' in value:
                value['bufferView'] = self.view(value['bufferView'])
            for record in value.get('sparse', {}).values():
                if isinstance(record, dict) and 'bufferView' in record:
                    record['bufferView'] = self.view(record['bufferView'])
            self.accessors[index] = len(self.target.setdefault('accessors', []))
            self.target['accessors'].append(value)
        return self.accessors[index]

    def mesh(self, index):
        if index not in self.meshes:
            value = copy.deepcopy(self.source['meshes'][index])
            _require(not value.get('extensions'), 'Mesh extensions require an explicit preserving codec')
            for primitive in value['primitives']:
                _require(not primitive.get('extensions'), 'Compressed or extended primitive requires a preserving codec')
                primitive['attributes'] = {name: self.accessor(accessor) for name, accessor in primitive['attributes'].items()}
                if 'indices' in primitive:
                    primitive['indices'] = self.accessor(primitive['indices'])
                if 'targets' in primitive:
                    primitive['targets'] = [{name: self.accessor(accessor) for name, accessor in target.items()} for target in primitive['targets']]
                name = self.source['materials'][primitive['material']]['name']
                key = self.material_names.get(name, name)
                _require(key in self.material_indices, 'Copied subtree has unknown material: ' + key)
                primitive['material'] = self.material_indices[key]
            self.meshes[index] = len(self.target.setdefault('meshes', []))
            self.target['meshes'].append(value)
        return self.meshes[index]

    def node(self, index):
        if index not in self.nodes:
            value = copy.deepcopy(self.source['nodes'][index])
            _require('skin' not in value and 'camera' not in value and not value.get('extensions'), 'Skinned, camera or extension nodes need a dedicated graph recipe')
            self.nodes[index] = len(self.target.setdefault('nodes', []))
            self.target['nodes'].append(value)
            if 'mesh' in value:
                value['mesh'] = self.mesh(value['mesh'])
            if 'children' in value:
                value['children'] = [self.node(child) for child in value['children']]
        return self.nodes[index]


def _scene_roots(document):
    _require(len(document.get('scenes', [])) == 1 and document.get('scene', 0) == 0, 'One default scene required for graph preservation')
    return document['scenes'][0].get('nodes', [])


def _descendants(document, root):
    result, pending = [], [root]
    while pending:
        index = pending.pop()
        _require(isinstance(index, int) and 0 <= index < len(document.get('nodes', [])) and index not in result, 'Invalid or cyclic node graph')
        result.append(index)
        pending.extend(document['nodes'][index].get('children', []))
    return result


def _is_protected(node):
    extras = node.get('extras', {})
    return bool(extras.get('motion_role') or extras.get('shared_geometry') or node.get('name', '').startswith('linked_bough_'))


def _prune_nodes(document):
    roots, reachable = _scene_roots(document), []
    for root in roots:
        branch = _descendants(document, root)
        _require(not set(branch).intersection(reachable), 'Multiple-parent scene graph is unsupported')
        reachable.extend(branch)
    reachable.sort()
    mapping = {old: new for new, old in enumerate(reachable)}
    values = [copy.deepcopy(document['nodes'][index]) for index in reachable]
    for node in values:
        if 'children' in node:
            node['children'] = [mapping[index] for index in node['children']]
    document['nodes'] = values
    document['scenes'][0]['nodes'] = [mapping[index] for index in roots]


def preserve_protected_subtrees(candidate_path, baseline_path, source_name_to_key=None, preserve_all_original=False, source_object_names=None, root_name_map=None):
    """Restore protected baseline branches, preserving hierarchy and mesh reuse.

    Ordinary models restore entire top-level branches containing dynamic/shared
    nodes. This conservatively preserves static ancestors as well. Aquarium mode
    starts with the complete original document and appends only explicitly named
    ``detail_casework_*`` / ``detail_fastener_*`` candidate roots. Bounds and the
    additive capability are checked by the separate candidate validator.

    Embedded skeletal/clip animation on ordinary candidates is rejected before
    writes until an explicit animation-preserving recipe exists. Aquarium mode
    retains any baseline animations unchanged because original indices survive.
    """
    _require(Path(candidate_path).resolve() != Path(baseline_path).resolve(), 'Candidate must not overwrite baseline')
    old, old_bin = read_glb(baseline_path)
    native, native_bin = read_glb(candidate_path)
    _require(not native.get('animations') and not native.get('skins'), 'Native clip/skin animation requires an explicit preserving recipe')
    renamed = []
    for node in native.get('nodes', []):
        name = node.get('name')
        if name in (source_object_names or {}):
            node['name'] = source_object_names[name]
    baseline_names = {old['nodes'][index].get('name') for index in _scene_roots(old)}
    for index in _scene_roots(native):
        node = native['nodes'][index]
        name = node.get('name')
        if name in (root_name_map or {}):
            target = root_name_map[name]
            _require(target in baseline_names, 'Explicit root name must match a baseline root')
            node['name'] = target
            renamed.append({'from': name, 'to': target})
    # The usual exporter merges all static pieces to one root. Resolve that
    # sole unmatched pair only; never guess among multiple authored roots.
    old_static = [index for index in _scene_roots(old) if not any(_is_protected(old['nodes'][n]) for n in _descendants(old, index))]
    new_static = [index for index in _scene_roots(native) if not any(_is_protected(native['nodes'][n]) for n in _descendants(native, index)) and not re.match(r'^detail_(casework|fastener)_', native['nodes'][index].get('name', ''))]
    new_names = {native['nodes'][index].get('name') for index in new_static}
    missing = [index for index in old_static if old['nodes'][index].get('name') not in new_names]
    surplus = [index for index in new_static if native['nodes'][index].get('name') not in baseline_names]
    if len(missing) == len(surplus) == 1:
        node = native['nodes'][surplus[0]]
        target = old['nodes'][missing[0]].get('name')
        _require(isinstance(target, str) and target, 'Baseline static root requires an explicit name')
        renamed.append({'from': node.get('name'), 'to': target})
        node['name'] = target
    protected = [index for index in _scene_roots(old) if any(_is_protected(old['nodes'][node]) for node in _descendants(old, index))]
    if preserve_all_original:
        document, binary = copy.deepcopy(old), bytearray(old_bin)
        copier = _GraphCopier(document, binary, native, native_bin, source_name_to_key)
        additions = []
        for index in _scene_roots(native):
            branch = _descendants(native, index)
            named = [node for node in branch if re.match(r'^detail_(casework|fastener)_', native['nodes'][node].get('name', ''))]
            if not named:
                continue
            _require(named[0] == index and all(re.match(r'^detail_(casework|fastener)_', native['nodes'][node].get('name', '')) for node in branch), 'Aquarium additions need independent explicitly named roots')
            _require(not any(_is_protected(native['nodes'][node]) for node in branch), 'Aquarium additions cannot replace or alias protected moving nodes')
            document['scenes'][0]['nodes'].append(copier.node(index))
            for node in branch:
                value = native['nodes'][node]
                if 'mesh' in value:
                    additions.append({'node': value['name'], 'kind': 'casework' if value['name'].startswith('detail_casework_') else 'fastener'})
        _require(additions, 'No explicit additive aquarium casework was exported')
        document, binary, compacted = compact_document(document, binary)
        write_glb(candidate_path, document, binary)
        return {'mode': 'additive-casework-only', 'protectedRoots': [old['nodes'][i].get('name', '') for i in _scene_roots(old)], 'additions': additions, 'renamedRoots': renamed, 'compaction': compacted}
    _require(not old.get('animations') and not old.get('skins'), 'Baseline clip/skin animation requires an explicit preserving recipe')
    if not protected:
        if renamed or source_object_names:
            write_glb(candidate_path, native, native_bin)
        return {'mode': 'protected-subtrees', 'protectedRoots': [], 'additions': [], 'renamedRoots': renamed}
    document, binary = copy.deepcopy(native), bytearray(native_bin)
    old_names = {old['nodes'][index].get('name') for index in protected}
    retained = [index for index in _scene_roots(native) if native['nodes'][index].get('name') not in old_names and not any(_is_protected(native['nodes'][node]) for node in _descendants(native, index))]
    document['scenes'][0]['nodes'] = retained
    copier = _GraphCopier(document, binary, old, old_bin)
    restored = {old['nodes'][index].get('name'): copier.node(index) for index in protected}
    named_retained = {native['nodes'][index].get('name'): index for index in retained}
    ordered = []
    for index in _scene_roots(old):
        name = old['nodes'][index].get('name')
        target = restored.get(name, named_retained.get(name))
        if target is not None:
            ordered.append(target)
    ordered.extend(index for index in retained if index not in ordered)
    document['scenes'][0]['nodes'] = ordered
    _prune_nodes(document)
    for kind in ('extensionsUsed', 'extensionsRequired'):
        values = list(dict.fromkeys([*old.get(kind, []), *document.get(kind, [])]))
        if values:
            document[kind] = values
    document, binary, compacted = compact_document(document, binary)
    write_glb(candidate_path, document, binary)
    return {'mode': 'protected-subtrees', 'protectedRoots': [old['nodes'][index].get('name', '') for index in protected], 'additions': [], 'renamedRoots': renamed, 'compaction': compacted}
