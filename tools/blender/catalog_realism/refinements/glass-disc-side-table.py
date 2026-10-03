"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'glass-disc-side-table'
EVIDENCE = {'objects': [{'bounds': {'max': [0.23999999463558197, 0.23999999463558197, 0.5199999809265137],
                         'min': [-0.23999999463558197, -0.23999999463558197, 0.4694654941558838],
                         'size': [0.47999998927116394, 0.47999998927116394, 0.05053448677062988]},
              'materials': ['modern-smoked-glass'],
              'name': 'shaped_slab_top',
              'vertices': 192},
             {'bounds': {'max': [0.1632000058889389, 0.1632000058889389, 0.05558794364333153],
                         'min': [-0.1632000058889389, -0.1632000058889389, 0.0],
                         'size': [0.3264000117778778, 0.3264000117778778, 0.05558794364333153]},
              'materials': ['wood-honey-textured'],
              'name': 'weighted_elliptic_foot',
              'vertices': 192},
             {'bounds': {'max': [0.12789089977741241, 0.12789089977741241, 0.4593586027622223],
                         'min': [-0.12789089977741241, -0.12789089977741241, 0.032847434282302856],
                         'size': [0.25578179955482483, 0.25578179955482483, 0.42651116847991943]},
              'materials': ['wood-honey-textured'],
              'name': 'sculpted_center_pedestal',
              'vertices': 192}],
 'sourceBlend': {'bytes': 108915,
                 'path': 'assets-source/blender/glass-disc-side-table.blend',
                 'sha256': '2e1ead26d27579f0380e529b98bdd28a97c160a70d03a7a0a5f82e2032c1bf3c'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
