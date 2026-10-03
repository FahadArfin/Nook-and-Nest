"""Exact inspected shell refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'dish-rack'
EVIDENCE = {'objects': [{'bounds': {'max': [-0.1314999908208847, 0.11179999262094498, 0.25999999046325684],
                         'min': [-0.1445000022649765, -0.11179999262094498, 0.01907169073820114],
                         'size': [0.013000011444091797, 0.22359998524188995, 0.2409282997250557]},
              'materials': ['warm-porcelain'],
              'name': 'stacked_plate',
              'vertices': 144},
             {'bounds': {'max': [-0.0624999925494194, 0.11179999262094498, 0.25999999046325684],
                         'min': [-0.0755000039935112, -0.11179999262094498, 0.01907169073820114],
                         'size': [0.013000011444091797, 0.22359998524188995, 0.2409282997250557]},
              'materials': ['warm-porcelain'],
              'name': 'stacked_plate.001',
              'vertices': 144},
             {'bounds': {'max': [0.006500004790723324, 0.11179999262094498, 0.25999999046325684],
                         'min': [-0.006500004790723324, -0.11179999262094498, 0.01907169073820114],
                         'size': [0.013000009581446648, 0.22359998524188995, 0.2409282997250557]},
              'materials': ['warm-porcelain'],
              'name': 'stacked_plate.002',
              'vertices': 144},
             {'bounds': {'max': [0.0755000039935112, 0.11179999262094498, 0.25999999046325684],
                         'min': [0.0624999925494194, -0.11179999262094498, 0.01907169073820114],
                         'size': [0.013000011444091797, 0.22359998524188995, 0.2409282997250557]},
              'materials': ['warm-porcelain'],
              'name': 'stacked_plate.003',
              'vertices': 144}],
 'sourceBlend': {'bytes': 117189,
                 'path': 'assets-source/blender/dish-rack.blend',
                 'sha256': 'fce5b15f23dec3a4b9a3c90b9d66a2f565431ce6bd905b1f7864b7c94e673386'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("small_turned_shells.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
