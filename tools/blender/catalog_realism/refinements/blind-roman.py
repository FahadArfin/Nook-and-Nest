"""Inspected original construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'blind-roman'
EVIDENCE = {'sourceBlend': {'bytes': 103361,
                 'path': 'assets-source/blender/blind-roman.blend',
                 'sha256': '046a0e2657f4e3a34700700beab8cad5c30be9c6e14d1bbc12e5f6ee1d4871a9'},
 'objects': [{'name': 'roman_shade_soft_fold',
              'vertices': 182,
              'materials': ['upholstery-textured'],
              'bounds': {'min': [-0.5879999995231628, -0.05999999865889549, 0.0],
                         'max': [0.5879999995231628, 0.0022222211118787527, 1.25],
                         'size': [1.1759999990463257, 0.062222219770774245, 1.25]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong item for exact construction recipe')
    return runpy.run_path(str(Path(__file__).with_name('soft_construction.py')))['apply'](root,scene,item,material_keys,object_names,EVIDENCE)
