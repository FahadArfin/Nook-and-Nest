"""Camera framing and review binding checks without importing Blender."""
import importlib.util
from io import BytesIO
import math
import json
from pathlib import Path
import subprocess
import unittest
from PIL import Image

module = Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/review.py'
spec = importlib.util.spec_from_file_location('catalog_realism_review', module)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class ReviewMathTests(unittest.TestCase):
    def test_whole_model_views_contain_every_corner_of_tall_flat_and_offset_models(self):
        shapes = [([-.5, -.4, 0], [.5, .4, 3]), ([-3, -1, 4], [3, 1, 4.008]), ([20, -9, -3], [20.2, -8.9, -2.8])]
        for low, high in shapes:
            for view in ('front', 'rear', 'clay', 'underside'):
                for resolution in ((640, 480), (480, 900)):
                    with self.subTest(low=low, view=view, resolution=resolution):
                        frame = review.camera_frame(low, high, view, resolution)
                        for point in review.bounds_corners(low, high):
                            x, y, depth = review.project_to_frame(point, frame)
                            self.assertGreaterEqual(x, 0)
                            self.assertLessEqual(x, 1)
                            self.assertGreaterEqual(y, 0)
                            self.assertLessEqual(y, 1)
                            self.assertGreater(depth, frame['clipStart'])
                            self.assertLess(depth, frame['clipEnd'])

    def test_translation_changes_only_frame_location_not_zoom_or_basis(self):
        low, high, offset = [-1, -.5, 0], [1, .5, 1], [11, -7, 9]
        original = review.camera_frame(low, high, 'underside', (640, 480))
        shifted = review.camera_frame([a+b for a,b in zip(low,offset)], [a+b for a,b in zip(high,offset)], 'underside', (640, 480))
        self.assertAlmostEqual(original['orthoScale'], shifted['orthoScale'])
        self.assertEqual(original['right'], shifted['right'])
        self.assertEqual(original['up'], shifted['up'])
        for axis in range(3):
            self.assertAlmostEqual(shifted['position'][axis]-original['position'][axis], offset[axis])

    def test_detail_fits_center_region_and_does_not_claim_whole_model_coverage(self):
        frame = review.camera_frame([-2, -1, .5], [2, 1, 1.5], 'detail', (640, 480))
        self.assertEqual(frame['target'], [0, 0, 1])
        self.assertEqual(frame['coverage'], 'central-region')
        front = review.camera_frame([-2, -1, .5], [2, 1, 1.5], 'front', (640, 480))
        self.assertLess(frame['orthoScale'], front['orthoScale'])
        self.assertTrue(any(x<0 or x>1 or y<0 or y>1 for x,y,_ in [review.project_to_frame(point,frame) for point in review.bounds_corners([-2,-1,.5],[2,1,1.5])]))

    def test_invalid_bounds_and_unbounded_render_settings_are_rejected(self):
        for bounds in [([0,0,0],[0,0,0]),([1,0,0],[0,1,1]),([math.nan,0,0],[1,1,1])]:
            with self.assertRaises(ValueError):
                review.camera_frame(*bounds,'front',(640,480))
        for options in [(('front','front'),(640,480),32),(('missing',),(640,480),32),(('front',),(10,480),32),(('front',),(640,480),1000)]:
            with self.assertRaises(ValueError):
                review.validate_render_options(*options)

    def test_configuration_hash_binds_sampling_and_render_recipe_without_key_order_dependence(self):
        a={'resolution':[640,480],'samples':32,'engine':'CYCLES','camera':{'padding':1.15,'view':'front'}}
        b={'camera':{'view':'front','padding':1.15},'engine':'CYCLES','samples':32,'resolution':[640,480]}
        self.assertEqual(review.config_hash(a),review.config_hash(b))
        b['samples']=24
        self.assertNotEqual(review.config_hash(a),review.config_hash(b))

    def test_configuration_binding_survives_javascript_number_and_unicode_round_trip(self):
        configuration={'one':1.0,'zero':-0.0,'tiny':1e-7,'large':1.2345678901234567e20,
                       'nested':{'float32':.14000000059604645,'label':'paper café','enabled':True}}
        binding=review.configuration_binding(configuration)
        rewritten=json.loads(subprocess.run(['node','-e','let s="";process.stdin.on("data",v=>s+=v);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s))));'],
                                           input=json.dumps(binding),encoding='utf8',capture_output=True,check=True).stdout)
        self.assertNotEqual(review.config_hash(configuration),review.config_hash(rewritten['configuration']))
        self.assertEqual(binding['configurationJson'],rewritten['configurationJson'])
        self.assertEqual(review.verify_configuration_binding(rewritten),binding['configurationSha256'])

    def test_configuration_binding_rejects_stale_text_semantics_nonfinite_and_missing_evidence(self):
        for mutation in [lambda b:b.update(configurationSha256='0'*64),lambda b:b['configuration'].update(samples=8),
                         lambda b:b.pop('configurationJson'),lambda b:b['configuration'].update(enabled=1)]:
            binding=review.configuration_binding({'samples':32,'enabled':True})
            mutation(binding)
            with self.assertRaisesRegex(ValueError,'configuration|Configuration'):
                review.verify_configuration_binding(binding)
        with self.assertRaises(ValueError):
            review.configuration_binding({'samples':math.inf})

    def test_app_colors_match_babylon_variant_math_and_seam_rules(self):
        settings={'defaults':{'armchair':'camel','sofa':'moss','chester-sofa':'camel'},'variants':{'white':'#f5f4ef','sage':'#97a67c','camel':'#89613c','moss':'#405e42'},'sofaIds':['sofa','chester-sofa'], 'slots':{'sofa':['upholstery-textured'],'chester-sofa':['upholstery-textured']}}
        materials=[{'name':'upholstery-textured','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,.8]}},{'name':'tailored-seam'},{'name':'wood-honey-textured'},{'name':'warm-brass'}]
        armchair=review.default_material_colors('armchair',materials,settings)
        self.assertEqual(len(armchair),1)
        self.assertEqual(armchair[0]['renderBaseColorFactor'],[.1+.9*n/255 for n in (137,97,60)]+[.8])
        sofa=review.default_material_colors('sofa',materials,settings)
        self.assertEqual(len(sofa),2)
        for actual,channel in zip(sofa[1]['renderBaseColorFactor'][:3],(64,94,66)):
            self.assertAlmostEqual(actual,(channel/255)**2.2*.72)
        chester=review.default_material_colors('chester-sofa',materials,settings)
        self.assertEqual(chester[-1]['rule'],'sofa-tuft-button-0.70')
        self.assertEqual(materials[0]['pbrMetallicRoughness']['baseColorFactor'],[1,1,1,.8])

    def test_default_white_and_countertop_color_override_are_explicit(self):
        settings={'defaults':{},'variants':{'white':'#f5f4ef','sage':'#97a67c'},'sofaIds':[],'slots':{}}
        values=review.default_material_colors('side-table',[{'name':'variant-surface'},{'name':'countertop-surface'}],settings)
        self.assertEqual(values[0]['variant'],'white')
        self.assertEqual(values[1]['renderBaseColorFactor'],[1,1,1,1])
        self.assertEqual(values[1]['rule'],'countertop-white-factor')

    def test_beta_catalog_colors_linearize_other_families_without_adding_sofa_seams(self):
        settings={'defaults':{'queen-bed':'sage'},'variants':{'white':'#f5f4ef','sage':'#97a67c'},'sofaIds':[],'slots':{}}
        values=review.default_material_colors('queen-bed',[{'name':'upholstery-textured'},{'name':'tailored-seam'}],settings,catalog_mode=True)
        self.assertEqual(len(values),1)
        self.assertEqual(values[0]['rule'],'catalog-realism-linear-gamma-2.2')
        for actual,channel in zip(values[0]['renderBaseColorFactor'][:3],(151,166,124)):
            self.assertAlmostEqual(actual,(channel/255)**2.2)

    def test_bedding_trim_is_tone_on_tone_only_in_beta(self):
        settings={'defaults':{'queen-bed':'sage'},'variants':{'white':'#f5f4ef','sage':'#97a67c'},'sofaIds':[],'slots':{},'bedIds':['queen-bed']}
        materials=[{'name':'upholstery-textured'},{'name':'modern-tailored-welting'},{'name':'modern-porcelain-detail'}]
        self.assertEqual(len(review.default_material_colors('queen-bed',materials,settings)),1)
        values=review.default_material_colors('queen-bed',materials,settings,catalog_mode=True)
        self.assertEqual(len(values),2)
        self.assertEqual(values[1]['rule'],'bedding-seam-0.72')
        for body,trim in zip(values[0]['renderBaseColorFactor'][:3],values[1]['renderBaseColorFactor'][:3]):
            self.assertAlmostEqual(trim,body*.72)

    def test_review_webp_requires_lossless_vp8l_and_requested_dimensions(self):
        self.assertTrue(hasattr(review,'validate_lossless_webp'))
        image=Image.new('RGB',(32,24),(17,29,73))
        output=BytesIO();image.save(output,format='WEBP',lossless=True)
        self.assertEqual(review.validate_lossless_webp(output.getvalue(),(32,24)),{'width':32,'height':24,'encoding':'VP8L'})
        lossy=BytesIO();image.save(lossy,format='WEBP',quality=100)
        for raw,dimensions in [(lossy.getvalue(),(32,24)),(output.getvalue(),(64,24)),(output.getvalue()[:-1],(32,24))]:
            with self.assertRaises(ValueError):
                review.validate_lossless_webp(raw,dimensions)


if __name__ == '__main__':
    unittest.main()
