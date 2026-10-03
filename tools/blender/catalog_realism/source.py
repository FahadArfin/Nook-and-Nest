"""Load one editable catalog source without replacing the user's Blender scene."""
from contextlib import contextmanager
from pathlib import Path
import json
import time
import uuid

import bpy
from mathutils import Vector

DATA_KINDS = ('scenes', 'objects', 'collections', 'meshes', 'curves', 'metaballs',
              'armatures', 'materials', 'images', 'textures', 'node_groups',
              'cameras', 'lights', 'worlds', 'actions')
OWNER_KEY = 'catalog_realism_owner'
_OWNERS = {}


def _live(data, collection):
    """Check an owned ID without rebuilding a whole collection per object.

    Native ID collections index names. Verify the returned ID's identity too;
    linked libraries may contain duplicate names, so only that ambiguous case
    needs a membership snapshot. Removed RNA wrappers raise ReferenceError.
    """
    try:
        found = collection.get(data.name)
        if found is None or found == data:
            return found is not None
        return data in set(collection)
    except ReferenceError:
        return False


def capture_owned(scene):
    """Claim only new dependencies reachable from explicitly owned scenes.

    Exporters call this before joining their copies so subsequently orphaned
    copy meshes remain known. Unrelated newly created or orphaned IDs are never
    claimed merely because they appeared during this operation.
    """
    owner = _OWNERS.get(scene.get(OWNER_KEY))
    if owner is None:
        raise ValueError('Scene has no active catalog source owner')
    scenes = {value for value in bpy.data.scenes if value.get(OWNER_KEY) == owner['token']}
    # user_map maps each dependency to the IDs referring to it. Walk backwards
    # from our scene roots through collections, objects, meshes and materials.
    users = bpy.data.user_map()
    reachable = set(scenes)
    while True:
        additions = {data for data, references in users.items()
                     if data not in reachable and reachable.intersection(references)}
        if not additions:
            break
        reachable.update(additions)
    for kind in DATA_KINDS:
        present = set(getattr(bpy.data, kind))
        owner['owned'][kind].update((reachable & present) - owner['before'][kind])


def _cleanup_owned(owner, previous):
    owned = owner['owned']
    scenes = {data for data in owned['scenes'] if _live(data, bpy.data.scenes)}
    objects = {data for data in owned['objects'] if _live(data, bpy.data.objects)}
    # If an owned object was linked into a user's scene, preserve its complete
    # working scene for inspection. The same applies to unexpected prior data
    # linked into a candidate scene during authoring.
    # Object.users_scene scans every scene in Blender for every object. The
    # operation is synchronous, so one identity snapshot of each scene gives
    # the same ownership boundary without repeating those native traversals.
    scene_objects = {scene: set(scene.objects) for scene in bpy.data.scenes}
    safe = all(scene_objects[scene] <= objects for scene in scenes)
    safe = safe and all(not objects.intersection(members)
                        for scene, members in scene_objects.items() if scene not in scenes)
    active = bpy.context.window.scene
    if active in scenes and _live(previous, bpy.data.scenes):
        bpy.context.window.scene = previous
    if not safe:
        return
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for scene in scenes:
        bpy.data.scenes.remove(scene)
    # Dependency order varies (node groups can contain other node groups).
    # Release fake users only on our exact owned IDs, then reclaim orphans.
    for kind in DATA_KINDS:
        if kind in ('objects', 'scenes'):
            continue
        collection = getattr(bpy.data, kind)
        for data in owned[kind]:
            if _live(data, collection) and getattr(data, 'use_fake_user', False):
                data.use_fake_user = False
    while True:
        removed = 0
        for kind in DATA_KINDS:
            if kind in ('objects', 'scenes'):
                continue
            collection = getattr(bpy.data, kind)
            for data in owned[kind]:
                if _live(data, collection) and data.users == 0:
                    collection.remove(data)
                    removed += 1
        if not removed:
            break


@contextmanager
def load_source(path):
    """Yield scene and exact original names; remove only this import on exit."""
    previous = bpy.context.window.scene
    before = {kind: set(getattr(bpy.data, kind)) for kind in DATA_KINDS}
    token = uuid.uuid4().hex
    owner = {'token': token, 'before': before, 'owned': {kind: set() for kind in DATA_KINDS}}
    _OWNERS[token] = owner
    loaded = False
    scene = None
    try:
        with bpy.data.libraries.load(str(path), link=False) as (source, target):
            names = {'materials': list(source.materials), 'objects': list(source.objects)}
            target.scenes = source.scenes
            target.materials = source.materials
            target.objects = source.objects
        # The synchronous library import has completed. Freeze its ownership
        # before yielding control to the authoring helpers.
        for kind in DATA_KINDS:
            owner['owned'][kind].update(set(getattr(bpy.data, kind)) - before[kind])
        loaded = True
        scenes = [scene for scene in target.scenes if scene]
        if len(scenes) != 1:
            raise ValueError(f'Expected one authored catalog scene in {path}, got {len(scenes)}')
        scene = scenes[0]
        scene[OWNER_KEY] = token
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()
        materials = {mat.name: name for name, mat in zip(names['materials'], target.materials) if mat}
        objects = {obj.name: name for name, obj in zip(names['objects'], target.objects) if obj}
        yield scene, materials, objects
    finally:
        try:
            if not loaded:
                # Recover a failed synchronous library append too.
                for kind in DATA_KINDS:
                    owner['owned'][kind].update(set(getattr(bpy.data, kind)) - before[kind])
            elif scene is not None and _live(scene, bpy.data.scenes):
                capture_owned(scene)
            _cleanup_owned(owner, previous)
        finally:
            _OWNERS.pop(token, None)


def mesh_bounds(obj):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    if not points:
        return None
    lo = [min(point[i] for point in points) for i in range(3)]
    hi = [max(point[i] for point in points) for i in range(3)]
    return {'min': lo, 'max': hi, 'size': [hi[i] - lo[i] for i in range(3)]}


def inspect(root, ids):
    root = Path(root)
    target = root / 'assets-source/catalog-realism/source-inventory.json'
    result = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'version': 1, 'models': {}}
    summaries = []
    for catalog_id in ids:
        started = time.monotonic()
        with load_source(root / f'assets-source/blender/{catalog_id}.blend') as (scene, material_names, object_names):
            records = []
            for obj in scene.objects:
                if obj.type != 'MESH':
                    continue
                obj.data.calc_loop_triangles()
                records.append({'name': object_names[obj.name], 'materials': [material_names[m.name] for m in obj.data.materials if m],
                                'vertices': len(obj.data.vertices), 'triangles': len(obj.data.loop_triangles),
                                'bounds': mesh_bounds(obj), 'modifiers': [m.type for m in obj.modifiers],
                                'motionRole': obj.get('motion_role'), 'sharedGeometry': obj.get('shared_geometry'),
                                'uvLayers': [uv.name for uv in obj.data.uv_layers]})
            result['models'][catalog_id] = {'objects': records, 'nominalDimensionsM': list(scene.get('nominal_dimensions_m', []))}
        summaries.append({'id': catalog_id, 'parts': len(records), 'seconds': round(time.monotonic()-started, 2)})
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8', newline='\n')
        temporary.replace(target)
    return summaries
