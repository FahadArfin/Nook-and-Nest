from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.3229655921459198,
                                 0.1830091029405594,
                                 0.6825920343399048],
                         'min': [-0.3229655921459198,
                                 -0.6805619597434998,
                                 0.3587576746940613],
                         'size': [0.6459311842918396,
                                  0.8635710626840591,
                                  0.3238343596458435]},
              'materials': ['sage-enamel'],
              'name': 'deep pressed steel tray',
              'vertices': 336},
             {'bounds': {'max': [0.32500001788139343,
                                 0.18503858149051666,
                                 0.6899999976158142],
                         'min': [-0.32500001788139343,
                                 -0.682591438293457,
                                 0.6751840710639954],
                         'size': [0.6500000357627869,
                                  0.8676300197839737,
                                  0.014815926551818848]},
              'materials': ['sage-enamel'],
              'name': 'rolled tray rim',
              'vertices': 296}],
 'sourceBlend': {'bytes': 123638,
                 'path': 'assets-source/blender/steel-wheelbarrow.blend',
                 'sha256': '5747abe9da60c4513f831ac455946e4c79ff9e99146d3b81b1ffea6e6754275b'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'steel-wheelbarrow':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name("household_756.py")))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
