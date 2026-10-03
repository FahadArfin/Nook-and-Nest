"""Isolated correction bound to the reviewed original source."""
from pathlib import Path
import runpy

CATALOG_ID = 'tall-drawer-chest'
EVIDENCE = {'sourceBlend': {'bytes': 131015,
                 'path': 'assets-source/blender/tall-drawer-chest.blend',
                 'sha256': '4879e3b1d3cdfdfbf3a3078db9949b6f6723866611f8dcb0543a851a040c79be'},
 'bounds': {'min': [-0.3499999940395355, -0.23499999940395355, 0.0],
            'max': [0.3499999940395355, 0.23499999940395355, 1.25]},
 'objects': [{'name': 'separate_door_or_drawer_front',
              'vertices': 96,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.3230000138282776, -0.22650942206382751, 0.09700000286102295],
                         'max': [0.3230000138282776, -0.20386791229248047, 0.44966667890548706]}},
             {'name': 'recessed_finger_pull',
              'vertices': 96,
              'materials': ['modern-recess-charcoal'],
              'bounds': {'min': [-0.21780000627040863, -0.23499999940395355, 0.41449999809265137],
                         'max': [0.21780000627040863, -0.22179244458675385, 0.42549997568130493]}},
             {'name': 'separate_door_or_drawer_front.001',
              'vertices': 96,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.3230000138282776, -0.22650942206382751, 0.4636666476726532],
                         'max': [0.3230000138282776, -0.20386791229248047, 0.8163332939147949]}},
             {'name': 'recessed_finger_pull.001',
              'vertices': 96,
              'materials': ['modern-recess-charcoal'],
              'bounds': {'min': [-0.21780000627040863, -0.23499999940395355, 0.781166672706604],
                         'max': [0.21780000627040863, -0.22179244458675385, 0.7921667098999023]}},
             {'name': 'separate_door_or_drawer_front.002',
              'vertices': 96,
              'materials': ['wood-honey-textured'],
              'bounds': {'min': [-0.3230000138282776, -0.22650942206382751, 0.8303333520889282],
                         'max': [0.3230000138282776, -0.20386791229248047, 1.1829999685287476]}},
             {'name': 'recessed_finger_pull.002',
              'vertices': 96,
              'materials': ['modern-recess-charcoal'],
              'bounds': {'min': [-0.21780000627040863, -0.23499999940395355, 1.1478333473205566],
                         'max': [0.21780000627040863, -0.22179244458675385, 1.1588332653045654]}}]}

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong exact catalog refinement")
    helper=runpy.run_path(str(Path(__file__).with_name("final_seating_fixtures.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
