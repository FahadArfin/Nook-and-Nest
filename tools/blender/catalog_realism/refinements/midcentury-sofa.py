"""Exact five-view-reviewed component correction; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'midcentury-sofa'
SOURCE_SHA256 = '7b1ce6bb4f78cae62420e562e0278425323855232682100169be84c876c26dee'
SOURCE_COMPONENTS = [{'name': 'juniper_wood_frame',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured.009'],
  'bounds': {'min': [-0.9846336245536804, -0.4300000071525574, 0.20809343457221985],
             'max': [0.9846336245536804, 0.4057055413722992, 0.33312511444091797]},
  'kind': 'hard'},
 {'name': 'juniper_tailored_back_1',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'sourceMaterials': ['upholstery-textured.016'],
  'bounds': {'min': [0.04808574169874191, 0.19569873809814453, 0.4421730637550354],
             'max': [0.9738484621047974, 0.4300000071525574, 0.8299999833106995]},
  'kind': 'soft'},
 {'name': 'juniper_tailored_back_0',
  'vertices': 96,
  'materials': ['upholstery-textured'],
  'sourceMaterials': ['upholstery-textured.016'],
  'bounds': {'min': [-0.9701695442199707, 0.19572517275810242, 0.4421730637550354],
             'max': [-0.05176461488008499, 0.4299735724925995, 0.8299999833106995]},
  'kind': 'soft'},
 {'name': 'juniper_open_arm_post.001',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured.009'],
  'bounds': {'min': [0.9228065609931946, -0.09312644600868225, 0.2561825215816498],
             'max': [1.0045613050460815, 0.01484584342688322, 0.669748842716217]},
  'kind': 'hard'},
 {'name': 'juniper_open_arm_post',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured.009'],
  'bounds': {'min': [-1.0045613050460815, -0.09312644600868225, 0.2561825215816498],
             'max': [-0.9228065609931946, 0.01484584342688322, 0.669748842716217]},
  'kind': 'hard'},
 {'name': 'juniper_arm_rail.001',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured.009'],
  'bounds': {'min': [0.902367889881134, -0.3951789438724518, 0.6168508529663086],
             'max': [1.024999976158142, 0.3708844780921936, 0.6937934756278992]},
  'kind': 'hard'},
 {'name': 'juniper_arm_rail',
  'vertices': 96,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured.009'],
  'bounds': {'min': [-1.024999976158142, -0.3951789438724518, 0.6168508529663086],
             'max': [-0.902367889881134, 0.3708844780921936, 0.6937934756278992]},
  'kind': 'hard'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_504.py')))
    return helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
