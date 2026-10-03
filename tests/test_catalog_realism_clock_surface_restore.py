from pathlib import Path
import runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class ClockSurfaceTests(unittest.TestCase):
 def test_restoration_keeps_baseline_factors_and_rejects_textured_or_changed_source(self):
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/clock_surface_restore.py'))
  baseline={'name':'satin-steel','pbrMetallicRoughness':{'baseColorFactor':[.5,.56,.6,1],'metallicFactor':.8,'roughnessFactor':.32}}
  source={'Base Color':[.5,.56,.6,1],'Metallic':.8,'Roughness':.32,'Normal':[0,0,0]}
  self.assertEqual(h['restoration'](baseline,source),{'roughness':.32,'normal':'geometric shading normal','metallic':.8,'baseColor':[.5,.56,.6,1]})
  with self.assertRaises(ValueError):h['restoration']({**baseline,'normalTexture':{'index':0}},source)
  with self.assertRaises(ValueError):h['restoration'](baseline,{**source,'Roughness':.8})
  with self.assertRaises(ValueError):h['restoration']({**baseline,'name':'champagne-brass'},source)
if __name__=='__main__':unittest.main()
