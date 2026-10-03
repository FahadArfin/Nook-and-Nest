"""Exact reviewed source construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'kids-round-play-table'
EVIDENCE = {'sourceBlend': {'bytes': 108762,
                 'path': 'assets-source/blender/kids-round-play-table.blend',
                 'sha256': '4ee01f52b7589a2b791399fe7183b788391ec5733b54e644a689573d9515573b'},
 'bounds': {'min': [-0.375, -0.375, 0.0], 'max': [0.375, 0.375, 0.5]},
 'objects': [{'name': 'shaped_slab_top',
              'vertices': 192,
              'materials': ['variant-surface'],
              'bounds': {'min': [-0.375, -0.375, 0.44944387674331665], 'max': [0.375, 0.375, 0.5]}},
             {'name': 'weighted_elliptic_foot',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.2549999952316284, -0.2549999952316284, 0.0],
                         'max': [0.2549999952316284, 0.2549999952316284, 0.05561172589659691]}},
             {'name': 'sculpted_center_pedestal',
              'vertices': 192,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.19816341996192932, -0.19816341996192932, 0.03286147117614746],
                         'max': [0.19816341996192932, 0.19816341996192932, 0.43933266401290894]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('household_turning.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
