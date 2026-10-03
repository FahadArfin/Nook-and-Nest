"""Exact inspected compact construction; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'curtain-blackout-pair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.9947158694267273, 0.10999999940395355, 2.200000047683716],
                         'min': [-0.9962397813796997, 0.05470462888479233, 2.165173053741455],
                         'size': [1.990955650806427, 0.055295370519161224, 0.03482699394226074]},
              'materials': ['brushed-nickel-hardware'],
              'name': 'curtain_rod',
              'vertices': 16},
             {'bounds': {'max': [0.9848707914352417, 0.06754978001117706, 2.0686604976654053],
                         'min': [-0.9787879586219788, -0.10514610260725021, 0.00011479992826934904],
                         'size': [1.9636587500572205, 0.17269588261842728, 2.068545697737136]},
              'materials': ['upholstery-textured'],
              'name': 'weighted_wave_fold_drapery',
              'vertices': 4030},
             {'bounds': {'max': [0.9848707914352417, 0.08182216435670853, 2.0686604976654053],
                         'min': [-0.9787879586219788, -0.09087371081113815, 0.00011479992826934904],
                         'size': [1.9636587500572205, 0.17269587516784668, 2.068545697737136]},
              'materials': ['ivory-detail'],
              'name': 'separate_blackout_lining',
              'vertices': 4030},
             {'bounds': {'max': [1.0, 0.08882234990596771, 2.1622016429901123],
                         'min': [-1.0, 0.07779539376497269, 2.112816095352173],
                         'size': [2.0, 0.011026956140995026, 0.04938554763793945]},
              'materials': ['brushed-nickel-hardware'],
              'name': 'curtain_hanging_ring',
              'vertices': 7056},
             {'bounds': {'max': [0.9750270843505859, 0.07310027629137039, 0.006530095357447863],
                         'min': [-0.9765152335166931, -0.10999999940395355, 0.0],
                         'size': [1.951542317867279, 0.18310027569532394, 0.006530095357447863]},
              'materials': ['ivory-detail'],
              'name': 'weighted_curtain_hem',
              'vertices': 1040}],
 'sourceBlend': {'bytes': 362094,
                 'path': 'assets-source/blender/curtain-blackout-pair.blend',
                 'sha256': '16ba8f76718fd2949e35fed8f58cf19e0c7eb762c1c4fd97c7e9f65fd04c036e'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("compact_construction.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
