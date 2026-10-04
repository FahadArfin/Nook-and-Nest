"""Exact reviewed utility refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'countertop-blender'
EVIDENCE = {'objects': [{'bounds': {'max': [0.10999999940395355, 0.02296137437224388, 0.35406622290611267],
                         'min': [0.06927766650915146, -0.006193918641656637, 0.20644086599349976],
                         'size': [0.040722332894802094, 0.02915529301390052, 0.14762535691261292]},
              'materials': ['graphite-enamel'],
              'name': 'loop_jug_handle',
              'vertices': 32}],
 'sourceBlend': {'bytes': 179863,
                 'path': 'assets-source/blender/countertop-blender.blend',
                 'sha256': 'a1fca2dd8781f579a499e6e2131ddb95ea1ee1cd7d18dcf38eef0ec2c2452fb6'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("utility_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
