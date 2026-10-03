"""Exact reviewed construction correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'designed-coffee-glass'
SOURCE_COMPONENTS = [{'name': 'smoked glass top',
  'vertices': 56,
  'materials': ['smoked-glass'],
  'sourceMaterials': ['smoked-glass'],
  'bounds': {'min': [-0.550000011920929, -0.30000001192092896, 0.3630642890930176],
             'max': [0.550000011920929, 0.30000001192092896, 0.3799999952316284]},
  'kind': 'context'},
 {'name': 'sweeping laminated oak arch',
  'vertices': 252,
  'materials': ['honey-oak'],
  'sourceMaterials': ['honey-oak'],
  'bounds': {'min': [-0.41914403438568115, -0.20082628726959229, 0.0],
             'max': [-0.130855992436409, 0.20082628726959229, 0.3630642890930176]},
  'kind': 'coffee-arch',
  'sides': 12},
 {'name': 'sweeping laminated oak arch.001',
  'vertices': 252,
  'materials': ['honey-oak'],
  'sourceMaterials': ['honey-oak'],
  'bounds': {'min': [0.130855992436409, -0.20082628726959229, 0.0],
             'max': [0.41914403438568115, 0.20082628726959229, 0.3630642890930176]},
  'kind': 'coffee-arch',
  'sides': 12},
 {'name': 'glass support pad',
  'vertices': 56,
  'materials': ['matte-rubber'],
  'sourceMaterials': ['matte-rubber'],
  'bounds': {'min': [-0.3075000047683716, -0.0325000025331974, 0.35459643602371216],
             'max': [-0.24250000715255737, 0.0325000025331974, 0.3630642890930176]},
  'kind': 'context'},
 {'name': 'glass support pad.001',
  'vertices': 56,
  'materials': ['matte-rubber'],
  'sourceMaterials': ['matte-rubber'],
  'bounds': {'min': [0.24250000715255737, -0.0325000025331974, 0.35459643602371216],
             'max': [0.3075000047683716, 0.0325000025331974, 0.3630642890930176]},
  'kind': 'context'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("designed_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
