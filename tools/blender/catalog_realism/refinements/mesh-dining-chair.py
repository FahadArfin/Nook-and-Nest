"""Exact five-view-reviewed component correction; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'mesh-dining-chair'
SOURCE_SHA256 = '837d4a527ee35cbd5ce105f3cf5258f24705c45fff61e00de9ac207200fdd193'
SOURCE_COMPONENTS = [{'name': 'aluminum_foot.001',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.24518835544586182, 0.23051400482654572, 0.0],
             'max': [-0.19606135785579681, 0.28152215480804443, 0.34013986587524414]},
  'kind': 'hard'},
 {'name': 'aluminum_foot.003',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.19606134295463562, 0.23051400482654572, 0.0],
             'max': [0.24518832564353943, 0.28152215480804443, 0.34013986587524414]},
  'kind': 'hard'},
 {'name': 'structural_seat_pan',
  'vertices': 96,
  'materials': ['modern-recess-charcoal'],
  'sourceMaterials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.22526957094669342, -0.26587191224098206, 0.31777530908584595],
             'max': [0.22526955604553223, 0.21623867750167847, 0.36250442266464233]},
  'kind': 'hard'},
 {'name': 'molded_mesh_back_frame',
  'vertices': 48,
  'materials': ['modern-recess-charcoal'],
  'sourceMaterials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.25999999046325684, 0.16811777651309967, 0.4503374993801117],
             'max': [0.25999999046325684, 0.2715219557285309, 0.8199999928474426]},
  'kind': 'hard'},
 {'name': 'molded_seat_side_rail',
  'vertices': 96,
  'materials': ['modern-recess-charcoal'],
  'sourceMaterials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.2408115714788437, -0.27591589093208313, 0.36250439286231995],
             'max': [-0.20508284866809845, 0.22628265619277954, 0.40723347663879395]},
  'kind': 'hard'},
 {'name': 'molded_seat_side_rail.001',
  'vertices': 96,
  'materials': ['modern-recess-charcoal'],
  'sourceMaterials': ['modern-recess-charcoal'],
  'bounds': {'min': [0.20508283376693726, -0.27591589093208313, 0.36250439286231995],
             'max': [0.2408115565776825, 0.22628265619277954, 0.40723347663879395]},
  'kind': 'hard'},
 {'name': 'molded_seat_cross_rail.001',
  'vertices': 96,
  'materials': ['modern-recess-charcoal'],
  'sourceMaterials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.23223668336868286, 0.1971106082201004, 0.36250439286231995],
             'max': [0.23223666846752167, 0.23536671698093414, 0.40723347663879395]},
  'kind': 'hard'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_504.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
