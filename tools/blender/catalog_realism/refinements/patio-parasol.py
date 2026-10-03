"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'patio-parasol'
SOURCE_SHA256 = '1bcacb215c1275f1bc8cd71a5e91729763b9860eb59446e90970efe1044d0908'
SOURCE_COMPONENTS = [{'name': 'curved_sewn_canopy_gore',
  'vertices': 196,
  'materials': ['canvas-piping'],
  'sourceMaterials': ['canvas-piping'],
  'bounds': {'min': [-1.199628472328186, -1.199628472328186, 2.019481897354126],
             'max': [1.199628472328186, 1.199628472328186, 2.4433236122131348]}},
 {'name': 'curved_sewn_canopy_gore.001',
  'vertices': 196,
  'materials': ['upholstery-textured'],
  'sourceMaterials': ['upholstery-textured'],
  'bounds': {'min': [-1.199628472328186, -1.199628472328186, 2.019481897354126],
             'max': [1.199628472328186, 1.199628472328186, 2.4433236122131348]}}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    changes = []
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
