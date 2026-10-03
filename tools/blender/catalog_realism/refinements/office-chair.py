"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'office-chair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.24832142889499664, 0.2455766797065735, 0.5225242376327515],
                         'min': [-0.24992871284484863, -0.3100000023841858, 0.4010069668292999],
                         'size': [0.4982501417398453, 0.5555766820907593, 0.12151727080345154]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.23585748672485352, 0.23182445764541626, 0.5098459720611572],
                         'min': [-0.2374647855758667, -0.29624778032302856, 0.5048232078552246],
                         'size': [0.4733222723007202, 0.5280722379684448, 0.005022764205932617]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 143909,
                 'path': 'assets-source/blender/office-chair.blend',
                 'sha256': '3ded450381aa6230f625711b1d86e0cac7aad2a887a4d0b7a52804fa48728a57'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
