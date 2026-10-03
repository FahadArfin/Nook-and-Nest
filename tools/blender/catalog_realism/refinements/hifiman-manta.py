"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'hifiman-manta'
EVIDENCE = {'objects': [{'bounds': {'max': [0.011268575675785542, 0.048718467354774475, 0.2784024477005005],
                         'min': [-0.011268575675785542, -0.011107083410024643, 0.010336974635720253],
                         'size': [0.022537151351571083, 0.05982555076479912, 0.26806547306478024]},
              'materials': ['satin-steel'],
              'name': 'Swept stand',
              'vertices': 48},
             {'bounds': {'max': [-0.05425306409597397, 0.04094512015581131, 0.2277020514011383],
                         'min': [-0.0767902210354805, -0.04094512015581131, 0.10497622191905975],
                         'size': [0.02253715693950653, 0.08189024031162262, 0.12272582948207855]},
              'materials': ['matte-rubber'],
              'name': 'Oval velour pad',
              'vertices': 128},
             {'bounds': {'max': [0.0767902210354805, 0.04094512015581131, 0.2277020514011383],
                         'min': [0.05425306409597397, -0.04094512015581131, 0.10497622191905975],
                         'size': [0.02253715693950653, 0.08189024031162262, 0.12272582948207855]},
              'materials': ['matte-rubber'],
              'name': 'Oval velour pad.001',
              'vertices': 128},
             {'bounds': {'max': [-0.07068470120429993, 0.04716463387012482, 0.2337876260280609],
                         'min': [-0.09731951355934143, -0.04716463387012482, 0.09889064729213715],
                         'size': [0.026634812355041504, 0.09432926774024963, 0.13489697873592377]},
              'materials': ['walnut'],
              'name': 'Oval wooden earcup',
              'vertices': 128},
             {'bounds': {'max': [0.09731951355934143, 0.04716463387012482, 0.2337876260280609],
                         'min': [0.07068470120429993, -0.04716463387012482, 0.09889064729213715],
                         'size': [0.026634812355041504, 0.09432926774024963, 0.13489697873592377]},
              'materials': ['walnut'],
              'name': 'Oval wooden earcup.001',
              'vertices': 128}],
 'sourceBlend': {'bytes': 145550,
                 'path': 'assets-source/blender/hifiman-manta.blend',
                 'sha256': 'bdad4c9196e97c94f5f8c0c99431c7ac6404fadb7125cedeab666f711ac6935f'}}


def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
