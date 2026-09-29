"""Prepare hash-verified original sofa sources without touching tracked models.

Run once on a fresh checkout, before enrich_sofas.py:
    python tools/blender/sofa_realism_baseline.py
Use --check for read-only verification. Git extraction is pinned to the full
revision in sofa-realism-references.json; current enriched sources are never
accepted as their own baseline. No Blender API or network calls are used.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = 'assets-source/sofa-realism-references.json'
DIRECTORY = '.generated/sofa-realism-originals'
COMMAND = 'python tools/blender/sofa_realism_baseline.py'


def manifest(root=ROOT):
    data = json.loads((Path(root) / MANIFEST).read_text(encoding='utf-8-sig'))
    revision = data['sourceBaseline']['revision']
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Sofa baseline must use a full immutable Git commit SHA')
    models = data['models']
    if len({r['id'] for r in models}) != len(models):
        raise ValueError('Duplicate sofa baseline IDs')
    for row in models:
        if (not re.fullmatch(r'[a-z0-9-]+', row['id']) or
                row['source'] != f"assets-source/blender/{row['id']}.blend" or
                not re.fullmatch(r'[0-9a-f]{64}', row['baseline']['blendSha256']) or
                row['baseline']['blendBytes'] <= 0):
            raise ValueError('Invalid sofa baseline record: ' + row['id'])
    return revision, models


def backup_path(root, row):
    root = Path(root).resolve()
    path = root / DIRECTORY / f"{row['id']}.blend"
    if path.resolve() != path or not path.is_relative_to(root):
        raise ValueError('Sofa baseline backup is redirected outside its ignored directory')
    return path


def valid(data, row):
    return (len(data) == row['baseline']['blendBytes'] and
            hashlib.sha256(data).hexdigest() == row['baseline']['blendSha256'])


def verified_original(catalog_id, root=ROOT):
    """Called by Blender before loading any original; never writes or extracts."""
    _, rows = manifest(root)
    row = next((r for r in rows if r['id'] == catalog_id), None)
    if row is None:
        raise ValueError('Not an audited sofa: ' + catalog_id)
    path = backup_path(root, row)
    if not path.is_file():
        raise FileNotFoundError(f'Missing pinned original for {catalog_id}. Run {COMMAND} first.')
    if not valid(path.read_bytes(), row):
        raise ValueError(f'Unverified sofa original: {path}. Preserve any edits elsewhere, then run {COMMAND} --repair.')
    return path


def prepare(root=ROOT, check=False, repair=False):
    root = Path(root).resolve()
    revision, rows = manifest(root)
    pending = []
    for row in rows:
        path = backup_path(root, row)
        previous = path.read_bytes() if path.is_file() else None
        if previous is not None and valid(previous, row):
            continue
        if check:
            verified_original(row['id'], root)
        if previous is not None and not repair:
            raise ValueError(f'Unverified baseline {path}; refusing to overwrite it. Use --repair to restore this ignored backup from the pinned commit.')
        result = subprocess.run(['git', '-C', str(root), 'show', f"{revision}:{row['source']}"],
                                capture_output=True, check=False)
        if result.returncode:
            raise RuntimeError(f'Pinned sofa source {row["id"]} is unavailable at {revision}. Fetch that commit into this checkout, then rerun {COMMAND}. Working sources were not changed.')
        if not valid(result.stdout, row):
            raise ValueError('Pinned Git source hash/size disagrees with manifest: ' + row['id'])
        pending.append((path, previous, result.stdout))
    # Preflight every source before writing any replacement, and detect another
    # author changing a backup between that preflight and the atomic writes.
    for path, previous, _ in pending:
        if (path.read_bytes() if path.is_file() else None) != previous:
            raise RuntimeError('Sofa baseline changed during preflight: ' + str(path))
    for path, _, data in pending:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + '.', delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(data)
            os.replace(temporary, path)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
    return {'revision': revision, 'verified': len(rows), 'extracted': len(pending), 'readOnly': check}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check', action='store_true', help='Only verify all ignored originals')
    group.add_argument('--repair', action='store_true', help='Restore invalid ignored originals from the pinned commit')
    args = parser.parse_args()
    print(json.dumps(prepare(check=args.check, repair=args.repair), indent=2))
