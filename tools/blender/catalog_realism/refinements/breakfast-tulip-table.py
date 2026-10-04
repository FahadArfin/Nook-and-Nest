"""Inspected original construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'breakfast-tulip-table'
EVIDENCE = {'sourceBlend': {'bytes': 108813,
                 'path': 'assets-source/blender/breakfast-tulip-table.blend',
                 'sha256': '86c0ab3433ae4a8fd4c7c2737c63c3eeb0da9031df59ffa6c4f5e2a8d6d9b589'},
 'objects': [{'name': 'shaped_slab_top',
              'vertices': 192,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.42500001192092896, -0.42500001192092896, 0.6996306777000427],
                         'max': [0.42500001192092896, 0.42500001192092896, 0.75],
                         'size': [0.8500000238418579, 0.8500000238418579, 0.050369322299957275]}},
             {'name': 'weighted_elliptic_foot',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.289000004529953, -0.289000004529953, 0.0],
                         'max': [0.289000004529953, 0.289000004529953, 0.05540631338953972],
                         'size': [0.578000009059906, 0.578000009059906, 0.05540631338953972]}},
             {'name': 'sculpted_center_pedestal',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.13477791845798492, -0.13477791845798492, 0.032740090042352676],
                         'max': [0.13477791845798492, 0.13477791845798492, 0.6895567774772644],
                         'size': [0.26955583691596985, 0.26955583691596985, 0.6568166874349117]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong item for exact construction recipe')
    return runpy.run_path(str(Path(__file__).with_name('soft_construction.py')))['apply'](root,scene,item,material_keys,object_names,EVIDENCE)
