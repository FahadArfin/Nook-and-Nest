"""Exact reviewed garage correction; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'garage-miter-saw'
EVIDENCE = {'sourceBlend': {'bytes': 155532,
                 'path': 'assets-source/blender/garage-miter-saw.blend',
                 'sha256': 'af6c2aff4a718c2874da8590306cb9905bb95be6a370d386f3f4468673427d6d'},
 'bounds': {'min': [-0.375, -0.42500001192092896, 0.0],
            'max': [0.375, 0.42500001192092896, 0.5799999833106995]},
 'objects': [{'name': 'Deep upper blade casing',
              'vertices': 148,
              'materials': ['garage-ochre-tool-polymer'],
              'bounds': {'min': [-0.06283783912658691, -0.34452664852142334, 0.3402979075908661],
                         'max': [-0.004054054152220488,
                                 -0.018609467893838882,
                                 0.5099233388900757]}}]}

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("garage_construction.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
