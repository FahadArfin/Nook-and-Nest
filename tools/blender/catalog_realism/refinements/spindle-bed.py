from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.48588037490844727,
                                 0.8477778434753418,
                                 0.4849884510040283],
                         'min': [-0.48588037490844727,
                                 0.4588889181613922,
                                 0.3879907429218292],
                         'size': [0.9717607498168945,
                                  0.3888889253139496,
                                  0.0969977080821991]},
              'materials': ['warm-porcelain'],
              'name': 'pillow',
              'vertices': 96},
             {'bounds': {'max': [0.6602718830108643,
                                 0.8968027234077454,
                                 0.4877837002277374],
                         'min': [-0.6593977212905884,
                                 -0.8959894180297852,
                                 0.3821943700313568],
                         'size': [1.3196696043014526,
                                  1.7927921414375305,
                                  0.10558933019638062]},
              'materials': ['tailored-tone-on-tone-stitch'],
              'name': 'tailored_double_welt',
              'vertices': 450}],
 'sourceBlend': {'bytes': 157731,
                 'path': 'assets-source/blender/spindle-bed.blend',
                 'sha256': 'e34ba5b762e1d9d2f91ee02d8ba9e33cbd2ddff5e1e47c81941f62a37d3da513'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'spindle-bed':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_756.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
