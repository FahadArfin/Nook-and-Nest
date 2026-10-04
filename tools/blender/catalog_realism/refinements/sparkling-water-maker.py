from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.00800000037997961,
                                 -0.04129999876022339,
                                 0.42081671953201294],
                         'min': [-0.00800000037997961,
                                 -0.05730000138282776,
                                 0.3660358488559723],
                         'size': [0.01600000075995922,
                                  0.01600000262260437,
                                  0.05478087067604065]},
              'materials': ['brushed-stainless-steel'],
              'name': 'Carbonation nozzle',
              'vertices': 64},
             {'bounds': {'max': [0.020519999787211418,
                                 -0.02297999896109104,
                                 0.3381474018096924],
                         'min': [-0.020519999787211418,
                                 -0.06402000039815903,
                                 0.3192231059074402],
                         'size': [0.041039999574422836,
                                  0.041040001437067986,
                                  0.018924295902252197]},
              'materials': ['black-enamel'],
              'name': 'Bottle neck collar',
              'vertices': 64}],
 'sourceBlend': {'bytes': 123660,
                 'path': 'assets-source/blender/sparkling-water-maker.blend',
                 'sha256': 'a9ab6379a2e380de08b5486c172fa5823951a6ae2932534ab47a53b541d1af12'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'sparkling-water-maker':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_756.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
