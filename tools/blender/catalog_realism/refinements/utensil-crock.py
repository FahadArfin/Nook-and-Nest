"""Measured original utensil-crock construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'utensil-crock'
SOURCE_COMPONENTS = [{'name': 'open_vessel',
  'vertices': 128,
  'materials': ['warm-porcelain'],
  'bounds': {'min': [-0.09000000357627869, -0.09000000357627869, 0.0],
             'max': [0.09000000357627869, 0.09000000357627869, 0.16994382441043854]},
  'kind': 'vessel'},
 {'name': 'spatula_head',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.07565788924694061, -0.009868420660495758, 0.2682022452354431],
             'max': [-0.03881578519940376, 0.009868420660495758, 0.33000001311302185]},
  'kind': 'turner'},
 {'name': 'spatula_head.001',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.03749999776482582, -0.009868420660495758, 0.2682022452354431],
             'max': [-0.0006578936008736491, 0.009868420660495758, 0.33000001311302185]},
  'kind': 'slotted-turner'},
 {'name': 'spatula_head.002',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [0.0006578936008736491, -0.009868420660495758, 0.2682022452354431],
             'max': [0.03749999776482582, 0.009868420660495758, 0.33000001311302185]},
  'kind': 'spoon'},
 {'name': 'spatula_head.003',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [0.03881578519940376, -0.009868420660495758, 0.2682022452354431],
             'max': [0.07565788924694061, 0.009868420660495758, 0.33000001311302185]},
  'kind': 'fork'}]


def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID:
        raise ValueError("Refinement targets a different catalog ID")
    helper = runpy.run_path(str(Path(__file__).with_name("vessel_geometry.py")))
    return helper["apply_refinement"](scene, item, material_keys, object_names, SOURCE_COMPONENTS)
