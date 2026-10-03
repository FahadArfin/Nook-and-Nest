"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'pleated-table-lamp'
SOURCE_SHA256 = 'c0ea383b8f4e808fa9b945049ffcbb680e2fb0aa2c042b812c11cd34afb442cc'
SOURCE_COMPONENTS = [{'name': 'lamp_foot',
  'vertices': 144,
  'materials': ['warm-brass'],
  'sourceMaterials': ['warm-brass'],
  'bounds': {'min': [-0.1441200077533722, -0.1441200077533722, 0.0],
             'max': [0.1441200077533722, 0.1441199779510498, 0.0411142036318779]}},
 {'name': 'shade_core',
  'vertices': 144,
  'materials': ['warm-porcelain'],
  'sourceMaterials': ['warm-porcelain'],
  'bounds': {'min': [-0.14747163653373718, -0.14747163653373718, 0.3153459429740906],
             'max': [0.14747163653373718, 0.1474716067314148, 0.518450140953064]}},
 {'name': 'linen_pleat',
  'vertices': 112,
  'materials': ['linen-textured'],
  'sourceMaterials': ['linen-textured'],
  'bounds': {'min': [0.11100593954324722, -0.007674068212509155, 0.30845120549201965],
             'max': [0.17000000178813934, 0.007736173924058676, 0.5199999809265137]}},
 {'name': 'lampshade_bound_hem',
  'vertices': 492,
  'materials': ['tailored-tone-on-tone-stitch'],
  'sourceMaterials': ['tailored-tone-on-tone-stitch'],
  'bounds': {'min': [-0.14337636530399323, -0.1429043710231781, 0.32180851697921753],
             'max': [0.14401262998580933, 0.14360913634300232, 0.5119474530220032]}}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    changes = []
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
