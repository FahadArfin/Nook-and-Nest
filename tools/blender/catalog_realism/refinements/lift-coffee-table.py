"""Exact reviewed source correction; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'lift-coffee-table'
SOURCE_SHA256 = 'da6a5bd414a59422d96011d43fd13bc76cb96c0642d2f8cce7e4b14977031a98'
SOURCE_COMPONENTS = [{'name': 'beveled_slab_top',
  'vertices': 96,
  'materials': ['variant-surface'],
  'sourceMaterials': ['variant-surface'],
  'bounds': {'min': [-0.550000011920929, -0.30000001192092896, 0.4071633517742157],
             'max': [0.550000011920929, 0.30000001192092896, 0.46000000834465027]},
  'kind': 'hard'},
 {'name': 'folded_steel_trestle',
  'vertices': 32,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.4519999921321869, -0.2507614493370056, 0.0],
             'max': [-0.4059999883174896, 0.2507614493370056, 0.41497522592544556]},
  'kind': 'hard'},
 {'name': 'folded_steel_trestle.001',
  'vertices': 32,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.4059999883174896, -0.2507614493370056, 0.0],
             'max': [0.4519999921321869, 0.2507614493370056, 0.41497522592544556]},
  'kind': 'hard'},
 {'name': 'under_top_support_frame',
  'vertices': 96,
  'materials': ['variant-surface'],
  'sourceMaterials': ['variant-surface'],
  'bounds': {'min': [-0.4399999976158142, -0.19199998676776886, 0.3786315619945526],
             'max': [0.4399999976158142, 0.19199998676776886, 0.4082200825214386]},
  'kind': 'hard'},
 {'name': 'inset_lower_shelf',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured'],
  'bounds': {'min': [-0.40700000524520874, -0.1889999806880951, 0.0859166756272316],
             'max': [0.40700000524520874, 0.1889999806880951, 0.11127825826406479]},
  'kind': 'hard'},
 {'name': 'shelf_mount',
  'vertices': 16,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.38199999928474426, -0.00800000037997961, 0.0985974669456482],
             'max': [-0.3660000264644623, 0.00800000037997961, 0.4124470055103302]},
  'kind': 'hard'},
 {'name': 'shelf_mount.001',
  'vertices': 16,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.3660000264644623, -0.00800000037997961, 0.0985974669456482],
             'max': [0.38199999928474426, 0.00800000037997961, 0.4124470055103302]},
  'kind': 'hard'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong source-specific recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_living.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
