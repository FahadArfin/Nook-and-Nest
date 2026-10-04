"""Exact reviewed construction correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'designed-mirror-arch'
SOURCE_COMPONENTS = [{'name': 'silvered mirror glass',
  'vertices': 36,
  'materials': ['silvered-mirror'],
  'sourceMaterials': ['silvered-mirror'],
  'bounds': {'min': [-0.2951286733150482, -0.009612676687538624, 0.030909091234207153],
             'max': [0.2951286733150482, -0.009612676687538624, 0.8190909028053284]},
  'kind': 'context',
  'sides': 6},
 {'name': 'sculpted mirror frame',
  'vertices': 444,
  'materials': ['champagne-brass'],
  'sourceMaterials': ['champagne-brass'],
  'bounds': {'min': [-0.32500001788139343, -0.012077465653419495, 0.0],
             'max': [0.32500001788139343, 0.017500000074505806, 0.8500000238418579]},
  'kind': 'mirror',
  'sides': 12},
 {'name': 'inner polished reveal',
  'vertices': 222,
  'materials': ['champagne-brass'],
  'sourceMaterials': ['champagne-brass'],
  'bounds': {'min': [-0.3011029362678528, -0.017500000074505806, 0.024294473230838776],
             'max': [0.3011029362678528, -0.011584507301449776, 0.8257055282592773]},
  'kind': 'mirror',
  'sides': 6}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("designed_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
