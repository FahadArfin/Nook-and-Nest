"""Exact reviewed source construction; isolated Beta candidate only."""
from pathlib import Path
import runpy

CATALOG_ID = 'kettle-bbq'
EVIDENCE = {'sourceBlend': {'bytes': 133999,
                 'path': 'assets-source/blender/kettle-bbq.blend',
                 'sha256': '198ab88c90e6a1d1d72923bfc9e5a36198fb3e2fa6584e209149e94303a5ddc1'},
 'bounds': {'min': [-0.32499998807907104, -0.3499999940395355, 0.0],
            'max': [0.32499998807907104, 0.3499999940395355, 0.949999988079071]},
 'objects': [{'name': 'double_walled_spun_bowl',
              'vertices': 288,
              'materials': ['powder-coated-charcoal'],
              'bounds': {'min': [-0.3208008408546448, -0.3469901978969574, 0.5067268013954163],
                         'max': [0.31754374504089355, 0.3437742590904236, 0.6525449156761169]}},
             {'name': 'domed_enamel_kettle_lid',
              'vertices': 240,
              'materials': ['powder-coated-charcoal'],
              'bounds': {'min': [-0.3208008408546448, -0.3469901978969574, 0.6610264182090759],
                         'max': [0.31754374504089355, 0.3437742590904236, 0.8910868763923645]}}]}

VENTS = [{'name': 'lid_vent_damper',
  'materials': ['weathered-fasteners'],
  'vertices': 144,
  'bounds': {'min': [0.053879670798778534, -0.06282956153154373, 0.8608716130256653],
             'max': [0.16703104972839355, 0.05961364135146141, 0.8682928681373596]}},
 {'name': 'vent_opening',
  'materials': ['powder-coated-charcoal'],
  'vertices': 72,
  'bounds': {'min': [0.11899509280920029, -0.010848955251276493, 0.8651123642921448],
             'max': [0.13607454299926758, 0.007633038330823183, 0.8746539950370789]}},
 {'name': 'vent_opening.001',
  'materials': ['powder-coated-charcoal'],
  'vertices': 72,
  'bounds': {'min': [0.09657830744981766, 0.0134086599573493, 0.8651123642921448],
             'max': [0.11365776509046555, 0.03189065307378769, 0.8746539950370789]}},
 {'name': 'vent_opening.002',
  'materials': ['powder-coated-charcoal'],
  'vertices': 72,
  'bounds': {'min': [0.07416152954101562, -0.010848955251276493, 0.8651123642921448],
             'max': [0.09124098718166351, 0.007633038330823183, 0.8746539950370789]}},
 {'name': 'vent_opening.003',
  'materials': ['powder-coated-charcoal'],
  'vertices': 72,
  'bounds': {'min': [0.09657830744981766, -0.03510656952857971, 0.8651123642921448],
             'max': [0.11365776509046555, -0.016624577343463898, 0.8746539950370789]}}]

def apply(root,scene,item,material_keys,object_names):
    if item["id"]!=CATALOG_ID:raise ValueError("Wrong source-specific refinement")
    helper=runpy.run_path(str(Path(__file__).with_name('kettle_vent_contact.py')))
    return helper["apply"](root,scene,item,material_keys,object_names,EVIDENCE,VENTS)
