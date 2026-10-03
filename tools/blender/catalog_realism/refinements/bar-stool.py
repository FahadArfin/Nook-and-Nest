"""Exact reviewed construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'bar-stool'
SOURCE_COMPONENTS = [{'name': 'aluminum_foot',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.20658721029758453, -0.20671574771404266, 0.0],
             'max': [-0.15653304755687714, -0.15854685008525848, 0.3347260355949402]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.001',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.20658721029758453, 0.14272770285606384, 0.0],
             'max': [-0.15653304755687714, 0.19089660048484802, 0.3347260355949402]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.002',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.15653304755687714, -0.20671574771404266, 0.0],
             'max': [0.20658721029758453, -0.15854685008525848, 0.3347260355949402]},
  'kind': 'leg'},
 {'name': 'aluminum_foot.003',
  'vertices': 192,
  'materials': ['modern-brushed-aluminum'],
  'bounds': {'min': [0.15653304755687714, 0.14272770285606384, 0.0],
             'max': [0.20658721029758453, 0.19089660048484802, 0.3347260355949402]},
  'kind': 'leg'},
 {'name': 'footrest',
  'vertices': 384,
  'materials': ['modern-brushed-aluminum'],
  'bounds': {'min': [-0.17473456263542175, -0.17606282234191895, 0.12542523443698883],
             'max': [0.17473456263542175, 0.1602436751127243, 0.15574462711811066]},
  'kind': 'ring'},
 {'name': 'structural_seat_pan',
  'vertices': 96,
  'materials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.1853824257850647, -0.1963331699371338, 0.27661386132240295],
             'max': [0.1853824257850647, 0.1391325443983078, 0.3220929801464081]},
  'kind': 'pan'},
 {'name': 'tailored_back_cushion',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'bounds': {'min': [-0.19111591577529907, 0.04086136817932129, 0.40303006768226624],
             'max': [0.19111591577529907, 0.20999999344348907, 0.7200000286102295]},
  'kind': 'soft-contact'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("fixture_contacts.py")))
    return helper["apply_stool"](scene,item,material_keys,object_names,SOURCE_COMPONENTS)
