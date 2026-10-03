"""Exact five-view-reviewed component correction; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'mantel-clock'
SOURCE_SHA256 = '5b454d8b26a969b139ea7b0cd82a4c6404220af78f25fff08fca9d98388db26b'
SOURCE_COMPONENTS = [{'name': 'mantel_plinth',
  'vertices': 96,
  'materials': ['walnut-case'],
  'sourceMaterials': ['walnut-case'],
  'bounds': {'min': [-0.11999999731779099, -0.007471263408660889, 0.0],
             'max': [0.11999999731779099, 0.05000000074505806, 0.024152321740984917]},
  'kind': 'hard'},
 {'name': 'arched_case_lower',
  'vertices': 96,
  'materials': ['walnut-case'],
  'sourceMaterials': ['walnut-case'],
  'bounds': {'min': [-0.09600000083446503, -0.002298849867656827, 0.0433131642639637],
             'max': [0.09600000083446503, 0.04482758790254593, 0.188227117061615]},
  'kind': 'hard'},
 {'name': 'arched_upper_case',
  'vertices': 384,
  'materials': ['walnut-case'],
  'sourceMaterials': ['walnut-case'],
  'bounds': {'min': [-0.09600000083446503, -0.00229885196313262, 0.07679328322410583],
             'max': [0.09600000083446503, 0.04482758790254593, 0.28999999165534973]},
  'kind': 'hard'},
 {'name': 'ivory_porcelain_dial',
  'vertices': 384,
  'materials': ['warm-porcelain'],
  'sourceMaterials': ['warm-porcelain'],
  'bounds': {'min': [-0.07440000027418137, -0.024712644517421722, 0.10077903419733047],
             'max': [0.07440000027418137, -0.01781608723104, 0.2660142481327057]},
  'kind': 'hard'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_504.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
