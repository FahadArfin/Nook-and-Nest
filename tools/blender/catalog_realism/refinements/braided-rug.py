"""Inspected original construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'braided-rug'
EVIDENCE = {'sourceBlend': {'bytes': 119281,
                 'path': 'assets-source/blender/braided-rug.blend',
                 'sha256': '40e20ac0c50edebc7ebfc945cab147ac0bdb7aca86eff318920799c46ea96510'},
 'objects': [{'name': 'braided_rug_connected_base',
              'vertices': 216,
              'materials': ['wood-dark'],
              'bounds': {'min': [-0.800000011920929, -0.5, 0.0005000000819563866],
                         'max': [0.800000011920929, 0.5, 0.025499999523162842],
                         'size': [1.600000023841858, 1.0, 0.024999999441206455]}},
             {'name': 'braided_rug_layer_0',
              'vertices': 192,
              'materials': ['upholstery-textured'],
              'bounds': {'min': [-0.671999990940094, -0.41999998688697815, 0.02449999935925007],
                         'max': [0.671999990940094, 0.41999998688697815, 0.035499997437000275],
                         'size': [1.343999981880188, 0.8399999737739563, 0.010999998077750206]}},
             {'name': 'braided_rug_layer_1',
              'vertices': 192,
              'materials': ['linen-textured'],
              'bounds': {'min': [-0.527999997138977, -0.32999998331069946, 0.03550000116229057],
                         'max': [0.527999997138977, 0.32999998331069946, 0.04650000110268593],
                         'size': [1.055999994277954, 0.6599999666213989, 0.010999999940395355]}},
             {'name': 'braided_rug_layer_2',
              'vertices': 192,
              'materials': ['terracotta'],
              'bounds': {'min': [-0.36800000071525574, -0.23000000417232513, 0.04650000110268593],
                         'max': [0.36800000071525574, 0.23000000417232513, 0.057500001043081284],
                         'size': [0.7360000014305115, 0.46000000834465027, 0.010999999940395355]}},
             {'name': 'braided_rug_layer_3',
              'vertices': 192,
              'materials': ['mustard-cloth'],
              'bounds': {'min': [-0.20000000298023224, -0.125, 0.057500001043081284],
                         'max': [0.20000000298023224, 0.125, 0.06849999725818634],
                         'size': [0.4000000059604645, 0.25, 0.010999996215105057]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong item for exact construction recipe')
    return runpy.run_path(str(Path(__file__).with_name('soft_construction.py')))['apply'](root,scene,item,material_keys,object_names,EVIDENCE)
