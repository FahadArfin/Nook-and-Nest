"""Exact source-measured outdoor construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'outdoor-watering-can'
EVIDENCE = {'sourceBlend': {'bytes': 136623,
                 'path': 'assets-source/blender/outdoor-watering-can.blend',
                 'sha256': 'a893479efeddc58b0bb91f43ff05963f170e5c5059b5903ac09271f4978d12ea'},
 'bounds': {'min': [-0.3499999940395355, -0.10999999195337296, 0.0],
            'max': [0.3499999940395355, 0.10999999195337296, 0.3799999952316284]},
 'objects': [{'name': 'genuinely hollow watering can',
              'vertices': 338,
              'materials': ['brushed-steel'],
              'bounds': {'min': [-0.25730979442596436, -0.10999999195337296, 0.0],
                         'max': [-0.029647668823599815, 0.10999999195337296, 0.2800857722759247]}},
             {'name': 'arched top carrying handle',
              'vertices': 60,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.24883519113063812, -0.011624024249613285, 0.24329325556755066],
                         'max': [-0.040243227034807205, 0.011624024249613285, 0.3774125277996063]}},
             {'name': 'rear D handle',
              'vertices': 60,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.3499999940395355, -0.011624024249613285, 0.052961669862270355],
                         'max': [-0.2414999157190323, 0.011624024249613285, 0.24240149557590485]}},
             {'name': 'tapered pouring spout',
              'vertices': 56,
              'materials': ['brushed-steel'],
              'bounds': {'min': [-0.05998086929321289, -0.01680557057261467, 0.062121301889419556],
                         'max': [0.27472323179244995, 0.01680557057261467, 0.3096288740634918]}},
             {'name': 'rose perforated head',
              'vertices': 64,
              'materials': ['brushed-steel'],
              'bounds': {'min': [0.24544404447078705, -0.0631481483578682, 0.260021448135376],
                         'max': [0.3499999940395355, 0.0631481483578682, 0.3799999952316284]}}],
 'originalSpoutEndpointM': [0.26652389272392074, 0, 0.2974001654711636]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name("outdoor_contacts.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
