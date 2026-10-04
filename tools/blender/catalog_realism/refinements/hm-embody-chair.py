"""Exact reviewed desk/appliance refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'hm-embody-chair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.30821919441223145, 0.2236027717590332, 0.5227766633033752],
                         'min': [-0.30821919441223145, -0.375, 0.4012007415294647],
                         'size': [0.6164383888244629, 0.5986027717590332, 0.12157592177391052]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.29228657484054565, 0.20826205611228943, 0.5101125240325928],
                         'min': [-0.29228657484054565, -0.35965925455093384, 0.5050469040870667],
                         'size': [0.5845731496810913, 0.5679213106632233, 0.005065619945526123]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 148545,
                 'path': 'assets-source/blender/hm-embody-chair.blend',
                 'sha256': '89cfcb59f8842a579ff4657a9da211379583d26843e4fde14c9b57f64cb18bed'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("desk_appliance_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
