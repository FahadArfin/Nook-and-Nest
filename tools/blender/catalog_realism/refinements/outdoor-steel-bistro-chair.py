"""Exact source-measured outdoor construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'outdoor-steel-bistro-chair'
EVIDENCE = {'sourceBlend': {'bytes': 96882,
                 'path': 'assets-source/blender/outdoor-steel-bistro-chair.blend',
                 'sha256': '2d82cef5777df196a87daf71178a087ad9abf5361d29376548bd94a73164400b'},
 'bounds': {'min': [-0.23500001430511475, -0.26500001549720764, 0.0],
            'max': [0.23500001430511475, 0.26500001549720764, 0.8400000333786011]},
 'objects': [{'name': 'folding front frame',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.22791117429733276, -0.25444573163986206, 0.007523877080529928],
                         'max': [-0.20338259637355804, 0.20553800463676453, 0.7958167195320129]}},
             {'name': 'folding rear frame',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.22842217981815338, -0.20619577169418335, 0.005770974326878786],
                         'max': [-0.20287159085273743, 0.22316375374794006, 0.4903489351272583]}},
             {'name': 'folding front frame.001',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [0.20338259637355804, -0.25444573163986206, 0.007523877080529928],
                         'max': [0.22791117429733276, 0.20553800463676453, 0.7958167195320129]}},
             {'name': 'folding rear frame.001',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [0.20287159085273743, -0.20619577169418335, 0.005770974326878786],
                         'max': [0.22842217981815338, 0.22316375374794006, 0.4903489351272583]}},
             {'name': 'lower foot cross brace',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.2156468778848648, -0.24753297865390778, 0.07109667360782623],
                         'max': [0.2156468778848648, -0.23056496679782867, 0.08874112367630005]}},
             {'name': 'lower foot cross brace.001',
              'vertices': 56,
              'materials': ['outdoor-forest-powdercoat'],
              'bounds': {'min': [-0.2156468778848648, 0.20161958038806915, 0.08147574961185455],
                         'max': [0.2156468778848648, 0.21858759224414825, 0.09912019968032837]}}],
 'frameCenterlinesM': {'front': [(-0.24703391076940476, 0.01141699299694527),
                                 (0.19812618376630725, 0.7919236036155977)],
                       'rear': [(0.21709040304025015, 0.01141699299694527),
                                (-0.2001224209864934, 0.48470291645719193)]}}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name("outdoor_contacts.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
