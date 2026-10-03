"""Exact reviewed room construction refinement; Beta only."""
from pathlib import Path
import runpy

CATALOG_ID = 'nesting-tables'
EVIDENCE = {'objects': [{'bounds': {'max': [0.13972166180610657, -0.10953328758478165, 0.49000000953674316],
                         'min': [0.10409856587648392, -0.15084928274154663, 0.0],
                         'size': [0.03562309592962265, 0.041315995156764984, 0.49000000953674316]},
              'materials': ['wood-dark'],
              'name': 'nest_table_leg_0.002',
              'vertices': 96},
             {'bounds': {'max': [0.3100000023841858, 0.0773068219423294, 0.4032000005245209],
                         'min': [-0.043380990624427795, -0.23999999463558197, 0.33320000767707825],
                         'size': [0.3533809930086136, 0.3173068165779114, 0.06999999284744263]},
              'materials': ['variant-surface'],
              'name': 'nest_table_top_1',
              'vertices': 96},
             {'bounds': {'max': [0.27001839876174927, 0.14878809452056885, 0.4043019115924835],
                         'min': [-0.2534186542034149, -0.211541548371315, 0.27059704065322876],
                         'size': [0.5234370529651642, 0.36032964289188385, 0.13370487093925476]},
              'materials': ['joinery-aged-brass'],
              'name': 'joinery_pin',
              'vertices': 96}],
 'sourceBlend': {'bytes': 123444,
                 'path': 'assets-source/blender/nesting-tables.blend',
                 'sha256': '802ebe2fc5ed2562edf4db0f063c73c58eb9b072da21d1dcabd68f227e4df149'}}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong per-ID refinement")
    return runpy.run_path(str(Path(__file__).with_name("room_construction.py")))["apply"](root, scene, item, material_keys, object_names, EVIDENCE)
