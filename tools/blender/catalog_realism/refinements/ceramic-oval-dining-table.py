"""Exact reviewed textile/turned construction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'ceramic-oval-dining-table'
SOURCE_COMPONENTS = [{'name': 'shaped_slab_top',
  'vertices': 192,
  'materials': ['variant-surface'],
  'bounds': {'min': [-1.100000023841858, -0.550000011920929, 0.7096355557441711],
             'max': [1.100000023841858, 0.550000011920929, 0.7599999904632568]},
  'kind': 'radial'},
 {'name': 'weighted_elliptic_foot',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.37400001287460327, -0.37400001287460327, 0.0],
             'max': [0.37400001287460327, 0.37400001287460327, 0.05540092661976814]},
  'kind': 'radial'},
 {'name': 'sculpted_center_pedestal',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.2913166880607605, -0.2913166880607605, 0.03273690864443779],
             'max': [0.2913166880607605, 0.2913166880607605, 0.699562668800354]},
  'kind': 'radial'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("textile_turning.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
