"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'glass-air-fryer'
EVIDENCE = {'objects': [{'bounds': {'max': [0.14402945339679718, 0.16396057605743408, 0.046015042811632156],
                         'min': [-0.14402945339679718, -0.1274213194847107, 0.0],
                         'size': [0.28805890679359436, 0.2913818955421448, 0.046015042811632156]},
              'materials': ['variant-surface.001'],
              'name': 'airfryer_base',
              'vertices': 192},
             {'bounds': {'max': [0.15000000596046448, 0.17000000178813934, 0.3400000035762787],
                         'min': [-0.15000000596046448, -0.13346074521541595, 0.2530827224254608],
                         'size': [0.30000001192092896, 0.3034607470035553, 0.08691728115081787]},
              'materials': ['variant-surface.001'],
              'name': 'heater_lid',
              'vertices': 192}],
 'sourceBlend': {'bytes': 145311,
                 'path': 'assets-source/blender/glass-air-fryer.blend',
                 'sha256': 'a022e9d839b450bebe32a6f779a9e30473e088c47cfb014521e139e9d62a5e0e'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
