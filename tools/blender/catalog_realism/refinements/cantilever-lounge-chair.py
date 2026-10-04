"""Exact reviewed textile/turned construction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'cantilever-lounge-chair'
SOURCE_COMPONENTS = [{'name': 'tailored_seat_cushion',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'bounds': {'min': [-0.2992139160633087, -0.42500001192092896, 0.3066354990005493],
             'max': [0.2992139160633087, 0.3739723265171051, 0.4288822114467621]},
  'kind': 'cover'},
 {'name': 'seat_double_welt',
  'vertices': 192,
  'materials': ['modern-tailored-welting'],
  'bounds': {'min': [-0.2838149070739746, -0.4041133224964142, 0.4110545516014099],
             'max': [0.2838149070739746, 0.35308563709259033, 0.41614818572998047]},
  'kind': 'welt'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("textile_turning.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS)
