"""Exact reviewed laundry construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'laundry-steam-iron'
EVIDENCE = {'objects': [{'bounds': {'max': [0.07000000029802322, 0.13028886914253235, 0.011508585885167122],
                         'min': [-0.07000000029802322, -0.15000000596046448, 0.0006885479670017958],
                         'size': [0.14000000059604645, 0.2802888751029968, 0.010820037918165326]},
              'materials': ['brushed-steel'],
              'name': 'pointed metal soleplate',
              'vertices': 33},
             {'bounds': {'max': [0.06650000065565109, 0.12367642670869827, 0.06954333186149597],
                         'min': [-0.06650000065565109, -0.1425980031490326, 0.012492225505411625],
                         'size': [0.13300000131130219, 0.26627442985773087, 0.05705110635608435]},
              'materials': ['slate-blue-glaze'],
              'name': 'blue translucent tank',
              'vertices': 33},
             {'bounds': {'max': [0.04829999804496765, 0.08929169178009033, 0.08528157323598862],
                         'min': [-0.04829999804496765, -0.10410763323307037, 0.0685596913099289],
                         'size': [0.0965999960899353, 0.1933993250131607, 0.016721881926059723]},
              'materials': ['warm-ceramic'],
              'name': 'upper tank shoulder',
              'vertices': 22},
             {'bounds': {'max': [0.010294117964804173, 0.12399513274431229, 0.1599999964237213],
                         'min': [-0.014411765150725842, -0.08619226515293121, 0.07045117020606995],
                         'size': [0.024705883115530014, 0.2101873978972435, 0.08954882621765137]},
              'materials': ['charcoal-details'],
              'name': 'open raised handle',
              'vertices': 80},
             {'bounds': {'max': [0.005874173250049353, 0.15000000596046448, 0.09511325508356094],
                         'min': [-0.005874173250049353, 0.1162351444363594, 0.059138450771570206],
                         'size': [0.011748346500098705, 0.03376486152410507, 0.03597480431199074]},
              'materials': ['rubber-gaskets'],
              'name': 'heel cord swivel',
              'vertices': 30}],
 'sourceBlend': {'bytes': 109571,
                 'path': 'assets-source/blender/laundry-steam-iron.blend',
                 'sha256': '7bfeb7079607b9a28dc8406f2324e2928a39abfcec8e94457d2cc4f855839aaa'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("laundry_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
