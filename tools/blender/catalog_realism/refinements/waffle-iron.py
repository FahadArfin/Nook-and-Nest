"""Exact four-model review follow-up; isolated candidate recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'waffle-iron'
SOURCE_SHA256 = 'fb13af4f20ecbce3f70410f9b8a9511f674d08a39ea0e38a545dbc91c2cf4ad1'
SOURCE_COMPONENTS = [{'name': 'rounded_waffle_base',
  'vertices': 240,
  'materials': ['graphite-enamel'],
  'bounds': {'min': [-0.14000000059604645, -0.16551116108894348, 0.0],
             'max': [0.14000000059604645, 0.13016323745250702, 0.06324797123670578]}},
 {'name': 'cool_touch_handle',
  'vertices': 32,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.08874999731779099, -0.17499999701976776, 0.09869398921728134],
             'max': [0.07378704845905304, -0.1216219887137413, 0.13375787436962128]}}]

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong exact828 recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("reviewed_828.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS,SOURCE_SHA256)
