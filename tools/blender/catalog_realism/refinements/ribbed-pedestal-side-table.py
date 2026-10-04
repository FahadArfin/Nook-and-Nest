"""Exact reviewed source refinement; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'ribbed-pedestal-side-table'
EVIDENCE = {'sourceBlend': {'bytes': 128464,
                 'path': 'assets-source/blender/ribbed-pedestal-side-table.blend',
                 'sha256': '237990ab04306d861df1886f1d709f2f51819d921d77e3223b1bda9bff8d2677'},
 'bounds': {'min': [-0.22499999403953552, -0.22499999403953552, 0.0],
            'max': [0.22499999403953552, 0.22499999403953552, 0.5199999809265137]},
 'objects': [{'name': 'shaped_slab_top',
              'vertices': 192,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.22499999403953552, -0.22499999403953552, 0.4694654941558838],
                         'max': [0.22499999403953552, 0.22499999403953552, 0.5199999809265137]}},
             {'name': 'weighted_elliptic_foot',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.15299999713897705, -0.15299999713897705, 0.0],
                         'max': [0.15299999713897705, 0.15299999713897705, 0.05558794364333153]}},
             {'name': 'sculpted_center_pedestal',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.11999677121639252, -0.11999677121639252, 0.032847434282302856],
                         'max': [0.11999677121639252, 0.11999677121639252, 0.4593586027622223]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('round_fixture_construction.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
