"""Exact five-view-reviewed construction; isolated candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'sonos-ace'
SOURCE_SHA256 = '8eefc679172f472dbc17c79205943336ad9ff17a13a34b92350dd73d7117943a'
SOURCE_COMPONENTS = [{'name': 'oval_earcup',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [-0.07999999821186066, -0.042500000447034836, 0.0],
             'max': [-0.04923076555132866, 0.042500000447034836, 0.09220979362726212]}},
 {'name': 'oval_memory_foam_ear_pad',
  'vertices': 192,
  'materials': ['modern-recess-charcoal'],
  'bounds': {'min': [-0.055784616619348526, -0.03807291388511658, 0.004009123891592026],
             'max': [-0.04501538351178169, 0.03807291388511658, 0.08820066601037979]}},
 {'name': 'oval_earcup.001',
  'vertices': 192,
  'materials': ['wood-honey-textured'],
  'bounds': {'min': [0.04923076555132866, -0.042500000447034836, 0.0],
             'max': [0.07999999821186066, 0.042500000447034836, 0.09220979362726212]}},
 {'name': 'oval_memory_foam_ear_pad.001',
  'vertices': 192,
  'materials': ['modern-recess-charcoal'],
  'bounds': {'min': [0.04501538351178169, -0.03807291388511658, 0.004009123891592026],
             'max': [0.055784616619348526, 0.03807291388511658, 0.08820066601037979]}}]

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != CATALOG_ID: raise ValueError("Wrong exact720 recipe")
    helper=runpy.run_path(str(Path(__file__).with_name("reviewed_720.py")))
    return helper["apply"](root,scene,item,material_keys,object_names,SOURCE_COMPONENTS,SOURCE_SHA256)
