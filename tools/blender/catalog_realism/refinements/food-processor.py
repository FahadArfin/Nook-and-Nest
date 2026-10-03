"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'food-processor'
EVIDENCE = {'objects': [{'bounds': {'max': [0.125, 0.027243847027420998, 0.33441880345344543],
                         'min': [0.07698068022727966, -0.006333330646157265, 0.1949852854013443],
                         'size': [0.04801931977272034, 0.03357717767357826, 0.13943351805210114]},
              'materials': ['graphite-enamel'],
              'name': 'loop_jug_handle',
              'vertices': 32}],
 'sourceBlend': {'bytes': 183757,
                 'path': 'assets-source/blender/food-processor.blend',
                 'sha256': 'f3f82eac5f357ebc1efa64a8b32340506744e05ef6dfead01a0b6a7a52edf405'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
