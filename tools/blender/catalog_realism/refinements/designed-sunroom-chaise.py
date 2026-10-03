"""Exact reviewed construction correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'designed-sunroom-chaise'
SOURCE_COMPONENTS = [{'name': 'continuous bent arm.001',
  'vertices': 50,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan.002'],
  'bounds': {'min': [0.36866840720176697, -0.7185993194580078, 0.3159468173980713],
             'max': [0.4000000059604645, 0.7433504462242126, 0.5789403915405273]},
  'kind': 'arm',
  'sides': 10},
 {'name': 'continuous bent arm',
  'vertices': 50,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan.002'],
  'bounds': {'min': [-0.4000000059604645, -0.7185993194580078, 0.3159468173980713],
             'max': [-0.36866840720176697, 0.7433504462242126, 0.5789403915405273]},
  'kind': 'arm',
  'sides': 10},
 {'name': 'arched back frame',
  'vertices': 60,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan.002'],
  'bounds': {'min': [-0.3926892876625061, 0.7226633429527283, 0.3159468173980713],
             'max': [0.3926892876625061, 0.7574905157089233, 0.800000011920929]},
  'kind': 'back-frame',
  'sides': 10}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("designed_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
