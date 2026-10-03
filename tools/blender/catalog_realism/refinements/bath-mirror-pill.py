"""Exact reviewed construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'bath-mirror-pill'
SOURCE_COMPONENTS = [{'name': 'continuous_mirror_frame',
  'vertices': 344,
  'materials': ['variant-surface'],
  'bounds': {'min': [-0.2750000059604645, -0.01964285783469677, 0.0],
             'max': [0.2750000059604645, 0.02500000037252903, 0.949999988079071]},
  'kind': 'panel'},
 {'name': 'mirror_glass',
  'vertices': 344,
  'materials': ['bathroom-mirror'],
  'bounds': {'min': [-0.25, -0.02500000037252903, 0.02500000037252903],
             'max': [0.25, -0.01785714365541935, 0.925000011920929]},
  'kind': 'panel'}]

def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong source-specific recipe")
    helper = runpy.run_path(str(Path(__file__).with_name("fixture_contacts.py")))
    return helper["apply_mirror"](scene,item,material_keys,object_names,SOURCE_COMPONENTS)
