"""Exact five-view-reviewed construction follow-up; isolated Beta recipe."""
from pathlib import Path
import runpy

CATALOG_ID = 'patio-fire-bowl'
SOURCE_SHA256 = '042611b4b35af25237b9e5980f74956ae669613460cdfffbffc026b67d480744'
SOURCE_COMPONENTS = [{'name': 'steel_fire_grate',
  'vertices': 112,
  'materials': ['powder-coated-charcoal'],
  'sourceMaterials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.33608365058898926, -0.2227025032043457, 0.3312767744064331],
             'max': [0.332815557718277, 0.21923577785491943, 0.3523479402065277]}},
 {'name': 'split_firewood',
  'vertices': 64,
  'materials': ['wood-honey-textured'],
  'sourceMaterials': ['wood-honey-textured'],
  'bounds': {'min': [-0.2432156205177307, -0.16756238043308258, 0.3360615372657776],
             'max': [0.235780730843544, 0.16233842074871063, 0.47999998927116394]}}]

PRIOR_VESSEL_COMPONENTS = [{'name': 'double_walled_spun_bowl',
  'vertices': 288,
  'materials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.39578667283058167, -0.39719823002815247, 0.1783578097820282],
             'max': [0.3925185799598694, 0.39420461654663086, 0.420237272977829]},
  'kind': 'fire-bowl'},
 {'name': 'rolled_bowl_lip',
  'vertices': 294,
  'materials': ['powder-coated-charcoal'],
  'bounds': {'min': [-0.4000000059604645, -0.4000000059604645, 0.4112543761730194],
             'max': [0.4000000059604645, 0.4000000059604645, 0.42906421422958374]},
  'kind': 'rim'}]

def apply(root, scene, item, material_keys, object_names):
    if item['id'] != CATALOG_ID: raise ValueError('Wrong exact-source recipe')
    changes = []
    vessel = runpy.run_path(str(Path(__file__).with_name('vessel_geometry.py')))
    changes += vessel['apply_refinement'](scene, item, material_keys, object_names, PRIOR_VESSEL_COMPONENTS)
    helper = runpy.run_path(str(Path(__file__).with_name('reviewed_612.py')))
    changes += helper['apply'](root, scene, item, material_keys, object_names, SOURCE_COMPONENTS, SOURCE_SHA256)
    return changes
