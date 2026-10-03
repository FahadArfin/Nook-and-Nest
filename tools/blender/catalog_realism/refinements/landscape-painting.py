"""Exact reviewed source correction; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'landscape-painting'
SOURCE_SHA256 = 'f709fb3dcfb8527fabcc9e01f4f33d67ec0a9f6b8784a97dea5eda180ca3c1cd'
SOURCE_COMPONENTS = [{'name': 'valley_art',
  'vertices': 96,
  'materials': ['artwork-landscape'],
  'sourceMaterials': ['artwork-landscape'],
  'bounds': {'min': [-0.3779999911785126, -0.04129999876022339, 0.06825000047683716],
             'max': [0.3779999911785126, -0.02589999884366989, 0.5817499756813049]},
  'kind': 'hard'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong source-specific recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_living.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
