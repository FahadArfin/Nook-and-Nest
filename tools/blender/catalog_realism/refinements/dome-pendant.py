"""Exact inspected shell refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'dome-pendant'
EVIDENCE = {'objects': [{'bounds': {'max': [0.20000000298023224, 0.20000000298023224, 0.1785714328289032],
                         'min': [-0.20000000298023224, -0.20000000298023224, 0.0],
                         'size': [0.4000000059604645, 0.4000000059604645, 0.1785714328289032]},
              'materials': ['variant-surface.001'],
              'name': 'open_dome_shade',
              'vertices': 320},
             {'bounds': {'max': [0.008999999612569809, 0.008999999612569809, 0.714285671710968],
                         'min': [-0.008999999612569809, -0.008999999612569809, 0.1785714328289032],
                         'size': [0.017999999225139618, 0.017999999225139618, 0.5357142388820648]},
              'materials': ['pulls-and-controls'],
              'name': 'pendant_cord',
              'vertices': 72}],
 'sourceBlend': {'bytes': 130846,
                 'path': 'assets-source/blender/dome-pendant.blend',
                 'sha256': '247b928ea6d228ba0ca28085fbb625722e8ef59f707df887ea1f4c5e9a1321fd'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID:raise ValueError("Wrong exact recipe")
    return runpy.run_path(str(Path(__file__).with_name("small_turned_shells.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
