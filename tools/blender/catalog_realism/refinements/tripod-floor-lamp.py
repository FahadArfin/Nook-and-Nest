"""Isolated correction bound to the reviewed original source."""
from pathlib import Path
import runpy

CATALOG_ID = 'tripod-floor-lamp'
EVIDENCE = {'sourceBlend': {'bytes': 124909,
                 'path': 'assets-source/blender/tripod-floor-lamp.blend',
                 'sha256': 'c828b7f987e9fee5fb8b951423f7f6ab5aaae6834134fd024d5fbe853a0bd326'},
 'bounds': {'min': [-0.30000001192092896, -0.2750000059604645, 0.0],
            'max': [0.30000001192092896, 0.2750000059604645, 1.600000023841858]},
 'objects': [{'name': 'splayed_timber_tripod',
              'vertices': 48,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.15005382895469666, -0.20615454018115997, 0.0],
                         'max': [0.27616211771965027, 0.20423008501529694, 1.2446982860565186]}},
             {'name': 'tripod_spreader',
              'vertices': 392,
              'materials': ['aged-brass-fitting'],
              'bounds': {'min': [-0.08643171936273575, -0.07735180854797363, 0.563880443572998],
                         'max': [0.08905863761901855, 0.07955820113420486, 0.5889971256256104]}},
             {'name': 'lined_linen_lampshade',
              'vertices': 192,
              'materials': ['upholstery-textured'],
              'bounds': {'min': [-0.29661327600479126, -0.27293500304222107, 1.1485202312469482],
                         'max': [0.29398635029792786, 0.27072861790657043, 1.5936236381530762]}},
             {'name': 'bound_shade_hem',
              'vertices': 784,
              'materials': ['ivory-detail'],
              'bounds': {'min': [-0.30000001192092896, -0.2750000059604645, 1.1423381567001343],
                         'max': [0.30000001192092896, 0.2750000059604645, 1.600000023841858]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong exact catalog refinement")
    helper=runpy.run_path(str(Path(__file__).with_name("final_seating_fixtures.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
