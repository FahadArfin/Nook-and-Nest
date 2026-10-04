from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.33976757526397705,
                                 0.32059258222579956,
                                 0.507080078125],
                         'min': [-0.33976757526397705,
                                 -0.4000000059604645,
                                 0.3707682192325592],
                         'size': [0.6795351505279541,
                                  0.720592588186264,
                                  0.1363118588924408]},
              'materials': ['upholstery-textured'],
              'name': 'tailored_seat_cushion',
              'vertices': 96},
             {'bounds': {'max': [0.32196322083473206,
                                 0.3019286096096039,
                                 0.4928809106349945],
                         'min': [-0.32196322083473206,
                                 -0.3813360631465912,
                                 0.4872012734413147],
                         'size': [0.6439264416694641,
                                  0.6832646727561951,
                                  0.00567963719367981]},
              'materials': ['modern-tailored-welting'],
              'name': 'seat_double_welt',
              'vertices': 192}],
 'sourceBlend': {'bytes': 147959,
                 'path': 'assets-source/blender/shell-lounge-chair.blend',
                 'sha256': 'e3a7e31b9262f7a2291d8a56de69b71ddc38d32ca18fe8f164f0ece94d886b0c'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'shell-lounge-chair':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name('utility_684.py')))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
