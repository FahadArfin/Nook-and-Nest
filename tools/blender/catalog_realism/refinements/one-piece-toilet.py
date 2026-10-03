"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'one-piece-toilet'
EVIDENCE = {'objects': [{'bounds': {'max': [0.12800000607967377, 0.22209356725215912, 0.3010776937007904],
                         'min': [-0.12800000607967377, -0.15647952258586884, 0.0],
                         'size': [0.25600001215934753, 0.37857308983802795, 0.3010776937007904]},
              'materials': ['warm-porcelain'],
              'name': 'Skirted pedestal',
              'vertices': 56},
             {'bounds': {'max': [0.12600000202655792, 0.3300584852695465, 0.4014369249343872],
                         'min': [-0.12600000202655792, 0.21871346235275269, 0.0],
                         'size': [0.25200000405311584, 0.11134502291679382, 0.4014369249343872]},
              'materials': ['warm-porcelain'],
              'name': 'Rear ceramic support',
              'vertices': 56},
             {'bounds': {'max': [0.17599999904632568, 0.33403509855270386, 0.43708038330078125],
                         'min': [-0.17599999904632568, 0.14116959273815155, 0.39526402950286865],
                         'size': [0.35199999809265137, 0.1928655058145523, 0.0418163537979126]},
              'materials': ['warm-porcelain'],
              'name': 'Cistern mounting bridge',
              'vertices': 56},
             {'bounds': {'max': [0.19282634556293488, 0.16933421790599823, 0.408352792263031],
                         'min': [-0.19282634556293488, -0.3423166275024414, 0.2515724301338196],
                         'size': [0.38565269112586975, 0.5116508454084396, 0.15678036212921143]},
              'materials': ['warm-porcelain'],
              'name': 'Rimless porcelain bowl',
              'pipelineStage': 'Measured editable control cage after frozen forms.py turned-ceramic-profile; '
                               'evaluated bounds retain source envelope',
              'sourceBounds': {'max': [0.19099999964237213, 0.16701754927635193, 0.4082071781158447],
                               'min': [-0.19099999964237213, -0.3400000035762787, 0.25189369916915894],
                               'size': [0.38199999928474426, 0.5070175528526306, 0.1563134789466858]},
              'vertices': 336},
             {'bounds': {'max': [0.1889999955892563, 0.33602339029312134, 0.7238210439682007],
                         'min': [-0.1889999955892563, 0.18292398750782013, 0.435089111328125],
                         'size': [0.3779999911785126, 0.1530994027853012, 0.2887319326400757]},
              'materials': ['warm-porcelain'],
              'name': 'Cistern',
              'vertices': 56}],
 'sourceBlend': {'bytes': 126900,
                 'path': 'assets-source/blender/one-piece-toilet.blend',
                 'sha256': '3c2199e896aa3739559c46801d3eb38905755a336d53c5bdad0e8d7987cd4bfb'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
