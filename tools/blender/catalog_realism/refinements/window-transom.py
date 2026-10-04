from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.6985000371932983,
                                 0.011461464688181877,
                                 0.7567023634910583],
                         'min': [0.656499981880188,
                                 -0.04219840094447136,
                                 0.0619257315993309],
                         'size': [0.04200005531311035,
                                  0.053659865632653236,
                                  0.6947766318917274]},
              'materials': ['variant-surface-wood'],
              'name': 'compression_sash_stile.001',
              'vertices': 96},
             {'bounds': {'max': [0.48349717259407043,
                                 -0.060984306037425995,
                                 0.441985547542572],
                         'min': [0.46800002455711365,
                                 -0.09000000357627869,
                                 0.36680129170417786],
                         'size': [0.015497148036956787,
                                  0.02901569753885269,
                                  0.07518425583839417]},
              'materials': ['aged-brass-fitting'],
              'name': 'window_lever',
              'vertices': 16}],
 'sourceBlend': {'bytes': 124933,
                 'path': 'assets-source/blender/window-transom.blend',
                 'sha256': 'ee7683b964393a9358bf10ede4d2b049f7e48c39dd146f91bda3a9f2f5d34f98'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!='window-transom':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("final_contacts_864.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
