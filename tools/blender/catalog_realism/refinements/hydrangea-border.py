"""Exact reviewed source construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'hydrangea-border'
EVIDENCE = {'sourceBlend': {'bytes': 1048786,
                 'path': 'assets-source/blender/hydrangea-border.blend',
                 'sha256': '1e90571adba54d4d8f5b97e0a1a2ed9162b6d73e8c2de2eed0e1e3c7f12422cc'},
 'bounds': {'min': [-0.5, -0.3499999940395355, 0.0], 'max': [0.5, 0.3499999940395355, 0.800000011920929]},
 'objects': [{'name': 'veined_stem_leaves',
              'vertices': 364,
              'materials': ['foliage-shadow'],
              'bounds': {'min': [-0.4880800247192383, -0.3213837742805481, 0.0548122376203537],
                         'max': [0.5, 0.33476126194000244, 0.3978712558746338]}},
             {'name': 'veined_stem_leaves.001',
              'vertices': 364,
              'materials': ['foliage-main'],
              'bounds': {'min': [-0.5, -0.34202101826667786, 0.09459371864795685],
                         'max': [0.3713480532169342, 0.3499999940395355, 0.4729784429073334]}},
             {'name': 'veined_stem_leaves.002',
              'vertices': 364,
              'materials': ['foliage-new-growth'],
              'bounds': {'min': [-0.31637540459632874, -0.3499999940395355, 0.13437519967556],
                         'max': [0.33889418840408325, 0.3348645269870758, 0.5480855703353882]}},
             {'name': 'cupped_flower_petals',
              'vertices': 27720,
              'materials': ['petal-blush'],
              'bounds': {'min': [-0.4375438690185547, -0.30712881684303284, 0.37552475929260254],
                         'max': [0.4262089431285858, 0.30477845668792725, 0.800000011920929]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('botanical_weave.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
