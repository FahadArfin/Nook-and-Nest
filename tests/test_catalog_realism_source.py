"""Ownership regressions run against fake Blender IDs without opening Blender."""
from contextlib import contextmanager
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


KINDS = ('scenes', 'objects', 'collections', 'meshes', 'curves', 'metaballs',
         'armatures', 'materials', 'images', 'textures', 'node_groups',
         'cameras', 'lights', 'worlds', 'actions')


class Id:
    def __init__(self, data, kind, name, dependencies=()):
        self.data, self.kind, self.name = data, kind, name
        self.dependencies, self.properties = set(dependencies), {}
        self.use_fake_user = False

    def get(self, key, default=None):
        return self.properties.get(key, default)

    def __setitem__(self, key, value):
        self.properties[key] = value

    def __getitem__(self, key):
        return self.properties[key]

    @property
    def objects(self):
        return {value for value in self.dependencies if value.kind == 'objects'}

    @property
    def users_scene(self):
        return {scene for scene in self.data.scenes if self in scene.objects}

    @property
    def users(self):
        return sum(self in value.dependencies for value in self.data.all_ids()) + int(self.use_fake_user)


class Collection(list):
    def __init__(self, data):
        super().__init__()
        self.data = data

    def remove(self, value, do_unlink=False):
        for other in self.data.all_ids():
            other.dependencies.discard(value)
        super().remove(value)

    def get(self, name):
        return next((value for value in self if value.name == name), None)


class Data:
    def __init__(self):
        for kind in KINDS:
            setattr(self, kind, Collection(self))
        self.libraries = SimpleNamespace(load=self.load)

    def new(self, kind, name, dependencies=()):
        value = Id(self, kind, name, dependencies)
        getattr(self, kind).append(value)
        return value

    def all_ids(self):
        return [value for kind in KINDS for value in getattr(self, kind)]

    def user_map(self):
        return {value: {other for other in self.all_ids() if value in other.dependencies}
                for value in self.all_ids()}

    @contextmanager
    def load(self, path, link=False):
        source = SimpleNamespace(scenes=['candidate'], materials=['wood'], objects=['leg'])
        target = SimpleNamespace()
        yield source, target
        material = self.new('materials', 'wood')
        mesh = self.new('meshes', 'leg mesh', [material])
        obj = self.new('objects', 'leg', [mesh])
        scene = self.new('scenes', 'candidate', [obj])
        target.scenes, target.materials, target.objects = [scene], [material], [obj]


class SourceOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.data = Data()
        self.previous = self.data.new('scenes', 'user scene')
        self.window = SimpleNamespace(scene=self.previous)
        bpy = SimpleNamespace(data=self.data, context=SimpleNamespace(
            window=self.window, view_layer=SimpleNamespace(update=lambda: None)))
        with patch.dict(sys.modules, {'bpy': bpy, 'mathutils': SimpleNamespace(Vector=object)}):
            self.module = runpy.run_path(str(Path(__file__).resolve().parents[1] /
                                           'tools/blender/catalog_realism/source.py'))

    def test_cleanup_reclaims_exact_import_and_registered_export_orphans(self):
        with self.module['load_source']('fixture.blend') as (scene, materials, names):
            self.assertEqual(materials, {'wood': 'wood'})
            self.assertEqual(names, {'leg': 'leg'})
            exported = self.data.new('scenes', 'export')
            exported['catalog_realism_owner'] = scene['catalog_realism_owner']
            mesh = self.data.new('meshes', 'export copy')
            obj = self.data.new('objects', 'export copy', [mesh])
            exported.dependencies.add(obj)
            self.module['capture_owned'](exported)
            self.data.objects.remove(obj, do_unlink=True)  # Simulated join.
            self.window.scene = scene
        self.assertEqual(self.data.all_ids(), [self.previous])
        self.assertIs(self.window.scene, self.previous)

    def test_unrelated_new_scene_and_orphan_data_survive_and_keep_active_context(self):
        with self.module['load_source']('fixture.blend'):
            unrelated = self.data.new('scenes', 'user new scene')
            mesh = self.data.new('meshes', 'user new mesh')
            obj = self.data.new('objects', 'user new object', [mesh])
            unrelated.dependencies.add(obj)
            orphan = self.data.new('materials', 'user unused material')
            self.window.scene = unrelated
        self.assertEqual(set(self.data.all_ids()), {self.previous, unrelated, mesh, obj, orphan})
        self.assertIs(self.window.scene, unrelated)

    def test_external_link_to_owned_object_preserves_work_for_inspection(self):
        with self.module['load_source']('fixture.blend') as (scene, _, _):
            obj = next(iter(scene.objects))
            self.previous.dependencies.add(obj)
        self.assertIn(scene, self.data.scenes)
        self.assertIn(obj, self.previous.objects)
        self.assertEqual(len(self.data.meshes), 1)

    def test_prior_object_linked_into_owned_scene_is_not_deleted(self):
        prior = self.data.new('objects', 'user existing object')
        self.previous.dependencies.add(prior)
        with self.module['load_source']('fixture.blend') as (scene, _, _):
            scene.dependencies.add(prior)
        self.assertIn(prior, self.data.objects)
        self.assertIn(scene, self.data.scenes)

    def test_shared_material_survives_after_its_owned_mesh_is_removed(self):
        prior_mesh = self.data.new('meshes', 'user mesh')
        with self.module['load_source']('fixture.blend'):
            material = self.data.materials[0]
            prior_mesh.dependencies.add(material)
        self.assertIn(material, self.data.materials)
        self.assertEqual(set(self.data.meshes), {prior_mesh})

    def test_failed_authoring_still_reclaims_its_source(self):
        with self.assertRaisesRegex(ValueError, 'fixture failure'):
            with self.module['load_source']('fixture.blend'):
                raise ValueError('fixture failure')
        self.assertEqual(self.data.all_ids(), [self.previous])

    def test_cleanup_snapshots_each_scene_once_without_per_object_users_scene(self):
        owned_scene = self.data.new('scenes', 'owned scene')
        owned_objects = {self.data.new('objects', f'owned object {i}') for i in range(200)}
        owned_scene.dependencies.update(owned_objects)
        unrelated_scene = self.data.new('scenes', 'unrelated scene')
        unrelated_object = self.data.new('objects', 'unrelated object')
        unrelated_scene.dependencies.add(unrelated_object)
        owner = {'owned': {kind: set() for kind in KINDS}}
        owner['owned']['scenes'] = {owned_scene}
        owner['owned']['objects'] = owned_objects
        reads = {}
        original_objects = Id.objects.fget

        def scene_objects(value):
            reads[value] = reads.get(value, 0) + 1
            return original_objects(value)

        def forbidden_users_scene(value):
            raise AssertionError('Cleanup must not query users_scene for each owned object')

        with patch.object(Id, 'objects', property(scene_objects)), \
                patch.object(Id, 'users_scene', property(forbidden_users_scene)):
            self.module['_cleanup_owned'](owner, self.previous)
        self.assertEqual(reads, {self.previous: 1, owned_scene: 1, unrelated_scene: 1})
        self.assertEqual(set(self.data.all_ids()), {self.previous, unrelated_scene, unrelated_object})

    def test_scene_snapshot_preserves_owned_orphan_linked_into_unrelated_scene(self):
        owned_scene = self.data.new('scenes', 'owned scene')
        orphan = self.data.new('objects', 'owned orphan')
        unrelated_scene = self.data.new('scenes', 'unrelated scene', [orphan])
        owner = {'owned': {kind: set() for kind in KINDS}}
        owner['owned']['scenes'] = {owned_scene}
        owner['owned']['objects'] = {orphan}
        self.window.scene = owned_scene
        before = set(self.data.all_ids())
        self.module['_cleanup_owned'](owner, self.previous)
        self.assertEqual(set(self.data.all_ids()), before)
        self.assertIs(self.window.scene, self.previous)
        self.assertIn(orphan, unrelated_scene.objects)

    def test_live_id_lookup_does_not_iterate_collection_for_unique_names(self):
        class LookupOnly:
            def get(inner, name):
                return self.previous if name == self.previous.name else None

            def __iter__(inner):
                raise AssertionError('Unique ID lookup must not traverse the collection')
        collection = LookupOnly()
        for _ in range(2000):
            self.assertTrue(self.module['_live'](self.previous, collection))
        missing = Id(self.data, 'scenes', 'missing')
        self.assertFalse(self.module['_live'](missing, collection))

    def test_duplicate_linked_library_names_still_require_exact_identity(self):
        duplicate = self.data.new('scenes', self.previous.name)
        self.assertTrue(self.module['_live'](duplicate, self.data.scenes))
        removed = Id(self.data, 'scenes', self.previous.name)
        self.assertFalse(self.module['_live'](removed, self.data.scenes))

    def test_removed_blender_wrapper_is_not_dereferenced_during_cleanup(self):
        class Removed:
            @property
            def name(self):
                raise ReferenceError('StructRNA of type Object has been removed')
        self.assertFalse(self.module['_live'](Removed(), self.data.objects))


if __name__ == '__main__':
    unittest.main()
