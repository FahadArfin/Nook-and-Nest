import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

FILE = Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/scans.py'
spec = importlib.util.spec_from_file_location('scans', FILE)
scans = importlib.util.module_from_spec(spec) if FILE.exists() else None
if scans:
    spec.loader.exec_module(scans)


class ScanTests(unittest.TestCase):
    def fixture(self, root):
        def write(name, value):
            path = root/name; path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value if isinstance(value, bytes) else json.dumps(value).encode())
        image = b'full-quality licensed scan'
        source = 'public/textures/realism/material-oak-color.jpg'
        write(source, image); write('public/models/furniture/bookshelf.glb', b'frozen GLB bytes')
        write('normal.jpg',b'licensed normal');write('orm.jpg',b'licensed orm')
        baseline_hash = hashlib.sha256(b'frozen GLB bytes').hexdigest()
        wood = {'name':'wood-honey-textured','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.82}}
        art = {'name':'original-studio-art','pbrMetallicRoughness':{'baseColorTexture':{'index':0}}}
        item = {'id':'bookshelf','baselineGlb':{'path':'public/models/furniture/bookshelf.glb','sha256':baseline_hash},'baselineGltf':{'materials':[wood,art],'textures':[{'source':0}],'images':[{'sha256':'a'*64}]}}
        write('assets-source/catalog-realism/catalog.json',{'version':1,'scope':'beta-only','items':[item]})
        write('assets-source/catalog-realism/material-plan.json',{'models':{'bookshelf':{'baselineGlbSha256':baseline_hash,'materials':[{'materialKey':'wood-honey-textured','profile':'wood','protectedReason':None},{'materialKey':'original-studio-art','profile':'wood','protectedReason':None}]}}})
        write('assets-source/realism-materials.json',{'materials':{'oak':{'baseColor':source,'normal':'normal.jpg','orm':'orm.jpg','grainAxis':'v','repeatM':1.83,'source':'https://polyhaven.com/a/oak_veneer_01','license':'CC0-1.0'}}})
        write('assets-source/realism-scans.json',{'scans':{}})
        write('assets-source/realism-texture-provenance.json',{'license':'CC0-1.0','assets':[{'asset':{'url':'https://polyhaven.com/a/oak_veneer_01','license':'CC0'}}]})
        return write, source

    def test_plan_is_explicit_per_model_and_protects_mislabeled_art(self):
        self.assertIsNotNone(scans,'Scan planner must be implemented')
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); write, source=self.fixture(root)
            plan=scans.build_plan(root)
            materials=plan['models']['bookshelf']['materials']
            self.assertEqual([m['materialKey'] for m in materials],['wood-honey-textured'])
            self.assertEqual(materials[0]['family'],'oak')
            self.assertEqual(materials[0]['repeatM'],[1.83,1.83])
            self.assertEqual(materials[0]['replacements'][0]['oldSha256'],'a'*64)
            write(scans.PLAN,plan)
            replacement=scans.replacements_for(root,'bookshelf')['wood-honey-textured']
            self.assertEqual(replacement['source']['path'],source)
            self.assertEqual(replacement['texCoord'],1)

    def test_changed_scan_or_changed_plan_input_is_not_reused(self):
        self.assertIsNotNone(scans,'Scan planner must be implemented')
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); write, source=self.fixture(root)
            write(scans.PLAN,scans.build_plan(root));write(source,b'changed pixels')
            with self.assertRaisesRegex(ValueError,'hash|changed'):
                scans.replacements_for(root,'bookshelf')

    def test_coherent_maps_include_absent_channels_without_inventing_old_hashes(self):
        self.assertTrue(scans and hasattr(scans,'scan_materials_for'),'Full scan material API required')
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);write,source=self.fixture(root);write(scans.PLAN,scans.build_plan(root))
            bundle=scans.scan_materials_for(root,'bookshelf')['wood-honey-textured']
            self.assertEqual([entry['kind'] for entry in bundle['maps']],['baseColor','normal','orm'])
            self.assertEqual([entry['kind'] for entry in bundle['replacements']],['baseColor'])
            self.assertEqual(bundle['normalStrength'],.14)
            self.assertEqual(bundle['roughnessFactor'],.82)
            self.assertEqual(bundle['grainAxis'],'v')
            self.assertNotIn('oldSha256',bundle['maps'][1])
