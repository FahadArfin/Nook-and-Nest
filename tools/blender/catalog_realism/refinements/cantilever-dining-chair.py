"""Exact reviewed textile/turned construction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'cantilever-dining-chair'
SOURCE_COMPONENTS = [{'name': 'tailored_seat_cushion',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'bounds': {'min': [-0.25999999046325684, -0.2849999964237213, 0.3297322392463684],
             'max': [0.25999999046325684, 0.2205059975385666, 0.45185530185699463]},
  'kind': 'cover'},
 {'name': 'seat_double_welt',
  'vertices': 192,
  'materials': ['modern-tailored-welting'],
  'bounds': {'min': [-0.24699197709560394, -0.2722545266151428, 0.43447309732437134],
             'max': [0.24699197709560394, 0.2077604979276657, 0.4387066960334778]},
  'kind': 'welt'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("textile_turning.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
