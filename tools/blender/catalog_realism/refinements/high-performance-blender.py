"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'high-performance-blender'
EVIDENCE = {'objects': [{'bounds': {'max': [0.11500000208616257, 0.031368061900138855, 0.37397366762161255],
                         'min': [0.04626946523785591, 0.010021171532571316, 0.2069791555404663],
                         'size': [0.06873053684830666, 0.02134689036756754, 0.16699451208114624]},
              'materials': ['black-enamel'],
              'name': 'Generous vessel handle',
              'vertices': 40}],
 'sourceBlend': {'bytes': 160091,
                 'path': 'assets-source/blender/high-performance-blender.blend',
                 'sha256': '1aab2bc36bff888fba19dc01b43db1221dbd7df3edc841af902bb3fe4ee7a032'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
