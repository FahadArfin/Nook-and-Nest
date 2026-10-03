"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'pizza-oven-cart'
SOURCE_SHA256 = '558227a6e36457b42562d73a5dbaa2296f904fb158f3a19a688e793a4e32745f'
SOURCE_COMPONENTS = [{'name': 'pizza_baking_stone',
  'vertices': 96,
  'materials': ['refractory_baking_stone'],
  'sourceMaterials': ['refractory_baking_stone'],
  'bounds': {'min': [-0.26840001344680786, -0.2840000092983246, 0.8499999642372131],
             'max': [0.26840001344680786, 0.2840000092983246, 0.9099999070167542]}},
 {'name': 'oven_dark_back',
  'vertices': 96,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.24400000274181366, 0.2304999977350235, 0.8458559513092041],
             'max': [0.24400000274181366, 0.265500009059906, 1.068384051322937]}},
 {'name': 'refractory_barrel_vault',
  'vertices': 100,
  'materials': ['terracotta'],
  'sourceMaterials': ['terracotta'],
  'bounds': {'min': [-0.29280000925064087, -0.24799999594688416, 0.9199999570846558],
             'max': [0.29280000925064087, 0.2720000147819519, 1.2128000259399414]}}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    changes = []
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
