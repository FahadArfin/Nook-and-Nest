"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'opal-wall-sconce'
EVIDENCE = {'objects': [{'bounds': {'max': [0.11500000208616257, 0.05964179337024689, 0.4000000059604645],
                         'min': [-0.11500000208616257, -0.13500000536441803, 0.15030695497989655],
                         'size': [0.23000000417232513, 0.19464179873466492, 0.24969305098056793]},
              'materials': ['opal-light-diffuser'],
              'name': 'opal_glass_globe',
              'vertices': 1200}],
 'sourceBlend': {'bytes': 133609,
                 'path': 'assets-source/blender/opal-wall-sconce.blend',
                 'sha256': '1e173b9507401ba5d4a981b7a37b60c641a956ed305ecd59d26b2b5b46254312'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
