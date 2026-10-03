"""Exact inspected compact construction; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'compact-stroller'
EVIDENCE = {'objects': [{'bounds': {'max': [0.19119718670845032, 0.08394069224596024, 1.01883065700531],
                         'min': [-0.19119718670845032, -0.16375115513801575, 0.8118135929107666],
                         'size': [0.38239437341690063, 0.24769184738397598, 0.20701706409454346]},
              'materials': ['slate-blue-glaze'],
              'name': 'segmented fabric canopy',
              'vertices': 22},
             {'bounds': {'max': [-0.18753793835639954, 0.08483080565929413, 1.022757649421692],
                         'min': [-0.1948564499616623, -0.1682925820350647, 0.8114643096923828],
                         'size': [0.007318511605262756, 0.2531233876943588, 0.21129333972930908]},
              'materials': ['household-slate-fabric'],
              'name': 'canopy bound edge',
              'vertices': 66},
             {'bounds': {'max': [0.1948564499616623, 0.08483080565929413, 1.022757649421692],
                         'min': [0.18753793835639954, -0.1682925820350647, 0.8114643096923828],
                         'size': [0.007318511605262756, 0.2531233876943588, 0.21129333972930908]},
              'materials': ['household-slate-fabric'],
              'name': 'canopy bound edge.001',
              'vertices': 66}],
 'sourceBlend': {'bytes': 158227,
                 'path': 'assets-source/blender/compact-stroller.blend',
                 'sha256': 'e0e94c8ae89e672f1a46fa10bd46a889f0d71ffb38b7a9da1c9022a6829f6219'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("compact_construction.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
