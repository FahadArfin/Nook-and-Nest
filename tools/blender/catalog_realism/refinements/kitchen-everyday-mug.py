"""Exact reviewed source construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'kitchen-everyday-mug'
EVIDENCE = {'sourceBlend': {'bytes': 102944,
                 'path': 'assets-source/blender/kitchen-everyday-mug.blend',
                 'sha256': '2b746eb76f3896d0cba6afa1a64c3ea35eea16b49c7ad851baabe3b79b321a61'},
 'bounds': {'min': [-0.0625, -0.04750000312924385, 0.0],
            'max': [0.0625, 0.04750000312924385, 0.10500000417232513]},
 'objects': [{'name': 'rounded D handle',
              'vertices': 96,
              'materials': ['terracotta-glaze'],
              'bounds': {'min': [0.024121684953570366, -0.006000000052154064, 0.01708872988820076],
                         'max': [0.0625, 0.006000000052154064, 0.0898996964097023]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('household_turning.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
