"""Exact four-model review follow-up; isolated candidate recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'vessel-sink'
SOURCE_SHA256 = '45af35c15dda0a1fc6b8bbbc9c4e28a9a2302d5d147f8bb04746faea9c76a13f'
SOURCE_COMPONENTS = [{'name': 'Fine rim vessel',
  'vertices': 336,
  'materials': ['variant-surface'],
  'bounds': {'min': [-0.23000000417232513, -0.23000000417232513, 0.0],
             'max': [0.23000000417232513, 0.23000000417232513, 0.1599999964237213]}},
 {'name': 'Retained finish fixing warm-porcelain',
  'vertices': 16,
  'materials': ['warm-porcelain'],
  'bounds': {'min': [-0.094200000166893, 0.13500000536441803, 0.010499999858438969],
             'max': [-0.08819999545812607, 0.14100000262260437, 0.013500000350177288]}},
 {'name': 'Retained finish fixing brushed-steel',
  'vertices': 16,
  'materials': ['brushed-steel'],
  'bounds': {'min': [-0.08419999480247498, 0.13500000536441803, 0.010499999858438969],
             'max': [-0.07819999754428864, 0.14100000262260437, 0.013500000350177288]}},
 {'name': 'Retained finish fixing recess-shadow-detail',
  'vertices': 16,
  'materials': ['recess-shadow-detail'],
  'bounds': {'min': [-0.07419999688863754, 0.13500000536441803, 0.010499999858438969],
             'max': [-0.0681999996304512, 0.14100000262260437, 0.013500000350177288]}}]

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong exact828 recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("reviewed_828.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS,SOURCE_SHA256)
