"""Native tiled textile and walnut for the measured sectional experiment.

Fabric030 is ambientCG's procedural approximation, not a photographed chenille
scan. Its 0.28 m repeat is an artistic calibration, not a manufacturer claim.
The catalog's soft-grey-chenille key is retained for saved-color compatibility.
"""
import hashlib
import json
import runpy
from pathlib import Path
import numpy as np

FABRIC = 'soft-grey-chenille'
THREAD = 'seam'
WOOD = 'walnut'
BASE = 'public/textures/realism/'


def source_manifest(root):
    root = Path(root)
    result = []
    for family, prefix, url, repeat in (
        ('fabric', 'Fabric030', 'https://ambientcg.com/a/Fabric030', .28),
        ('walnut', 'walnut_veneer_02', 'https://polyhaven.com/a/walnut_veneer_02', 1.0),
    ):
        for kind, suffix in [('baseColor','color'),('normal','normal'),('orm','orm')]:
            path = root / BASE / (prefix + '-' + suffix + '.jpg')
            result.append({'path': path.relative_to(root).as_posix(), 'kind': kind,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'source': url, 'license': 'CC0-1.0', 'repeatM': [repeat, repeat],
                'scaleEvidence': 'artist calibrated' if family == 'fabric' else 'provider one-metre tile'})
    return result


def _linear(hex_color):
    channels = [int(hex_color[n:n+2],16)/255 for n in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels)+(1,)


def create_materials(root):
    root = Path(root).resolve()
    helper = runpy.run_path(str(root/'tools/blender/sofa_realism_materials.py'))
    # The frozen portable node builder remains shared; all images written by
    # this study have new names, so previous reviewed artifacts cannot drift.
    globals_ = helper['_textured'].__globals__
    globals_['SOURCES'] = {
        'wool': {'url':'https://ambientcg.com/a/Fabric030','repeatM':(.28,.28)},
        'oak': {'url':'https://polyhaven.com/a/walnut_veneer_02','repeatM':(1.,1.)},
    }
    maps = {}
    for family, prefix in [('wool','Fabric030'),('oak','walnut_veneer_02')]:
        source = {kind: helper['_load'](root, prefix+'-'+suffix+'.jpg', kind!='baseColor')
                  for kind,suffix in [('baseColor','color'),('normal','normal'),('orm','orm')]}
        base = helper['_pixels'](source['baseColor'])
        if family == 'wool':
            luminance = base[:,:3] @ np.array((.2126,.7152,.0722), dtype=np.float32)
            # Retain interwoven yarn variation with an independently editable
            # blue-grey color factor, without baking a dark tint twice.
            base[:,:3] = np.clip(.76+.54*(luminance/max(float(luminance.mean()),1e-6)-1),.25,.99)[:,None]
        else:
            base[:,:3] *= .70
        base[:,3] = 1
        source['baseColor'] = helper['_save_image'](root,'sectional-'+family+'-color.png',source['baseColor'],base,False)
        orm = helper['_pixels'](source['orm'])
        orm[:,1] = (.80+.16*orm[:,1] if family=='wool' else .57+.22*orm[:,1])
        orm[:,2] = 0
        orm[:,3] = 1
        source['orm'] = helper['_save_image'](root,'sectional-'+family+'-orm.png',source['orm'],orm,True)
        maps[family] = source
    tint = _linear('5f6465')
    materials = {
        FABRIC: helper['_textured'](root,FABRIC,tint,'wool',maps['wool'],normal_strength=.50),
        THREAD: helper['_textured'](root,THREAD,tuple(c*.72 for c in tint[:3])+(1,), 'wool',maps['wool'],normal_strength=.10,use_orm=False),
        WOOD: helper['_textured'](root,WOOD,(.62,.55,.47,1),'oak',maps['oak'],normal_strength=.15),
    }
    materials[THREAD].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.94
    materials[FABRIC]['texture_technique']='ambientCG approximation; not a photographic scan'
    materials[FABRIC]['texture_scale_evidence']='artist calibrated 0.28 m repeat'
    return materials


def material_map_receipts(root, materials):
    root = Path(root)
    result = []
    for key in (FABRIC,WOOD):
        material=materials[key]
        for kind,name in json.loads(material['surface_maps']).items():
            path=root/name
            result.append({'kind':kind,'materialKey':key,'path':name,
                'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,
                'method':'native tiled PBR; metre UV', 'repeatM':list(material['texture_repeat_m'])})
    return result
