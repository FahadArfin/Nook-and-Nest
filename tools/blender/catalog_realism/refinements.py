"""Optional per-model recipes: a local correction invalidates only that model.

Each ID has one entrypoint, refinements/<id>.py, and an optional <id>.json
manifest of adjacent shared helpers. All listed files are bound, including additions and removals.
Shared pipeline changes still invalidate the whole catalog intentionally.
"""
import hashlib
import json
from pathlib import Path
import re

DIRECTORY = 'tools/blender/catalog_realism/refinements'


def inputs(root, catalog_id):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', catalog_id):
        raise ValueError('Invalid catalog refinement ID')
    root = Path(root).resolve()
    directory = root / DIRECTORY
    entry = directory / (catalog_id + '.py')
    manifest = directory / (catalog_id + '.json')
    if not entry.exists():
        if manifest.exists():
            raise ValueError('Model refinement manifest requires its entrypoint')
        return []
    paths = [entry]
    if manifest.exists():
        if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size > 16384:
            raise ValueError('Invalid model refinement dependency manifest')
        document = json.loads(manifest.read_text(encoding='utf-8'))
        dependencies = document.get('dependencies')
        if (set(document) != {'version', 'dependencies'} or document['version'] != 1 or
                not isinstance(dependencies, list) or len(dependencies) > 16 or
                any(not isinstance(name, str) or not re.fullmatch(r'[a-z][a-z0-9_-]*\.py', name) or
                    name == entry.name for name in dependencies) or len(set(dependencies)) != len(dependencies)):
            raise ValueError('Invalid model refinement dependency list')
        paths += [manifest, *[directory / name for name in sorted(dependencies)]]
    result = []
    for file in paths:
        if file.is_symlink() or not file.resolve().is_relative_to(root) or not file.is_file():
            raise ValueError('Refinement must be a regular file in the selected worktree')
        raw = file.read_bytes()
        if not 0 < len(raw) <= 1024 * 1024:
            raise ValueError('Model refinement file must be 1 byte to 1 MiB')
        result.append({'path': file.relative_to(root).as_posix(),
                       'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
    return result


def current(root, catalog_id, receipt):
    return (receipt or {}).get('modelRefinementInputs', []) == inputs(root, catalog_id)


def apply(root, scene, item, material_keys, object_names, bound):
    if inputs(root, item['id']) != bound:
        raise ValueError('Model refinement changed before authoring')
    if not bound:
        return []
    entry = Path(root) / bound[0]['path']
    raw = entry.read_bytes()
    if hashlib.sha256(raw).hexdigest() != bound[0]['sha256']:
        raise ValueError('Model refinement changed before execution')
    namespace = {'__file__': str(entry), '__name__': 'catalog_model_refinement'}
    exec(compile(raw, str(entry), 'exec'), namespace)
    changes = namespace['apply'](root, scene, item, material_keys, object_names)
    if not isinstance(changes, list) or any(not isinstance(row, dict) or not row.get('kind') for row in changes):
        raise ValueError('Model refinement must return explicit change records')
    if inputs(root, item['id']) != bound:
        raise ValueError('Model refinement changed during authoring')
    return changes
