"""Exact reviewed source refinement; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'ring-chandelier'
EVIDENCE = {'sourceBlend': {'bytes': 282291,
                 'path': 'assets-source/blender/ring-chandelier.blend',
                 'sha256': '3d9c7f4175527492d717e37413352ca4c26236b5d67f5caef89efcbb2649cedd'},
 'bounds': {'min': [-0.4000000059604645, -0.4000000059604645, 0.0],
            'max': [0.4000000059604645, 0.4000000059604645, 0.6499999761581421]},
 'objects': [{'name': 'chandelier_circular_frame',
              'vertices': 392,
              'materials': ['aged-brass-fitting'],
              'bounds': {'min': [-0.36206722259521484, -0.4000000059604645, 0.0],
                         'max': [0.3694552481174469, 0.4000000059604645, 0.040871236473321915]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('round_fixture_construction.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
