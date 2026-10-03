"""Exact reviewed laundry construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'linen-flush-light'
EVIDENCE = {'objects': [{'bounds': {'max': [0.2438826560974121, 0.24525552988052368, 0.17561028897762299],
                         'min': [-0.246554896235466, -0.2477063089609146, 0.006819808855652809],
                         'size': [0.4904375523328781, 0.4929618388414383, 0.16879048012197018]},
              'materials': ['upholstery-textured'],
              'name': 'lined_linen_lampshade',
              'vertices': 192},
             {'bounds': {'max': [0.25, 0.25, 0.18264450132846832],
                         'min': [-0.25, -0.25, 0.0],
                         'size': [0.5, 0.5, 0.18264450132846832]},
              'materials': ['ivory-detail'],
              'name': 'bound_shade_hem',
              'vertices': 784}],
 'sourceBlend': {'bytes': 136693,
                 'path': 'assets-source/blender/linen-flush-light.blend',
                 'sha256': '4cf487773785c466a41145090fee1ac78a1b098ba44be83bd91f57c08c49bec0'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("laundry_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
