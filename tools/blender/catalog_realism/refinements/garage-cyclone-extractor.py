"""Exact reviewed garage correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'garage-cyclone-extractor'
EVIDENCE = {'sourceBlend': {'bytes': 1439152,
                 'path': 'assets-source/blender/garage-cyclone-extractor.blend',
                 'sha256': 'abd4203f24bd1f5a4c576c59fa40ff232084e0ddce349ed346a88d78a9755027'},
 'bounds': {'min': [-0.32500001788139343, -0.23000000417232513, 0.0],
            'max': [0.32500001788139343, 0.23000000417232513, 1.0999999046325684]},
 'objects': [{'name': 'Tapered real cyclone shell',
              'vertices': 576,
              'materials': ['garage-ochre-tool-polymer'],
              'bounds': {'min': [-0.2290000170469284, -0.10300000756978989, 0.5304184556007385],
                         'max': [-0.023000001907348633, 0.10300000756978989, 0.9115936756134033]}},
             {'name': 'Cyclone tangential inlet',
              'vertices': 48,
              'materials': ['garage-ochre-tool-polymer'],
              'bounds': {'min': [-0.09200000762939453, -0.12400000542402267, 0.780501663684845],
                         'max': [0.024000003933906555, -0.07200000435113907, 0.8329384922981262]}},
             {'name': 'Cyclone inlet rolled lip',
              'vertices': 200,
              'materials': ['garage-graphite-cast-metal'],
              'bounds': {'min': [0.023000001907348633, -0.12700000405311584, 0.7774764895439148],
                         'max': [0.029000001028180122, -0.0690256655216217, 0.8359636664390564]}},
             {'name': 'Extractor head',
              'vertices': 80,
              'materials': ['garage-graphite-cast-metal'],
              'bounds': {'min': [0.0950000062584877, -0.06599999964237213, 0.5606704354286194],
                         'max': [0.29100000858306885, 0.1300000101327896, 0.6352920532226562]}},
             {'name': 'Connected overhead dust hose',
              'vertices': 72,
              'materials': ['garage-fine-rubber'],
              'bounds': {'min': [-0.15000000596046448, -0.024000000208616257, 0.6371703743934631],
                         'max': [0.21697013080120087, 0.05594313517212868, 1.0999999046325684]}}]}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("garage_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
