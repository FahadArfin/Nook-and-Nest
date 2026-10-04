"""Exact five-view-reviewed construction; isolated candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'sonos-ace-ultra'
SOURCE_SHA256 = '65aaaf7ab1bdede48b3739cce9a91d7f00377c39f1db6dfe79cdf5ae02764d2d'
SOURCE_COMPONENTS = [{'name': 'oval_earcup',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.08150000125169754, -0.04540000110864639, 0.0],
             'max': [-0.05015384405851364, 0.04540000110864639, 0.09323905408382416]}},
 {'name': 'oval_memory_foam_ear_pad',
  'vertices': 192,
  'materials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.05683057755231857, -0.040670834481716156, 0.004053873009979725],
             'max': [-0.04585941880941391, 0.040670834481716156, 0.0891851857304573]}},
 {'name': 'oval_earcup.001',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [0.05015384405851364, -0.04540000110864639, 0.0],
             'max': [0.08150000125169754, 0.04540000110864639, 0.09323905408382416]}},
 {'name': 'oval_memory_foam_ear_pad.001',
  'vertices': 192,
  'materials': ['modern-recess-charcoal'],
  'bounds': {'min': [0.04585941880941391, -0.040670834481716156, 0.004053873009979725],
             'max': [0.05683057755231857, 0.040670834481716156, 0.0891851857304573]}}]

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong exact720 recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("reviewed_720.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS,SOURCE_SHA256)
