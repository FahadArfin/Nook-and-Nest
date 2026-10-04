"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'garage-air-hose-reel'
EVIDENCE = {'objects': [{'bounds': {'max': [0.15887904167175293, -0.07857363671064377, 0.31961789727211],
                         'min': [0.07866495102643967, -0.09273112565279007, 0.015167026780545712],
                         'size': [0.08021409064531326, 0.014157488942146301, 0.3044508704915643]},
              'materials': ['garage-blue-hose-polymer'],
              'name': 'Stowed reel lead',
              'vertices': 32},
             {'bounds': {'max': [0.08521212637424469, -0.0776861160993576, 0.03648484870791435],
                         'min': [0.03915151581168175, -0.09716297686100006, 0.007818181067705154],
                         'size': [0.04606061056256294, 0.019476860761642456, 0.028666667640209198]},
              'materials': ['garage-machined-brass'],
              'name': 'Brass pneumatic quick coupler',
              'vertices': 32}],
 'sourceBlend': {'bytes': 124767,
                 'path': 'assets-source/blender/garage-air-hose-reel.blend',
                 'sha256': 'fdae99a8c20f4cda5e5007ec2c16b6ae56ca00af67b7b4a2f179056635e61924'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
