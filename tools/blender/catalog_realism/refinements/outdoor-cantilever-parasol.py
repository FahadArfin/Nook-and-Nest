"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'outdoor-cantilever-parasol'
EVIDENCE = {'objects': [{'bounds': {'max': [1.6981689929962158, 1.6980905532836914, 2.5798940658569336],
                         'min': [-1.55856192111969, -1.6980905532836914, 2.188401937484741],
                         'size': [3.2567309141159058, 3.396181106567383, 0.3914921283721924]},
              'materials': ['outdoor-ivory-canvas'],
              'name': 'scalloped octagonal canopy',
              'vertices': 34}],
 'sourceBlend': {'bytes': 2791737,
                 'path': 'assets-source/blender/outdoor-cantilever-parasol.blend',
                 'sha256': 'cf9a82cc8478af3d762aecb10c023d5992b70befc926e268c1759f313152cf4d'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
