"""Exact reviewed laundry construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'laundry-carry-basket'
EVIDENCE = {'objects': [{'bounds': {'max': [0.30553877353668213, 0.20000000298023224, 0.24835960566997528],
                         'min': [-0.30553877353668213, -0.20000000298023224, 0.0],
                         'size': [0.6110775470733643, 0.4000000059604645, 0.24835960566997528]},
              'materials': ['sage-enamel'],
              'name': 'hollow flexible carry tub',
              'vertices': 170}],
 'sourceBlend': {'bytes': 92017,
                 'path': 'assets-source/blender/laundry-carry-basket.blend',
                 'sha256': '14e64659f19726d30296f74f758b5b62f6c050ebf33a3d0d7f9fe46b868bda25'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("laundry_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
