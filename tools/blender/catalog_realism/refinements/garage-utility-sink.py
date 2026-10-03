"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'garage-utility-sink'
EVIDENCE = {'objects': [{'bounds': {'max': [0.02500000037252903, 0.007186588831245899, 0.557637631893158],
                         'min': [-0.02500000037252903, -0.042376093566417694, 0.5525635480880737],
                         'size': [0.05000000074505806, 0.04956268239766359, 0.0050740838050842285]},
              'materials': ['garage-satin-machined-steel'],
              'name': 'Recessed bowl drain',
              'vertices': 48},
             {'bounds': {'max': [0.020000001415610313, 0.00223032059147954, 0.5474895238876343],
                         'min': [-0.020000001415610313, -0.03741982579231262, 0.37395715713500977],
                         'size': [0.04000000283122063, 0.03965014638379216, 0.1735323667526245]},
              'materials': ['garage-ivory-utility-polymer'],
              'name': 'Drain tailpiece',
              'vertices': 48},
             {'bounds': {'max': [0.02200000174343586, 0.20642857253551483, 0.3764941990375519],
                         'min': [-0.02200000174343586, -0.03940233215689659, 0.24878473579883575],
                         'size': [0.04400000348687172, 0.24583090469241142, 0.12770946323871613]},
              'materials': ['garage-ivory-utility-polymer'],
              'name': 'Exposed P-trap return',
              'vertices': 84}],
 'sourceBlend': {'bytes': 120783,
                 'path': 'assets-source/blender/garage-utility-sink.blend',
                 'sha256': 'e6cec799eeb43de5586ebb602e2afbdfeaf1a9d8ef589b13974491572c2672fc'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
