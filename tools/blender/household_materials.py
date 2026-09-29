"""Stable material keys for the unreleased household collection only.

This module imports no Blender API. The source tagging helper accepts Blender
objects, while GLB canonicalization edits only JSON material names and retains
every non-JSON chunk byte-for-byte. Existing released collections are excluded.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_PROPERTY = 'nook_canonical_material_key'
MAPPING_PATH = 'assets-source/household-material-keys.json'
_SUFFIX = re.compile(r'\.[0-9]+$')


def canonical_key(name):
    """Remove only Blender's terminal dot-number suffix, preserving all else."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError('Every household material needs a nonempty name')
    key = _SUFFIX.sub('', name)
    if not key:
        raise ValueError('Empty canonical material key: ' + name)
    return key


def tag_used_materials(objects):
    """Tag editable used materials without renaming any global Blender data."""
    objects = list(objects)
    by_key = {}
    mapping = {}
    for obj in objects:
        for mat in getattr(getattr(obj, 'data', None), 'materials', []):
            if mat is None:
                continue
            key = canonical_key(mat.name)
            pointer = mat.as_pointer() if hasattr(mat, 'as_pointer') else id(mat)
            if key in by_key and by_key[key] != pointer:
                raise ValueError('Distinct source materials share canonical key: ' + key)
            by_key[key] = pointer
            existing = mat.get(CANONICAL_PROPERTY)
            if existing is not None and existing != key:
                raise ValueError('Source canonical property disagrees with material name: ' + mat.name)
            mapping[mat.name] = key
    # Validate the complete model before making any source-property changes.
    for obj in objects:
        keys = []
        for mat in getattr(getattr(obj, 'data', None), 'materials', []):
            if mat is not None:
                key = canonical_key(mat.name)
                mat[CANONICAL_PROPERTY] = key
                keys.append(key)
        if keys:
            obj['canonical_material_keys'] = keys
    return mapping


def canonicalize_glb_bytes(data):
    """Return rewritten GLB bytes and evidence; no filesystem side effects."""
    if len(data) < 20 or struct.unpack_from('<III', data, 0) != (0x46546C67, 2, len(data)):
        raise ValueError('Invalid GLB 2 header')
    chunks = []
    offset = 12
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError('Truncated GLB chunk header')
        length, kind = struct.unpack_from('<II', data, offset)
        end = offset + 8 + length
        if length % 4 or end > len(data):
            raise ValueError('Invalid GLB chunk length/alignment')
        chunks.append((kind, data[offset + 8:end], data[offset:end]))
        offset = end
    if not chunks or chunks[0][0] != 0x4E4F534A or sum(k == 0x4E4F534A for k, _, _ in chunks) != 1:
        raise ValueError('GLB must contain one leading JSON chunk')
    doc = json.loads(chunks[0][1].decode('utf8'))
    materials = doc.get('materials', [])
    if not materials:
        raise ValueError('Household GLB has no materials')
    names = [m.get('name') for m in materials]
    keys = [canonical_key(name) for name in names]
    if len(set(keys)) != len(keys):
        duplicates = sorted({key for key in keys if keys.count(key) > 1})
        raise ValueError('Duplicate canonical material keys: ' + ', '.join(duplicates))
    for mat, name, key in zip(materials, names, keys):
        recorded = mat.get('extras', {}).get(CANONICAL_PROPERTY)
        if recorded is not None and recorded != key:
            raise ValueError('Export canonical property disagrees with material name: ' + name)
        mat['name'] = key
    renamed = {name: key for name, key in zip(names, keys) if name != key}
    # Preserve BIN and any unknown extension chunks including their headers.
    tail = b''.join(chunk for _, _, chunk in chunks[1:])
    output = data
    if renamed:
        encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf8')
        encoded += b' ' * ((-len(encoded)) % 4)
        body = struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + tail
        output = struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body
        if output[20 + len(encoded):] != tail:
            raise AssertionError('Non-JSON GLB chunks changed')
    binary = b''.join(payload for kind, payload, _ in chunks if kind == 0x004E4942)
    return output, {
        'changed': bool(renamed), 'renamed': renamed,
        'sourceToExport': dict(zip(names, keys)), 'exportKeys': keys,
        'beforeBytes': len(data), 'afterBytes': len(output),
        'binarySha256': hashlib.sha256(binary).hexdigest(),
        'nonJsonChunksPreserved': True,
    }


