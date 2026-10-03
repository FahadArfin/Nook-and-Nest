"""Exact reviewed construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'bean-coffee-machine'
SOURCE_COMPONENTS = [{'name': 'coffee_machine_body',
  'vertices': 96,
  'materials': ['graphite-enamel'],
  'bounds': {'min': [-0.15000000596046448, -0.1804884970188141, 0.009031260386109352],
             'max': [0.1492021232843399, 0.20999999344348907, 0.3711952567100525]},
  'kind': 'case'},
 {'name': 'coffee_display',
  'vertices': 96,
  'materials': ['smoky-mirror'],
  'bounds': {'min': [-0.05575132369995117, -0.18901105225086212, 0.26865485310554504],
             'max': [0.054953452199697495, -0.181263267993927, 0.33846959471702576]},
  'kind': 'preserved'},
 {'name': 'paired_coffee_spout',
  'vertices': 120,
  'materials': ['brushed-nickel-hardware'],
  'bounds': {'min': [-0.043284572660923004, -0.20660962164402008, 0.14404365420341492],
             'max': [-0.021343085914850235, -0.18225941061973572, 0.2100023478269577]},
  'kind': 'spout'},
 {'name': 'paired_coffee_spout.001',
  'vertices': 120,
  'materials': ['brushed-nickel-hardware'],
  'bounds': {'min': [0.020545214414596558, -0.20660962164402008, 0.14404365420341492],
             'max': [0.04248670116066933, -0.18225941061973572, 0.2100023478269577]},
  'kind': 'spout'},
 {'name': 'drip_tray',
  'vertices': 96,
  'materials': ['brushed-nickel-hardware'],
  'bounds': {'min': [-0.13055185973644257, -0.20838052034378052, 0.0],
             'max': [0.1297539919614792, -0.08751503378152847, 0.035516224801540375]},
  'kind': 'tray'},
 {'name': 'steam_wand',
  'vertices': 24,
  'materials': ['brushed-nickel-hardware'],
  'bounds': {'min': [0.10859621316194534, -0.20999999344348907, 0.10267186164855957],
             'max': [0.1359148919582367, -0.13265657424926758, 0.240165576338768]},
  'kind': 'preserved'},
 {'name': 'Drip tray mesh crossbar',
  'vertices': 8,
  'materials': ['brushed-stainless-steel'],
  'bounds': {'min': [-0.10212765634059906, -0.1561499983072281, 0.046300001442432404],
             'max': [0.10132978111505508, -0.1546499878168106, 0.04829999804496765]},
  'kind': 'grille'},
 {'name': 'Drip tray mesh crossbar.011',
  'vertices': 8,
  'materials': ['brushed-stainless-steel'],
  'bounds': {'min': [-0.10212765634059906, -0.07299000024795532, 0.046300001442432404],
             'max': [0.10132978111505508, -0.07149000465869904, 0.04829999804496765]},
  'kind': 'grille'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("fixture_contacts.py")))
    return helper["apply_coffee"](scene,item,material_keys,object_names,SOURCE_COMPONENTS)
