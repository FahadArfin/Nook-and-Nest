"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'floor-lamp'
EVIDENCE = {'objects': [{'bounds': {'max': [0.2093593031167984, 0.20689870417118073, 1.5499999523162842],
                         'min': [-0.1400691121816635, -0.2074299156665802, 1.184359073638916],
                         'size': [0.3494284152984619, 0.4143286198377609, 0.36564087867736816]},
              'materials': ['upholstery-textured'],
              'name': 'floor_lamp_bell_shade',
              'vertices': 96},
             {'bounds': {'max': [0.22417722642421722, 0.22446878254413605, 1.1971795558929443],
                         'min': [-0.15488703548908234, -0.22499999403953552, 1.1715384721755981],
                         'size': [0.37906426191329956, 0.44946877658367157, 0.02564108371734619]},
              'materials': ['linen-textured'],
              'name': 'floor_lamp_shade_rim',
              'vertices': 96}],
 'sourceBlend': {'bytes': 141519,
                 'path': 'assets-source/blender/floor-lamp.blend',
                 'sha256': '54c2fb5d3901589b5907bc5bc04081d09c1fcec7a6c30392641edbf2722d1a93'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
