"""Exact reviewed construction correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'designed-sunroom-chair'
SOURCE_COMPONENTS = [{'name': 'arched back frame',
  'vertices': 60,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan'],
  'bounds': {'min': [-0.3731212317943573, 0.3234044313430786, 0.31574809551239014],
             'max': [0.3731212317943573, 0.3574469983577728, 0.7800000309944153]},
  'kind': 'back-frame',
  'sides': 10},
 {'name': 'continuous bent arm',
  'vertices': 50,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan'],
  'bounds': {'min': [-0.3800000250339508, -0.338580846786499, 0.31574809551239014],
             'max': [-0.3487328588962555, 0.34674903750419617, 0.5789931416511536]},
  'kind': 'arm',
  'sides': 10},
 {'name': 'continuous bent arm.001',
  'vertices': 50,
  'materials': ['natural-rattan'],
  'sourceMaterials': ['natural-rattan'],
  'bounds': {'min': [0.3487328588962555, -0.338580846786499, 0.31574809551239014],
             'max': [0.3800000250339508, 0.34674903750419617, 0.5789931416511536]},
  'kind': 'arm',
  'sides': 10}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("designed_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
