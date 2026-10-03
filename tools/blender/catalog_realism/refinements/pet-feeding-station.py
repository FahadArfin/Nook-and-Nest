"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy
import math

CATALOG_ID = 'pet-feeding-station'
SOURCE_SHA256 = 'a82bca22eb270d1b3287dd27a5a31cef334614d51280a7c26debcfe1d8f0080a'
SOURCE_COMPONENTS = [{'name': 'open_food_bowl',
  'vertices': 128,
  'materials': ['brushed-steel'],
  'sourceMaterials': ['brushed-steel'],
  'bounds': {'min': [-0.2240000069141388, -0.10297029465436935, 0.10340426117181778],
             'max': [-0.01600000075995922, 0.10297029465436935, 0.18000000715255737]}},
 {'name': 'open_food_bowl.001',
  'vertices': 128,
  'materials': ['brushed-steel'],
  'sourceMaterials': ['brushed-steel'],
  'bounds': {'min': [0.01600000075995922, -0.10297029465436935, 0.10340426117181778],
             'max': [0.2240000069141388, 0.10297029465436935, 0.18000000715255737]}}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    if item['sourceBlend']['sha256'] != SOURCE_SHA256: raise ValueError('Reviewed source changed')
    changes = []
    # The frozen common pass bevels the two original 32-sided food bowls. This
    # exact recipe replaces their complete profile, so that generated modifier
    # must not be retained on top of the new spun geometry.
    superseded = []
    expected = {s['name'] for s in SOURCE_COMPONENTS}
    for obj in scene.objects:
        name = object_names.get(obj.name, obj.name)
        if name not in expected: continue
        for modifier in list(obj.modifiers):
            if (modifier.name != 'Realism softened manufactured edge' or modifier.type != 'BEVEL'
                    or modifier.segments != 3 or modifier.limit_method != 'ANGLE'
                    or abs(modifier.angle_limit-math.radians(55)) > 1e-6
                    or not 0 < modifier.width <= .001200001 or not modifier.use_clamp_overlap
                    or not modifier.harden_normals):
                raise ValueError('Unexpected modifier on reviewed food bowl: '+name)
            superseded.append({'component':name,'modifier':modifier.name,'widthM':modifier.width})
            obj.modifiers.remove(modifier)
    if superseded:
        changes.append({'kind':'superseded-generated-edge-bevel','components':superseded,
                        'reason':'The exact rolled-lip spun profile supplies the complete bounded bowl edge construction.'})
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
