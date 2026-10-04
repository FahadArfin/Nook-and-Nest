from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.35707148909568787,
                                 0.05788138881325722,
                                 0.2734123766422272],
                         'min': [-0.3724237084388733,
                                 -0.13520188629627228,
                                 0.19250306487083435],
                         'size': [0.7294951975345612,
                                  0.1930832751095295,
                                  0.08090931177139282]},
              'materials': ['bark-umber'],
              'name': 'charred_round_log',
              'vertices': 150},
             {'bounds': {'max': [0.3760499358177185,
                                 0.05248427018523216,
                                 0.2795734703540802],
                         'min': [-0.3545007109642029,
                                 -0.106496162712574,
                                 0.2405407875776291],
                         'size': [0.7305506467819214,
                                  0.15898043289780617,
                                  0.03903268277645111]},
              'materials': ['cast-iron'],
              'name': 'split_log_bark_ridge',
              'vertices': 160}],
 'sourceBlend': {'bytes': 213106,
                 'path': 'assets-source/blender/stone-arch-fireplace.blend',
                 'sha256': 'ad9d3d6ae9812ea580d37307208d142f2ca83aae85fdbffd69a2a3921f0b1828'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'stone-arch-fireplace':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_756.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
