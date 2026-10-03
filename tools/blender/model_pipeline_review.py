"""Render and record actual GLB review views for a detailed-model specification.

Run setup(spec_path), render(view) five times, then record(). No visual approval
is granted here: inspect the PNGs and browser, then use model-pipeline accept-review.
"""
import hashlib
import json
import runpy
import struct
from array import array
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
STATE = bpy.app.driver_namespace.setdefault('nook.detail_pipeline.review.v1', {})
VIEWS = ('front', 'rear', 'detail', 'underside', 'clay')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(path):
    path = path.resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError('Review paths must stay inside this repository')
    return path


def model_fingerprint(objects):
    digest = hashlib.sha256()
    for obj in objects:
        if obj.as_pointer() == 0 or obj.type != 'MESH':
            raise RuntimeError('Imported review geometry was replaced')
        digest.update(struct.pack('<16f', *(v for row in obj.matrix_world for v in row)))
        positions = array('f', [0]) * (len(obj.data.vertices)*3)
        obj.data.vertices.foreach_get('co', positions)
        digest.update(positions.tobytes())
        indices = array('i', [0]) * len(obj.data.loops)
        obj.data.loops.foreach_get('vertex_index', indices)
        digest.update(indices.tobytes())
        for layer in obj.data.uv_layers:
            uv = array('f', [0]) * (len(layer.data)*2)
            layer.data.foreach_get('uv', uv)
            digest.update(uv.tobytes())
    return digest.hexdigest()


def setup(spec_path):
    spec_path = inside(Path(spec_path))
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    glb = inside(ROOT / spec['outputs']['glb'])
    receipt = inside(ROOT / spec['outputs']['receipt'])
    data = json.loads(receipt.read_text(encoding='utf-8'))
    if data['glb']['sha256'] != digest(glb) or data['spec']['sha256'] != digest(spec_path):
        raise ValueError('Export or specification differs from its completed build receipt')
    rig = runpy.run_path(str(ROOT / 'tools/blender/realism_lab_review.py'))
    output = inside(ROOT / 'assets-source/experiments/realism-lab/renders')
    result = rig['setup'](glb.stem, glb_path=glb, output_dir=output)
    scene = rig['_RUNTIME']['scene']
    models = [obj for obj in scene.objects if obj.name in json.loads(scene['lab_original_materials'])]
    STATE.clear()
    STATE.update(spec=spec_path, glb=glb, receipt=receipt, output=output, rig=rig,
                 spec_hash=digest(spec_path), glb_hash=digest(glb), receipt_hash=digest(receipt),
                 scene=scene, scene_objects=set(scene.objects), models=models,
                 model_hash=model_fingerprint(models), rendered={})
    return result


def unchanged():
    if not STATE:
        raise RuntimeError('Call setup(spec_path) before reviewing')
    scene = STATE['scene']
    if STATE['rig']['_RUNTIME'].get('scene') is not scene:
        raise RuntimeError('Another review replaced this imported scene; call setup again')
    if set(scene.objects) != STATE['scene_objects'] or scene.get('lab_stem') != STATE['glb'].stem:
        raise RuntimeError('Review scene contents changed; call setup again')
    if model_fingerprint(STATE['models']) != STATE['model_hash']:
        raise RuntimeError('Imported review geometry or UVs changed; call setup again')
    for field in ('spec', 'glb', 'receipt'):
        if digest(STATE[field]) != STATE[field+'_hash']:
            raise RuntimeError('Build changed while rendering; start a fresh review: '+field)


def render(view):
    unchanged()
    if view not in VIEWS:
        raise ValueError('Expected front, rear, detail, underside or clay')
    result = STATE['rig']['render'](view)
    path = inside(Path(result['path']))
    if path != (STATE['output'] / (STATE['glb'].stem+'-'+view+'.png')).resolve():
        raise RuntimeError('Review renderer returned a different asset or view')
    STATE['rendered'][view] = {'view': view, 'path': path.relative_to(ROOT).as_posix(),
                              'sha256': digest(path), 'bytes': path.stat().st_size,
                              'resolution': result['resolution'], 'seconds': result['seconds']}
    return result


def record():
    unchanged()
    if set(STATE['rendered']) != set(VIEWS):
        raise RuntimeError('All five exported views must be rendered before recording')
    for item in STATE['rendered'].values():
        if digest(inside(ROOT/item['path'])) != item['sha256']:
            raise RuntimeError('Rendered image changed during review')
    receipt = json.loads(STATE['receipt'].read_text(encoding='utf-8'))
    receipt['renders'] = [STATE['rendered'][view] for view in VIEWS]
    STATE['receipt'].write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8', newline='\n')
    STATE['receipt_hash'] = digest(STATE['receipt'])
    return {'renderedViews': len(receipt['renders']), 'receipt': str(STATE['receipt']),
            'visualApproval': 'pending explicit inspection'}
