"""Bounded MCP queue. Generation and rendering never grant visual approval."""
import hashlib
import json
import runpy
import stat
import time
from pathlib import Path


def current(root, record, cache=None):
    """Reuse status hashes only within this queue call and unchanged file stats.

    Authoring/rendering retain their independent uncached before/after checks.
    The post-read stat prevents caching a file changed during the status read.
    """
    path = root / record['path']
    def signature():
        try:
            value = path.stat()
        except OSError:
            return None
        if not stat.S_ISREG(value.st_mode):
            return None
        return (value.st_dev, value.st_ino, value.st_size,
                value.st_mtime_ns, value.st_ctime_ns)
    before = signature()
    if before is None or ('bytes' in record and before[2] != record['bytes']):
        return False
    key = (str(path), record['sha256'], record.get('bytes'))
    prior = cache.get(key) if cache is not None else None
    if prior is not None and prior[0] == before:
        return prior[1]
    try:
        matches = hashlib.sha256(path.read_bytes()).hexdigest() == record['sha256']
    except OSError:
        return False
    if signature() != before:
        return False
    if cache is not None:
        cache[key] = (before, matches)
    return matches


def run(root_path, stage='build', seconds=35, limit=15, retry=False, ids=None):
    if stage not in {'build', 'render'} or not 1 <= seconds <= 45 or not 1 <= limit <= 20:
        raise ValueError('Choose a bounded build/render queue')
    root = Path(root_path).resolve()
    catalog = json.loads((root/'assets-source/catalog-realism/catalog.json').read_text())
    items = [i for i in catalog['items'] if ids is None or i['id'] in ids]
    if ids is not None and len(items) != len(set(ids)):
        raise ValueError('Unknown or duplicate requested catalog ID')
    module = runpy.run_path(str(root/f'tools/blender/catalog_realism/{"build" if stage == "build" else "review"}.py'))
    refinements = runpy.run_path(str(root/'tools/blender/catalog_realism/refinements.py'))
    helper_paths = sorted((root/'tools/blender/catalog_realism').glob('*.py'))
    dependency_paths = set(helper_paths)
    for name in ('catalog', 'material-plan', 'material-provenance', 'scan-plan'):
        dependency_paths.add(root/f'assets-source/catalog-realism/{name}.json')
    def collect_records(value):
        if isinstance(value, dict):
            if isinstance(value.get('path'), str) and 'sha256' in value:
                path = (root/value['path']).resolve()
                if path.is_relative_to(root):
                    dependency_paths.add(path)
            for child in value.values():
                collect_records(child)
        elif isinstance(value, list):
            for child in value:
                collect_records(child)
    for name in ('material-provenance', 'scan-plan'):
        collect_records(json.loads((root/f'assets-source/catalog-realism/{name}.json').read_text()))
    signature = hashlib.sha256(b''.join(str(p).encode()+
        (p.read_bytes() if p.is_file() else b'MISSING') for p in sorted(dependency_paths))).hexdigest()
    state_path = root/'.generated/catalog-realism-queue.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    failures = state.setdefault(stage, {})
    status_cache = {}
    started, results, skipped, remaining = time.monotonic(), [], 0, 0
    for item in items:
        path = root/item['outputs']['receipt']
        receipt = json.loads(path.read_text()) if path.exists() else None
        refinement_inputs = refinements['inputs'](root, item['id'])
        ready = bool(receipt and receipt.get('modelRefinementInputs', []) == refinement_inputs and receipt.get('inputContractSha256') == item['contractSha256'] and
                     all(current(root, r, status_cache) for r in [*receipt.get('buildInputs', receipt.get('inputs', [])), *receipt['outputs'].values()]))
        if stage == 'build' and ready:
            skipped += 1
            continue
        if stage == 'render' and not ready:
            remaining += 1
            continue
        if stage == 'render' and len(receipt.get('renders', [])) == 5 and all(current(root, r, status_cache) for r in [*receipt.get('inputs', []), *receipt['renders']]):
            skipped += 1
            continue
        failure_signature = hashlib.sha256((signature+item['contractSha256']+json.dumps(refinement_inputs, sort_keys=True)).encode()+
            b''.join((root/item[key]['path']).read_bytes() if (root/item[key]['path']).is_file() else b'MISSING'
                     for key in ('sourceBlend', 'baselineGlb'))).hexdigest() if item['id'] in failures else None
        if failure_signature and failures[item['id']].get('signature') == failure_signature and not retry:
            remaining += 1
            continue
        if len(results) >= limit or time.monotonic()-started >= seconds:
            remaining += 1
            continue
        try:
            if stage == 'build':
                result = module['build'](str(root), item['id'])
            else:
                value = module['render_model'](str(root), item['id'], resolution=(640, 480), samples=24)
                result = {'id': item['id'], 'views': value['renderedThisCall'], 'seconds': value['seconds']}
            failures.pop(item['id'], None)
            results.append(result)
        except Exception as error:
            failure_signature = hashlib.sha256((signature+item['contractSha256']+json.dumps(refinement_inputs, sort_keys=True)).encode()+
                b''.join((root/item[key]['path']).read_bytes() if (root/item[key]['path']).is_file() else b'MISSING'
                         for key in ('sourceBlend', 'baselineGlb'))).hexdigest()
            failures[item['id']] = {'signature': failure_signature, 'error': str(error), 'type': type(error).__name__}
            results.append({'id': item['id'], 'error': str(error), 'type': type(error).__name__})
        state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = state_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(state, indent=2)+'\n')
        temporary.replace(state_path)
    return {'stage': stage, 'results': results, 'alreadyCurrent': skipped, 'remaining': remaining,
            'failures': failures, 'seconds': round(time.monotonic()-started, 2),
            'visualApproval': 'separate explicit review required'}
