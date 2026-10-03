"""Inspected original construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'bunk-bed'
EVIDENCE = {'sourceBlend': {'bytes': 152448,
                 'path': 'assets-source/blender/bunk-bed.blend',
                 'sha256': 'ad17bcaa84710331366d10f31f329c54f26fbf4676cb88def3f78ddecc81ec45'},
 'objects': [{'name': 'bunk_post',
              'vertices': 96,
              'materials': ['wood-dark'],
              'bounds': {'min': [-0.5070000290870667, -0.9312286972999573, 0.0],
                         'max': [-0.41700002551078796, -0.8390784859657288, 1.75],
                         'size': [0.09000000357627869, 0.09215021133422852, 1.75]}},
             {'name': 'bunk_post.001',
              'vertices': 96,
              'materials': ['wood-dark'],
              'bounds': {'min': [-0.5070000290870667, 0.9179180860519409, 0.0],
                         'max': [-0.41700002551078796, 1.0100682973861694, 1.75],
                         'size': [0.09000000357627869, 0.09215021133422852, 1.75]}},
             {'name': 'bunk_post.002',
              'vertices': 96,
              'materials': ['wood-dark'],
              'bounds': {'min': [0.41700002551078796, -0.9312286972999573, 0.0],
                         'max': [0.5070000290870667, -0.8390784859657288, 1.75],
                         'size': [0.09000000357627869, 0.09215021133422852, 1.75]}},
             {'name': 'bunk_post.003',
              'vertices': 96,
              'materials': ['wood-dark'],
              'bounds': {'min': [0.41700002551078796, 0.9179180860519409, 0.0],
                         'max': [0.5070000290870667, 1.0100682973861694, 1.75],
                         'size': [0.09000000357627869, 0.09215021133422852, 1.75]}},
             {'name': 'bunk_guard_rail',
              'vertices': 96,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.4830000102519989, -0.9209897518157959, 1.540000081062317],
                         'max': [0.27300000190734863, -0.8493173718452454, 1.6200000047683716],
                         'size': [0.7560000121593475, 0.07167237997055054, 0.07999992370605469]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong item for exact construction recipe')
    return runpy.run_path(str(Path(__file__).with_name('soft_construction.py')))['apply'](root,scene,item,material_keys,object_names,EVIDENCE)
