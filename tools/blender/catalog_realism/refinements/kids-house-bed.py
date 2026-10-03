"""Exact reviewed source construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'kids-house-bed'
EVIDENCE = {'sourceBlend': {'bytes': 146472,
                 'path': 'assets-source/blender/kids-house-bed.blend',
                 'sha256': '22f6848a1003f562dfd6e0f60ac425a81db5c975132a9fc1024b25a92a0ea19e'},
 'bounds': {'min': [-0.5249999761581421, -1.024999976158142, 0.0],
            'max': [0.5249999761581421, 1.024999976158142, 1.5]},
 'objects': [{'name': 'pillow',
              'vertices': 96,
              'materials': ['warm-porcelain'],
              'bounds': {'min': [-0.3263075351715088, 0.44133543968200684, 0.3911193311214447],
                         'max': [0.3263075351715088, 0.8284717798233032, 0.48889920115470886]}},
             {'name': 'tailored_double_welt',
              'vertices': 450,
              'materials': ['tailored-tone-on-tone-stitch'],
              'bounds': {'min': [-0.4325387477874756, -0.8694491982460022, 0.38256579637527466],
                         'max': [0.4333774745464325, 0.8702588081359863, 0.4917086362838745]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('household_upholstery.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
