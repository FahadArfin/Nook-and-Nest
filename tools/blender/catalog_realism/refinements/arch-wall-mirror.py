"""Inspected source silhouette refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'arch-wall-mirror'
EVIDENCE = {'sourceBlend': {'bytes': 109972,
                 'path': 'assets-source/blender/arch-wall-mirror.blend',
                 'sha256': '14de65f175b02634f6f5521db1c342fe7666aa03bc2c89d266fb5d52297c042b'},
 'objects': [{'name': 'arch_mirror_frame',
              'vertices': 96,
              'faces': 98,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.3100000023841858, -0.027499999850988388, 0.0],
                         'max': [0.3100000023841858, 0.027499999850988388, 0.7644000053405762],
                         'size': [0.6200000047683716, 0.054999999701976776, 0.7644000053405762]},
              'matrix': [[1.0, 0.0, 0.0, 0.0],
                         [0.0, 1.0, 0.0, 0.0],
                         [0.0, 0.0, 1.0, 0.3822000026702881],
                         [0.0, 0.0, 0.0, 1.0]],
              'modifiers': []},
             {'name': 'arch_mirror_crown',
              'vertices': 168,
              'faces': 142,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.3100000023841858, -0.027500012889504433, 0.4544000029563904],
                         'max': [0.3100000023841858, 0.027500012889504433, 1.0744000673294067],
                         'size': [0.6200000047683716, 0.055000025779008865, 0.6200000643730164]},
              'matrix': [[1.0, 0.0, 0.0, 0.0],
                         [0.0, -4.371138828673793e-08, -1.0, 0.0],
                         [0.0, 1.0, -4.371138828673793e-08, 0.7644000053405762],
                         [0.0, 0.0, 0.0, 1.0]],
              'modifiers': []},
             {'name': 'arch_mirror_glass',
              'vertices': 96,
              'faces': 98,
              'materials': ['smoky-mirror'],
              'bounds': {'min': [-0.2542000114917755, -0.03959999978542328, 0.05879998207092285],
                         'max': [0.2542000114917755, -0.020899999886751175, 0.7251999974250793],
                         'size': [0.508400022983551, 0.018699999898672104, 0.6664000153541565]},
              'matrix': [[1.0, 0.0, 0.0, 0.0],
                         [0.0, 1.0, 0.0, -0.030249999836087227],
                         [0.0, 0.0, 1.0, 0.3919999897480011],
                         [0.0, 0.0, 0.0, 1.0]],
              'modifiers': []},
             {'name': 'arch_mirror_glass_crown',
              'vertices': 168,
              'faces': 142,
              'materials': ['smoky-mirror'],
              'bounds': {'min': [-0.2542000114917755, -0.039600010961294174, 0.49059996008872986],
                         'max': [0.2542000114917755, -0.02089998871088028, 0.9990000128746033],
                         'size': [0.508400022983551, 0.018700022250413895, 0.5084000527858734]},
              'matrix': [[1.0, 0.0, 0.0, 0.0],
                         [0.0, -4.371138828673793e-08, -1.0, -0.030249999836087227],
                         [0.0, 1.0, -4.371138828673793e-08, 0.7447999715805054],
                         [0.0, 0.0, 0.0, 1.0]],
              'modifiers': []}]}

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID:
        raise ValueError('Wrong catalog item for exact silhouette recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('silhouette_geometry.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, EVIDENCE)
