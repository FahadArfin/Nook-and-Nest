"""Exact inspected shell refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'desk-organizer'
EVIDENCE = {'objects': [{'bounds': {'max': [-0.04259999841451645, 0.04699999839067459, 0.1550692468881607],
                         'min': [-0.13660000264644623, -0.04699999839067459, 0.020443212240934372],
                         'size': [0.09400000423192978, 0.09399999678134918, 0.13462603464722633]},
              'materials': ['warm-porcelain'],
              'name': 'pen_cup',
              'vertices': 128},
             {'bounds': {'max': [-0.10265706479549408, 0.0029429353307932615, 0.18000000715255737],
                         'min': [-0.10854293406009674, -0.0029429353307932615, 0.025429368019104004],
                         'size': [0.005885869264602661, 0.005885870661586523, 0.15457063913345337]},
              'materials': ['terracotta'],
              'name': 'pencil',
              'vertices': 112},
             {'bounds': {'max': [-0.0946570634841919, 0.0029429353307932615, 0.18000000715255737],
                         'min': [-0.10054293274879456, -0.0029429353307932615, 0.025429368019104004],
                         'size': [0.005885869264602661, 0.005885870661586523, 0.15457063913345337]},
              'materials': ['terracotta'],
              'name': 'pencil.001',
              'vertices': 112},
             {'bounds': {'max': [-0.08665706217288971, 0.0029429353307932615, 0.18000000715255737],
                         'min': [-0.09254293143749237, -0.0029429353307932615, 0.025429368019104004],
                         'size': [0.005885869264602661, 0.005885870661586523, 0.15457063913345337]},
              'materials': ['terracotta'],
              'name': 'pencil.002',
              'vertices': 112},
             {'bounds': {'max': [-0.07865706831216812, 0.0029429353307932615, 0.18000000715255737],
                         'min': [-0.08454293757677078, -0.0029429353307932615, 0.025429368019104004],
                         'size': [0.005885869264602661, 0.005885870661586523, 0.15457063913345337]},
              'materials': ['terracotta'],
              'name': 'pencil.003',
              'vertices': 112},
             {'bounds': {'max': [-0.07065706700086594, 0.0029429353307932615, 0.18000000715255737],
                         'min': [-0.0765429362654686, -0.0029429353307932615, 0.025429368019104004],
                         'size': [0.005885869264602661, 0.005885870661586523, 0.15457063913345337]},
              'materials': ['terracotta'],
              'name': 'pencil.004',
              'vertices': 112}],
 'sourceBlend': {'bytes': 112693,
                 'path': 'assets-source/blender/desk-organizer.blend',
                 'sha256': 'b0a65ad4af92c74590ac5f9f7922b6103ce3a78341ae32bd89dbf11f77576158'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("small_turned_shells.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
