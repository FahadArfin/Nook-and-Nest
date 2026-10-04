"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'garage-circular-saw'
EVIDENCE = {'objects': [{'bounds': {'max': [0.10682660341262817, -0.021158229559659958, 0.21063168346881866],
                         'min': [-0.10682662576436996, -0.06553899496793747, 0.10925288498401642],
                         'size': [0.21365322917699814, 0.04438076540827751, 0.10137879848480225]},
              'materials': ['garage-ochre-tool-polymer'],
              'name': 'Upper blade guard',
              'vertices': 116},
             {'bounds': {'max': [0.09954147040843964, -0.038704100996255875, 0.15735170245170593],
                         'min': [-0.09912467747926712, -0.052121564745903015, 0.014924678951501846],
                         'size': [0.19866614788770676, 0.01341746374964714, 0.1424270235002041]},
              'materials': ['garage-satin-machined-steel'],
              'name': 'Retracted lower blade guard',
              'vertices': 116}],
 'sourceBlend': {'bytes': 137328,
                 'path': 'assets-source/blender/garage-circular-saw.blend',
                 'sha256': '4b1698e26d0d72b0b67222fcea82ea2095d98d2bb1e3f59cc12726e5253def92'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
