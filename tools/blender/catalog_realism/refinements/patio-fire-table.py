"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'patio-fire-table'
SOURCE_SHA256 = 'ab9bb28783563edaa9b77dc08f81719301efc7208efce8f36571f450766ac0f1'
SOURCE_COMPONENTS = [{'name': 'fire_table_plinth',
  'vertices': 96,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.515999972820282, -0.335999995470047, 0.0],
             'max': [0.515999972820282, 0.335999995470047, 0.3976900577545166]}},
 {'name': 'stone_surround',
  'vertices': 96,
  'materials': ['terracotta'],
  'sourceMaterials': ['terracotta'],
  'bounds': {'min': [-0.6000000238418579, -0.4000000059604645, 0.49204936623573303],
             'max': [0.6000000238418579, 0.4000000059604645, 0.5518869757652283]}},
 {'name': 'double_walled_spun_bowl',
  'vertices': 288,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.25999999046325684, -0.25999999046325684, 0.45145183801651],
             'max': [0.25999999046325684, 0.25999999046325684, 0.5615531206130981]}},
 {'name': 'rolled_bowl_lip',
  'vertices': 294,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.2639337480068207, -0.26260560750961304, 0.555765688419342],
             'max': [0.2669849991798401, 0.26538965106010437, 0.5672399997711182]}},
 {'name': 'steel_fire_grate',
  'vertices': 112,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.22061729431152344, -0.14740000665187836, 0.5042385458946228],
             'max': [0.22061729431152344, 0.14696002006530762, 0.517814040184021]}},
 {'name': 'split_firewood',
  'vertices': 64,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured'],
  'bounds': {'min': [-0.1626659482717514, -0.11879999935626984, 0.507601261138916],
             'max': [0.15720903873443604, 0.11672578752040863, 0.6000000238418579]}}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    changes = []
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
