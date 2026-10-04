"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'gaming-chair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.2947129011154175, 0.29003190994262695, 0.5151690244674683],
                         'min': [-0.2947129011154175, -0.36000001430511475, 0.39536231756210327],
                         'size': [0.589425802230835, 0.6500319242477417, 0.11980670690536499]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.2795805037021637, 0.27349159121513367, 0.5026891827583313],
                         'min': [-0.2795805037021637, -0.3434596657752991, 0.49769723415374756],
                         'size': [0.5591610074043274, 0.6169512569904327, 0.00499194860458374]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 148357,
                 'path': 'assets-source/blender/gaming-chair.blend',
                 'sha256': 'ac057e520c7d4f5501115e8b05e85ebfc6a06e4ae4e744a65936a0e0365d6051'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
