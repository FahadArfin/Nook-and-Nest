"""Measured per-ID repair; no unrelated catalog changes."""
from pathlib import Path
import runpy

EVIDENCE = {'sourceBlend': {'bytes': 210717,
                 'path': 'assets-source/blender/wood-stove.blend',
                 'sha256': 'e982fd47456c95c82a054b86aea92e10d71561d53279e17d999ed519fa5db58a'},
 'objects': [{'name': 'charred_round_log',
              'vertices': 150,
              'materials': ['bark-umber'],
              'bounds': {'min': [-0.17422398924827576, -0.06934083253145218, 0.240653395652771],
                         'max': [0.16349516808986664, 0.08416691422462463, 0.29484647512435913],
                         'size': [0.3377191573381424, 0.1535077467560768, 0.054193079471588135]}},
             {'name': 'split_log_bark_ridge',
              'vertices': 160,
              'materials': ['cast-iron'],
              'bounds': {'min': [-0.16320058703422546, -0.06301893293857574, 0.2668299078941345],
                         'max': [0.1850913017988205, 0.0828976184129715, 0.3052266240119934],
                         'size': [0.34829188883304596, 0.14591655135154724, 0.03839671611785889]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'wood-stove':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_864.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
