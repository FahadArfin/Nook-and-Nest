from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.4984999895095825,
                                 0.00950000062584877,
                                 1.4133610725402832],
                         'min': [0.45649999380111694,
                                 -0.045499999076128006,
                                 0.06825888156890869],
                         'size': [0.041999995708465576,
                                  0.054999999701976776,
                                  1.3451021909713745]},
              'materials': ['variant-surface-wood'],
              'name': 'compression_sash_stile.001',
              'vertices': 96},
             {'bounds': {'max': [0.3474971652030945,
                                 -0.06454165279865265,
                                 0.7992847561836243],
                         'min': [0.3320000171661377,
                                 -0.09453413635492325,
                                 0.6667723655700684],
                         'size': [0.015497148036956787,
                                  0.0299924835562706,
                                  0.1325123906135559]},
              'materials': ['aged-brass-fitting'],
              'name': 'window_lever',
              'vertices': 16}],
 'sourceBlend': {'bytes': 126198,
                 'path': 'assets-source/blender/window-tilt-turn.blend',
                 'sha256': '0cf2b796d5b1cf475e0349db5bebcd9bc9111a2b213b6fe58969cd2b55934296'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!='window-tilt-turn':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("final_contacts_864.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
