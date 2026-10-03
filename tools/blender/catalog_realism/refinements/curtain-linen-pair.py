"""Exact inspected compact construction; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'curtain-linen-pair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.892704427242279, 0.11500000208616257, 2.200000047683716],
                         'min': [-0.8942241668701172, 0.059357088059186935, 2.165173053741455],
                         'size': [1.7869285941123962, 0.05564291402697563, 0.03482699394226074]},
              'materials': ['brushed-nickel-hardware'],
              'name': 'curtain_rod',
              'vertices': 16},
             {'bounds': {'max': [0.8849124312400818, 0.07156486809253693, 2.0686604976654053],
                         'min': [-0.8788464069366455, -0.11011559516191483, 0.00011479992826934904],
                         'size': [1.7637588381767273, 0.18168046325445175, 2.068545697737136]},
              'materials': ['upholstery-textured'],
              'name': 'weighted_wave_fold_drapery',
              'vertices': 4030},
             {'bounds': {'max': [0.8999999761581421, 0.09368924796581268, 2.1622016429901123],
                         'min': [-0.8999999761581421, 0.08259297907352448, 2.112816095352173],
                         'size': [1.7999999523162842, 0.011096268892288208, 0.04938554763793945]},
              'materials': ['brushed-nickel-hardware'],
              'name': 'curtain_hanging_ring',
              'vertices': 7056},
             {'bounds': {'max': [0.8751012086868286, 0.07715024799108505, 0.006530095357447863],
                         'min': [-0.8765850067138672, -0.11500000208616257, 0.0],
                         'size': [1.7516862154006958, 0.19215025007724762, 0.006530095357447863]},
              'materials': ['ivory-detail'],
              'name': 'weighted_curtain_hem',
              'vertices': 1040}],
 'sourceBlend': {'bytes': 358351,
                 'path': 'assets-source/blender/curtain-linen-pair.blend',
                 'sha256': 'fee958499ccdd767a74aa9f42e4a3824795851340a88e74424d0c1157ba678bd'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("compact_construction.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
