"""Measured per-ID repair; no unrelated catalog changes."""
from pathlib import Path
import runpy

EVIDENCE = {'sourceBlend': {'bytes': 92092,
                 'path': 'assets-source/blender/wall-hose-reel.blend',
                 'sha256': 'a32768899ca103fa8d801edbd19aec2c6038c8b82d733d15fc1865c8c7f1fde7'},
 'objects': [{'name': 'short stowed hose',
              'vertices': 32,
              'materials': ['rubber-gaskets'],
              'bounds': {'min': [-0.010404843837022781, -0.23499999940395355, 0.0007734722457826138],
                         'max': [0.09552466869354248, -0.1513972133398056, 0.13401037454605103],
                         'size': [0.10592951253056526, 0.08360278606414795, 0.1332369023002684]}},
             {'name': 'short connector hose',
              'vertices': 24,
              'materials': ['rubber-gaskets'],
              'bounds': {'min': [-0.006276808213442564, 0.12445573508739471, 0.021238049492239952],
                         'max': [0.07794546335935593, 0.22063550353050232, 0.10134699195623398],
                         'size': [0.08422227157279849, 0.0961797684431076, 0.08010894246399403]}}],
 'modelBounds': {'min': [-0.125, -0.23499999940395355, 0.0],
                 'max': [0.125, 0.23499999940395355, 0.42000001668930054]}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'wall-hose-reel':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_864.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
