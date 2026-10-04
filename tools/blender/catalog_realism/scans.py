"""Explicit coherent CC0 scan maps for ordinary wood and upholstery only.

Original catalog images and files stay immutable. This plan opts selected
material keys into full-quality existing scan images on metric RealismUV;
base RGBA, alpha, emission, labels, artwork and motion materials stay protected.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re

PLAN = 'assets-source/catalog-realism/scan-plan.json'
INPUTS = ('assets-source/catalog-realism/catalog.json', 'assets-source/catalog-realism/material-plan.json',
          'assets-source/realism-materials.json', 'assets-source/realism-scans.json', 'assets-source/realism-texture-provenance.json')
PROVENANCE = 'assets-source/realism-materials.json'
PROTECTED = re.compile(r'artwork|original[-_]|screen|display|label|marking|globe|countertop|surface-stone|door-surface|glass|mirror|flame|water|light|emissi', re.I)
KEY_FAMILIES = {'wood-dark':'walnut','walnut':'walnut','walnut-case':'walnut',
                'outdoor-teak-grain':'teak','outdoor-teak-grain-light':'teak','warm-teak-infill':'teak'}
MODEL_FAMILIES = {'chester-sofa':'velvet'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inside(root, name):
    require(isinstance(name, str) and name and '\\' not in name and not Path(name).is_absolute() and '..' not in Path(name).parts, 'Invalid scan repository path')
    file = (root/name).resolve()
    require(file != root and file.is_relative_to(root), 'Scan path escapes selected repository')
    return file


def record(root, name):
    file = inside(root, name)
    require(file.is_file() and 0 < file.stat().st_size <= 32*1024*1024, 'Scan input missing or exceeds byte limit: '+name)
    raw = file.read_bytes()
    return {'path': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}


def verify(root, entry):
    actual = record(root, entry['path'])
    require(actual['sha256'] == entry.get('sha256') and ('bytes' not in entry or actual['bytes'] == entry['bytes']), 'Scan input hash changed: '+entry['path'])


def allowed(material, entry, model_id):
    pbr = material.get('pbrMetallicRoughness', {})
    return (not model_id.endswith('-aquarium') and entry.get('profile') in ('wood', 'fabric', 'canvas')
            and not entry.get('protectedReason') and not PROTECTED.search(material['name'])
            and material.get('alphaMode', 'OPAQUE') == 'OPAQUE' and pbr.get('baseColorFactor', [1,1,1,1])[3] == 1
            and pbr.get('metallicFactor', 1) == 0
            and material.get('emissiveFactor', [0,0,0]) == [0,0,0] and 'emissiveTexture' not in material
            and not any(key in material.get('extensions', {}) for key in ('KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_unlit')))


def build_plan(root):
    root = Path(root).resolve()
    load = lambda name: json.loads(inside(root, name).read_text(encoding='utf8'))
    catalog, material_plan, library, scans, provider = [load(name) for name in INPUTS]
    require(catalog.get('scope') == 'beta-only', 'Frozen Beta-only catalog required')
    source_urls = {asset.get('asset', {}).get('url') for asset in provider.get('assets', []) if asset.get('asset', {}).get('license') in ('CC0', 'CC0-1.0')}
    provenance = record(root, PROVENANCE)
    models = {}
    for item in catalog['items']:
        planned = material_plan['models'][item['id']]
        require(planned['baselineGlbSha256'] == item['baselineGlb']['sha256'], 'Material plan baseline differs: '+item['id'])
        entries = {entry['materialKey']: entry for entry in planned['materials']}
        document = item['baselineGltf']
        materials = []
        for material in document['materials']:
            key = material['name']; entry = entries[key]
            reference = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if not reference or not allowed(material, entry, item['id']):
                continue
            profile = entry['profile']
            family = KEY_FAMILIES.get(key, 'oak') if profile == 'wood' else 'canvas' if profile == 'canvas' else MODEL_FAMILIES.get(item['id'], 'twill')
            asset = library['materials'][family]
            require(asset.get('license') == 'CC0-1.0' and asset.get('source') in source_urls, 'Retained CC0 provider evidence required for '+family)
            repeat = asset['repeatM']
            require(isinstance(repeat, (int, float)) and math.isfinite(repeat) and .02 <= repeat <= 4, 'Scan needs a calibrated physical repeat in metres')
            maps, replacements = [], []
            for kind in ('baseColor','normal','orm'):
                source = record(root, asset[kind])
                reason = f'Use the matching licensed {family} {kind} scan at its recorded physical repeat, retaining original tint and dielectric factors.'
                request = {'kind':kind,'source':source,'provenance':provenance,'reason':reason,'texCoord':1}
                maps.append(request)
                old_reference = material.get('normalTexture') if kind == 'normal' else material.get('pbrMetallicRoughness', {}).get('baseColorTexture' if kind == 'baseColor' else 'metallicRoughnessTexture')
                if old_reference:
                    image_index = document['textures'][old_reference['index']]['source']
                    replacements.append({**request,'oldSha256':document['images'][image_index]['sha256']})
            normal_strength = material['normalTexture'].get('scale',1) if material.get('normalTexture') else .14 if profile == 'wood' else .16
            materials.append({'materialKey':key,'profile':profile,'family':family,'protectedReason':None,
                              'repeatM':[repeat,repeat],'grainAxis':asset.get('grainAxis','v'),'normalStrength':normal_strength,
                              'roughnessFactor':material.get('pbrMetallicRoughness',{}).get('roughnessFactor',1),'maps':maps,'replacements':replacements})
        models[item['id']] = {'baselineGlbSha256':item['baselineGlb']['sha256'],'materials':materials}
    return {'version':1,'scope':'beta-only','sourceInputs':[record(root, name) for name in INPUTS],
            'policy':'Explicit ordinary dielectric wood/fabric coherent color, normal and ORM scan maps. This narrow exception replaces prior albedo/procedural surface graphs while preserving base RGBA, roughness/metallic factors, alpha, emission and all protected artwork, labels, optical and motion channels.',
            'mapping':'RealismUV contains part-local metres; one scan repeat occupies repeatM. Grain follows each modeled part longitudinally.',
            'models':models}


def scan_materials_for(root, model_id):
    root = Path(root).resolve()
    plan = json.loads(inside(root, PLAN).read_text(encoding='utf8'))
    require(plan.get('version') == 1 and plan.get('scope') == 'beta-only', 'Explicit Beta scan plan required')
    for input_record in plan['sourceInputs']:
        verify(root, input_record)
    require(model_id in plan['models'], 'Model absent from explicit scan plan')
    model = plan['models'][model_id]
    catalog = json.loads(inside(root, INPUTS[0]).read_text(encoding='utf8'))
    item = next(item for item in catalog['items'] if item['id'] == model_id)
    require(item['baselineGlb']['sha256'] == model['baselineGlbSha256'], 'Scan plan baseline differs')
    verify(root, item['baselineGlb'])
    material_plan = json.loads(inside(root, INPUTS[1]).read_text(encoding='utf8'))['models'][model_id]
    profiles = {entry['materialKey']:entry for entry in material_plan['materials']}
    baseline = {material['name']:material for material in item['baselineGltf']['materials']}
    result = {}
    for entry in model['materials']:
        key = entry['materialKey']
        require(key not in result and key in baseline and allowed(baseline[key], profiles[key], model_id), 'Protected or duplicate scan material: '+key)
        require(entry['profile'] == profiles[key]['profile'] and not entry.get('protectedReason'), 'Scan role differs from material plan')
        require([request['kind'] for request in entry['maps']] == ['baseColor','normal','orm'], 'A coherent scan material requires all three licensed channels')
        require(entry.get('grainAxis') in ('u','v') and isinstance(entry.get('normalStrength'),(int,float)) and math.isfinite(entry['normalStrength']) and 0 <= entry['normalStrength'] <= 2, 'Invalid calibrated scan normal strength or grain axis')
        require(entry['roughnessFactor'] == baseline[key].get('pbrMetallicRoughness',{}).get('roughnessFactor',1), 'Scan roughness factor differs from baseline')
        common = {field:entry[field] for field in ('materialKey','profile','family','repeatM')}
        for request in [*entry['maps'],*entry['replacements']]:
            verify(root,request['source']);verify(root,request['provenance'])
        result[key] = {**entry,'maps':[{**request,**common} for request in entry['maps']],
                       'replacements':[{**request,**common} for request in entry['replacements']]}
    return result


def replacements_for(root, model_id):
    """Compatibility accessor for the original single-albedo pilot."""
    return {key:next(request for request in entry['replacements'] if request['kind']=='baseColor')
            for key,entry in scan_materials_for(root,model_id).items()}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[3])
    parser.add_argument('--write',action='store_true')
    args=parser.parse_args()
    plan=build_plan(args.root)
    if args.write:
        target=args.root/PLAN;target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(plan,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'models':len(plan['models']),'modelsWithScans':sum(bool(m['materials']) for m in plan['models'].values()),'replacedMaterials':sum(len(m['materials']) for m in plan['models'].values()),'plan':PLAN,'written':args.write}))
