"""Exact reviewed source refinement; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'rolex-desk-clock'
EVIDENCE = {'sourceBlend': {'bytes': 227353,
                 'path': 'assets-source/blender/rolex-desk-clock.blend',
                 'sha256': '3ea60994085269c2f8bca93054b7c592d495e39257116ec1b3e14ddbd44ca6b8'},
 'bounds': {'min': [-0.03999999910593033, -0.03999999538064003, 0.0],
            'max': [0.03999999910593033, 0.03999999538064003, 0.07999999821186066]},
 'objects': [{'name': 'Steel hemispherical case',
              'vertices': 1088,
              'materials': ['satin-steel'],
              'bounds': {'min': [-0.0398009791970253, -0.02162310667335987, 0.00019900515326298773],
                         'max': [0.03980736806988716, 0.03999999538064003, 0.07980100065469742]}},
             {'name': 'Dial case',
              'vertices': 128,
              'materials': ['satin-steel'],
              'bounds': {'min': [-0.0398009791970253, -0.03042641095817089, 0.00019900168990716338],
                         'max': [0.03980736806988716, -0.02162310481071472, 0.07980100065469742]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('clock_surface_restore.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
