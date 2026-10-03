"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'modern-cat-condo'
EVIDENCE = {'objects': [{'bounds': {'max': [0.14150942862033844, 0.1237499937415123, 0.7665298581123352],
                         'min': [-0.14150942862033844, -0.23374998569488525, 0.31719449162483215],
                         'size': [0.2830188572406769, 0.35749997943639755, 0.44933536648750305]},
              'materials': ['wood-honey-textured'],
              'name': 'enclosed_cat_cubby',
              'vertices': 96},
             {'bounds': {'max': [0.09622640907764435, -0.21849998831748962, 0.745560884475708],
                         'min': [-0.09622640907764435, -0.25450000166893005, 0.33816346526145935],
                         'size': [0.1924528181552887, 0.03600001335144043, 0.40739741921424866]},
              'materials': ['modern-recess-charcoal'],
              'name': 'cubby_entry',
              'vertices': 384}],
 'sourceBlend': {'bytes': 312507,
                 'path': 'assets-source/blender/modern-cat-condo.blend',
                 'sha256': '2425c08abf86e37d7535555054404dc0a371c3d2fd9e7d01677cb6f17521b7c7'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
