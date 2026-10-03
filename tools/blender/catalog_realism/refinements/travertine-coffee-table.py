"""Isolated correction bound to the reviewed original source."""
from pathlib import Path
import runpy

CATALOG_ID = 'travertine-coffee-table'
EVIDENCE = {'sourceBlend': {'bytes': 109209,
                 'path': 'assets-source/blender/travertine-coffee-table.blend',
                 'sha256': 'e51ff8fbff86eae76816c80a7a29463895beae2c336de6df3d51fffda68c1d8f'},
 'bounds': {'min': [-0.6000000238418579, -0.3499999940395355, 0.0],
            'max': [0.6000000238418579, 0.3499999940395355, 0.3799999952316284]},
 'objects': [{'name': 'beveled_slab_top',
              'vertices': 96,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.6000000238418579, -0.3499999940395355, 0.32960212230682373],
                         'max': [0.6000000238418579, 0.3499999940395355, 0.3799999952316284]}},
             {'name': 'arch_pier',
              'vertices': 96,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.4050000011920929, -0.24849998950958252, 0.0],
                         'max': [-0.3149999976158142, -0.12950000166893005, 0.26610079407691956]}},
             {'name': 'arch_pier.001',
              'vertices': 96,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.4050000011920929, 0.12950000166893005, 0.0],
                         'max': [-0.3149999976158142, 0.24849998950958252, 0.26610079407691956]}},
             {'name': 'arched_stone_bridge',
              'vertices': 200,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.4399999976158142, -0.2753739356994629, 0.17393238842487335],
                         'max': [-0.2800000011920929, 0.2753739356994629, 0.3680254817008972]}},
             {'name': 'arch_pier.002',
              'vertices': 96,
              'materials': ['variant-surface'],
              'bounds': {'min': [0.3149999976158142, -0.24849998950958252, 0.0],
                         'max': [0.4050000011920929, -0.12950000166893005, 0.26610079407691956]}},
             {'name': 'arch_pier.003',
              'vertices': 96,
              'materials': ['variant-surface'],
              'bounds': {'min': [0.3149999976158142, 0.12950000166893005, 0.0],
                         'max': [0.4050000011920929, 0.24849998950958252, 0.26610079407691956]}},
             {'name': 'arched_stone_bridge.001',
              'vertices': 200,
              'materials': ['variant-surface'],
              'bounds': {'min': [0.2800000011920929, -0.2753739356994629, 0.17393238842487335],
                         'max': [0.4399999976158142, 0.2753739356994629, 0.3680254817008972]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong exact catalog refinement")
    helper=runpy.run_path(str(Path(__file__).with_name("final_seating_fixtures.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
