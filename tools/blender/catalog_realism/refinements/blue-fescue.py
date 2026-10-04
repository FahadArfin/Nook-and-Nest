"""Inspected original construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'blue-fescue'
EVIDENCE = {'sourceBlend': {'bytes': 104513,
                 'path': 'assets-source/blender/blue-fescue.blend',
                 'sha256': 'e51e537d30acdb0bcc12b4d5e6900bffc0c0adb2e97469347b5304a7802b728a'},
 'objects': [{'name': 'arching_strap_blade',
              'vertices': 210,
              'materials': ['fresh-leaf-tips'],
              'bounds': {'min': [-0.25, -0.24066013097763062, 0.0],
                         'max': [0.25, 0.23347850143909454, 0.39513272047042847],
                         'size': [0.5, 0.47413863241672516, 0.39513272047042847]}},
             {'name': 'arching_strap_blade.001',
              'vertices': 415,
              'materials': ['blue_fescue_glaucous_leaf'],
              'bounds': {'min': [-0.24991071224212646, -0.25, 0.0],
                         'max': [0.24152973294258118, 0.25, 0.4000000059604645],
                         'size': [0.49144044518470764, 0.5, 0.4000000059604645]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong item for exact construction recipe')
    return runpy.run_path(str(Path(__file__).with_name('soft_construction.py')))['apply'](root,scene,item,material_keys,object_names,EVIDENCE)
