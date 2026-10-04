"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'ottoman'
EVIDENCE = {'objects': [{'bounds': {'max': [0.31066176295280457, 0.19476743042469025, 0.41999998688697815],
                         'min': [-0.31066176295280457, -0.24709302186965942, 0.22094787657260895],
                         'size': [0.6213235259056091, 0.44186045229434967, 0.1990521103143692]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.29402321577072144, 0.1834590882062912, 0.3979052007198334],
                         'min': [-0.29402321577072144, -0.23578467965126038, 0.3923317492008209],
                         'size': [0.5880464315414429, 0.4192437678575516, 0.005573451519012451]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 125111,
                 'path': 'assets-source/blender/ottoman.blend',
                 'sha256': 'dbe6180420539ce19430a5c92d42e27e40c987bcb65693a9af01fc05980fd74c'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
