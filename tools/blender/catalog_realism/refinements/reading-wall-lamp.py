"""Exact reviewed source refinement; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'reading-wall-lamp'
EVIDENCE = {'sourceBlend': {'bytes': 143214,
                 'path': 'assets-source/blender/reading-wall-lamp.blend',
                 'sha256': '00b6f77e9b999a2b81f7cc58fef991fc4c73dc48521ff268df99322afb2e7474'},
 'bounds': {'min': [-0.20000000298023224, -0.1899999976158142, 0.0],
            'max': [0.20000000298023224, 0.1899999976158142, 0.3700000047683716]},
 'objects': [{'name': 'spun_task_shade',
              'vertices': 192,
              'materials': ['graphite-enamel'],
              'bounds': {'min': [-0.046153850853443146, -0.1899999976158142, 0.2891615033149719],
                         'max': [0.20000000298023224, -0.004508473444730043, 0.3700000047683716]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('round_fixture_construction.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
