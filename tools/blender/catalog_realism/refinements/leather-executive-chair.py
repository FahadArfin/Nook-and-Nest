"""Exact reviewed laundry construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'leather-executive-chair'
EVIDENCE = {'objects': [{'bounds': {'max': [0.3127233386039734, 0.31953519582748413, 0.5147988200187683],
                         'min': [-0.3127233386039734, -0.39500001072883606, 0.3950781524181366],
                         'size': [0.6254466772079468, 0.7145352065563202, 0.11972066760063171]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.29652372002601624, 0.30106523633003235, 0.5023279190063477],
                         'min': [-0.29652372002601624, -0.3765300214290619, 0.49733954668045044],
                         'size': [0.5930474400520325, 0.6775952577590942, 0.004988372325897217]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 148863,
                 'path': 'assets-source/blender/leather-executive-chair.blend',
                 'sha256': '5598d5ed2662ce481fc86dea28a95511fd6b7dcfce5b6c9c80940f711367f5de'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("laundry_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
