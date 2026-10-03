"""Exact reviewed construction correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'designed-mirror-faceted'
SOURCE_COMPONENTS = [{'name': 'silvered mirror glass',
  'vertices': 8,
  'materials': ['silvered-mirror'],
  'sourceMaterials': ['silvered-mirror'],
  'bounds': {'min': [-0.31223738193511963, -0.0150773199275136, 0.03689642250537872],
             'max': [0.31223738193511963, -0.0150773199275136, 0.7634721398353577]},
  'kind': 'context',
  'sides': 6},
 {'name': 'sculpted mirror frame',
  'vertices': 108,
  'materials': ['walnut'],
  'sourceMaterials': ['walnut'],
  'bounds': {'min': [-0.3499999940395355, -0.020180413499474525, 0.0],
             'max': [0.3499999940395355, 0.02250000089406967, 0.800000011920929]},
  'kind': 'mirror',
  'sides': 12},
 {'name': 'inner polished reveal',
  'vertices': 54,
  'materials': ['champagne-brass'],
  'sourceMaterials': ['champagne-brass'],
  'bounds': {'min': [-0.3179340660572052, -0.02250000089406967, 0.030654234811663628],
             'max': [0.3179340660572052, -0.01693299040198326, 0.7696718573570251]},
  'kind': 'mirror',
  'sides': 6}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("designed_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
