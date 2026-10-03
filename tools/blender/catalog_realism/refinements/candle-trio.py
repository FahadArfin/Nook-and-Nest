"""Exact reviewed textile/turned construction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'candle-trio'
SOURCE_COMPONENTS = [{'name': 'glowing_wick',
  'vertices': 144,
  'materials': ['warm-light'],
  'bounds': {'min': [-0.1157446801662445, -0.011999999172985554, 0.12499009072780609],
             'max': [-0.10212766379117966, 0.011999999172985554, 0.14875248074531555]},
  'kind': 'flame'},
 {'name': 'glowing_wick.001',
  'vertices': 144,
  'materials': ['warm-light'],
  'bounds': {'min': [-0.0068085105158388615, -0.011999999172985554, 0.1706138551235199],
             'max': [0.0068085105158388615, 0.011999999172985554, 0.19437624514102936]},
  'kind': 'flame'},
 {'name': 'glowing_wick.002',
  'vertices': 144,
  'materials': ['warm-light'],
  'bounds': {'min': [0.10212766379117966, -0.011999999172985554, 0.2162376195192337],
             'max': [0.1157446801662445, 0.011999999172985554, 0.23999999463558197]},
  'kind': 'flame'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("textile_turning.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
