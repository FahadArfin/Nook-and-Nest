"""Loaded authoring code must match its recorded source bytes for every item."""
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


BUILD = Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/build.py'


class LoadedBuildProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / 'tools/blender/catalog_realism/build.py'
        self.source.parent.mkdir(parents=True)
        self.source.write_bytes(BUILD.read_bytes())
        with patch.dict(sys.modules, {'bpy': SimpleNamespace(),
                                     'mathutils': SimpleNamespace(Matrix=object)}):
            self.module = runpy.run_path(str(self.source))

    def test_unchanged_loaded_source_reaches_catalog_input_validation(self):
        with self.assertRaises(FileNotFoundError) as raised:
            self.module['build'](self.root, 'first')
        self.assertEqual(Path(raised.exception.filename),
                         self.root / 'assets-source/catalog-realism/catalog.json')

    def test_source_change_between_batch_items_fails_before_reading_next_catalog(self):
        # The first item reaches catalog validation. Its ordinary failure is
        # recorded, then an external edit changes the already-loaded module.
        write_json = self.module['write_json']
        written = []

        def after_item(path, data):
            write_json(path, data)
            written.append(data)
            if len(written) == 1:
                self.source.write_bytes(self.source.read_bytes() + b'\n# changed during batch\n')

        with patch.dict(self.module['build_batch'].__globals__, {'write_json': after_item}):
            results = self.module['build_batch'](self.root, ['first', 'second'])
        self.assertEqual([result['id'] for result in results], ['first', 'second'])
        self.assertIn('catalog.json', results[0]['error'])
        self.assertIn('Build module changed since it was loaded', results[1]['error'])
        self.assertNotIn('catalog.json', results[1]['error'])
        self.assertEqual(written, results)
        self.assertFalse((self.root / 'assets-source/catalog-realism/receipts').exists())

    def test_uvless_bud_petals_get_explicit_zero_chart_without_touching_other_models(self):
        class Layers(list):
            def new(self, name, do_init):
                self.assert_no_init = not do_init
                layer = SimpleNamespace(name=name, data=[SimpleNamespace(uv=None) for _ in range(3)])
                self.append(layer)
                return layer
        objects = [SimpleNamespace(name=f'loaded-{i}',type='MESH',data=SimpleNamespace(materials=[SimpleNamespace(name='rose')],uv_layers=Layers())) for i in range(18)]
        scene = SimpleNamespace(objects=objects)
        names = {o.name: 'flower_petal' + (f'.{i:03d}' if i else '') for i,o in enumerate(objects)}
        prepare = self.module['prepare_legacy_source_uv']
        self.assertEqual(prepare(scene, {'id':'other'}, {'rose':'dusty-rose'}, names), [])
        self.assertTrue(all(not o.data.uv_layers for o in objects))
        evidence = prepare(scene, {'id':'bud-vase-trio'}, {'rose':'dusty-rose'}, names)
        self.assertEqual(evidence[0]['objects'],18)
        self.assertTrue(all(o.data.uv_layers.assert_no_init and all(x.uv == (0.0,0.0) for x in o.data.uv_layers[0].data) for o in objects))
        with self.assertRaisesRegex(ValueError,'source UV'):
            prepare(scene, {'id':'bud-vase-trio'}, {'rose':'dusty-rose'}, names)


if __name__ == '__main__':
    unittest.main()
