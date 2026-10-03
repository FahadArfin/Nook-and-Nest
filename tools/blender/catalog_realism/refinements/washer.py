"""Measured per-ID repair; no unrelated catalog changes."""
from pathlib import Path
import runpy

EVIDENCE = {'sourceBlend': {'bytes': 163176,
                 'path': 'assets-source/blender/washer.blend',
                 'sha256': 'c693bda3f1e7818a0332e01bd98238d8cbbe0c30e6a91160bc2ef89851104eea'},
 'objects': [{'name': 'washer_door_rim',
              'vertices': 144,
              'materials': ['brushed-steel'],
              'bounds': {'min': [-0.2197248339653015, -0.33072951436042786, 0.19021053612232208],
                         'max': [0.21892575919628143, -0.27773571014404297, 0.6340000629425049],
                         'size': [0.43865059316158295, 0.05299380421638489, 0.4437895268201828]}},
             {'name': 'washer_door_glass',
              'vertices': 144,
              'materials': ['television-screen'],
              'bounds': {'min': [-0.17019976675510406, -0.3499999940395355, 0.24031579494476318],
                         'max': [0.16940069198608398, -0.32591187953948975, 0.5838947296142578],
                         'size': [0.33960045874118805, 0.024088114500045776, 0.34357893466949463]}},
             {'name': 'washer_dial',
              'vertices': 84,
              'materials': ['aged-bronze'],
              'bounds': {'min': [0.12068609148263931, -0.34807294607162476, 0.695263147354126],
                         'max': [0.23226530849933624, -0.31434959173202515, 0.8110526204109192],
                         'size': [0.11157921701669693, 0.03372335433959961, 0.11578947305679321]}},
             {'name': 'Fine perimeter gasket',
              'vertices': 20,
              'materials': ['black-enamel'],
              'bounds': {'min': [-0.21473070979118347, -0.3312295079231262, 0.19354479014873505],
                         'max': [0.2139316350221634, -0.32982951402664185, 0.1948762685060501],
                         'size': [0.42866234481334686, 0.001399993896484375, 0.0013314783573150635]}},
             {'name': 'Fine perimeter gasket.001',
              'vertices': 20,
              'materials': ['black-enamel'],
              'bounds': {'min': [-0.21473070979118347, -0.3312295079231262, 0.6293343305587769],
                         'max': [0.2139316350221634, -0.32982951402664185, 0.6306657791137695],
                         'size': [0.42866234481334686, 0.001399993896484375, 0.0013314485549926758]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'washer':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_864.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
