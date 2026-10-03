from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.625, 0.625, 0.75],
                         'min': [-0.625, -0.625, 0.6996306777000427],
                         'size': [1.25, 1.25, 0.050369322299957275]},
              'materials': ['variant-surface'],
              'name': 'shaped_slab_top',
              'vertices': 192},
             {'bounds': {'max': [0.42500001192092896,
                                 0.42500001192092896,
                                 0.05540631338953972],
                         'min': [-0.42500001192092896,
                                 -0.42500001192092896,
                                 0.0],
                         'size': [0.8500000238418579,
                                  0.8500000238418579,
                                  0.05540631338953972]},
              'materials': ['wood-honey-textured'],
              'name': 'weighted_elliptic_foot',
              'vertices': 192},
             {'bounds': {'max': [0.3300793766975403,
                                 0.3300793766975403,
                                 0.6895567774772644],
                         'min': [-0.3300793766975403,
                                 -0.3300793766975403,
                                 0.032740090042352676],
                         'size': [0.6601587533950806,
                                  0.6601587533950806,
                                  0.6568166874349117]},
              'materials': ['wood-honey-textured'],
              'name': 'sculpted_center_pedestal',
              'vertices': 192}],
 'sourceBlend': {'bytes': 108868,
                 'path': 'assets-source/blender/round-marble-dining-table.blend',
                 'sha256': 'c9ff5eb803706ad1a93f8495bc140eb261350fae0bac66f688e120a62f92536c'}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'round-marble-dining-table':raise ValueError("Wrong reviewed ID")
    return runpy.run_path(str(Path(__file__).with_name('turned_684.py')))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
