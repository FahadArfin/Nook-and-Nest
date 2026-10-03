"""Exact reviewed support/fit correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'counter-saddle-stool'
SOURCE_COMPONENTS = [{'name': 'aluminum_foot',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.2265465408563614, -0.2115764319896698, 0.0],
             'max': [-0.17589588463306427, -0.1613641083240509, 0.5510891079902649]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.001',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.2265465408563614, 0.1613641083240509, 0.0],
             'max': [-0.17589588463306427, 0.2115764319896698, 0.5510891079902649]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.002',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.17589588463306427, -0.2115764319896698, 0.0],
             'max': [0.2265465408563614, -0.1613641083240509, 0.5510891079902649]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.003',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.17589588463306427, 0.1613641083240509, 0.0],
             'max': [0.2265465408563614, 0.2115764319896698, 0.5510891079902649]},
  'kind': 'leg'},
 {'name': 'footrest',
  'vertices': 384,
  'materials': ['modern-brushed-aluminum'],
  'sourceMaterials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.1920120269060135, -0.17905254662036896, 0.2042296826839447],
             'max': [0.1920120269060135, 0.17905254662036896, 0.2586851119995117]},
  'kind': 'ring'},
 {'name': 'tailored_seat_cushion',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'sourceMaterials': ['upholstery-textured'],
  'bounds': {'min': [-0.21181181073188782, -0.2085522711277008, 0.44217821955680847],
             'max': [0.21181181073188782, 0.1643882691860199, 0.6600000262260437]},
  'kind': 'soft-contact'},
 {'name': 'seat_double_welt',
  'vertices': 192,
  'materials': ['modern-tailored-welting'],
  'sourceMaterials': ['modern-tailored-welting'],
  'bounds': {'min': [-0.20107696950435638, -0.19932085275650024, 0.6296501159667969],
             'max': [0.20107696950435638, 0.15515685081481934, 0.6358943581581116]},
  'kind': 'welt'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("support_fit.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
