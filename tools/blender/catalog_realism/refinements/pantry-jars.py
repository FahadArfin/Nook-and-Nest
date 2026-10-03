"""Measured original pantry-jars construction refinement; Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'pantry-jars'
SOURCE_COMPONENTS = [{'name': 'open_vessel',
  'vertices': 128,
  'materials': ['smoky-mirror'],
  'bounds': {'min': [-0.2065868377685547, -0.07547169923782349, 0.0],
             'max': [-0.0928143709897995, 0.07547169923782349, 0.15991398692131042]},
  'kind': 'vessel'},
 {'name': 'open_vessel.001',
  'vertices': 128,
  'materials': ['smoky-mirror'],
  'bounds': {'min': [-0.056886225938797, -0.07547169923782349, 0.0],
             'max': [0.056886225938797, 0.07547169923782349, 0.20352686941623688]},
  'kind': 'vessel'},
 {'name': 'open_vessel.002',
  'vertices': 128,
  'materials': ['smoky-mirror'],
  'bounds': {'min': [0.0928143709897995, -0.07547169923782349, 0.0],
             'max': [0.2065868377685547, 0.07547169923782349, 0.24713978171348572]},
  'kind': 'vessel'}]


def apply(root, scene, item, material_keys, object_names):
    if item["id"] != CATALOG_ID:
        raise ValueError("Refinement targets a different catalog ID")
    helper = runpy.run_path(str(Path(__file__).with_name("vessel_geometry.py")))
    return helper["apply_refinement"](scene, item, material_keys, object_names, SOURCE_COMPONENTS)