def _allowed_ids(root):
    rows = [row for path in sorted((root / 'src').glob('household*Expansion.json'))
            for row in json.loads(path.read_text(encoding='utf-8-sig'))]
    ids = [row[0] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate household catalog IDs')
    return set(ids)


def _atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + '.canonical-', delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def canonicalize_glbs(root, ids, write=False):
    """Preflight all requested new IDs, then optionally write GLBs and mapping."""
    root = Path(root).resolve()
    allowed = _allowed_ids(root)
    ids = list(dict.fromkeys(ids))
    if not ids or any(not isinstance(i, str) or i not in allowed for i in ids):
        raise ValueError('Specify only new IDs from household expansion catalogs')
    prepared = []
    for catalog_id in ids:
        path = root / 'public/models/furniture' / (catalog_id + '.glb')
        original = path.read_bytes()
        updated, report = canonicalize_glb_bytes(original)
        prepared.append((catalog_id, path, original, updated, report))
    mapping_path = root / MAPPING_PATH
    previous_mapping = mapping_path.read_bytes() if mapping_path.exists() else None
    mapping = json.loads(previous_mapping) if previous_mapping is not None else {
        'version': 1, 'sourceProperty': CANONICAL_PROPERTY, 'models': {}}
    for catalog_id, _, _, _, report in prepared:
        existing = mapping['models'].get(catalog_id)
        # Never replace the saved Blender-name map with canonical identity names.
        if existing is not None and not report['changed'] and existing.get('exportKeys') == report['exportKeys']:
            continue
        aliases = dict(existing.get('sourceToExport', {})) if existing else {}
        for source, exported in report['sourceToExport'].items():
            if source in aliases and aliases[source] != exported:
                raise ValueError('Conflicting source mapping: ' + catalog_id + '/' + source)
            aliases[source] = exported
        mapping['models'][catalog_id] = {'sourceToExport': aliases, 'exportKeys': report['exportKeys']}
    next_mapping = (json.dumps(mapping, indent=2, ensure_ascii=False) + '\n').encode('utf8')
    mapping_changed = next_mapping != previous_mapping
    if write:
        # Refuse a concurrent Blender export or mapping write before mutation.
        for catalog_id, path, original, _, _ in prepared:
            if path.read_bytes() != original:
                raise RuntimeError('GLB changed during preflight: ' + catalog_id)
        observed = mapping_path.read_bytes() if mapping_path.exists() else None
        if observed != previous_mapping:
            raise RuntimeError('Material mapping changed during preflight')
        for _, path, _, updated, report in prepared:
            if report['changed']:
                _atomic_write(path, updated)
        if mapping_changed:
            _atomic_write(mapping_path, next_mapping)
    return {'selected': len(prepared), 'changedModels': sum(r['changed'] for *_, r in prepared),
            'renamedMaterials': sum(len(r['renamed']) for *_, r in prepared),
            'mappingUpdated': mapping_changed, 'readOnly': not write,
            'nonJsonChunksPreserved': True,
            'models': {catalog_id: report for catalog_id, *_, report in prepared}}


def canonicalize_glb(path, root=ROOT, write=True):
    """Future Blender-driver hook after export and before GLB size/audit reads."""
    path = Path(path).resolve()
    root = Path(root).resolve()
    if path.parent != root / 'public/models/furniture' or path.suffix != '.glb':
        raise ValueError('Expected a household GLB under public/models/furniture')
    return canonicalize_glbs(root, [path.stem], write=write)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    report = canonicalize_glbs(args.root, json.load(sys.stdin), write=args.write)
    print(json.dumps({key: value for key, value in report.items() if key != 'models'}))
