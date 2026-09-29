"""Read-only source/GLB inventory for the sofa material and tailoring pass."""
import json, re, struct, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GROUPS = {
 'chenille': ['sofa','loveseat','modular-sectional','sleeper-sofa','low-modular-sofa','corner-pit-sofa','everyday-sectional-track-left','everyday-sectional-track-right'],
 'linen': ['midcentury-sofa','slat-day-sofa','library-reading-loveseat','everyday-sectional-soft-left','everyday-sectional-soft-right','designed-sunroom-loveseat','designed-sunroom-chaise'],
 'twill': ['left-chaise-sectional','right-chaise-sectional','u-sectional','track-sofa','modular-play-sofa','upholstered-pet-sofa','everyday-sectional-tailored-left','everyday-sectional-tailored-right','chair-sleeper','chair-sleeper-open'],
 'corduroy': ['boneless-loveseat','boneless-chaise'],
 'velvet': ['chester-sofa','curve-sofa','channel-sofa','metal-frame-sofa','library-reading-chaise'],
 'canvas': ['patio-loveseat','patio-chaise','patio-corner-sofa'],
}
IDS = [id for values in GROUPS.values() for id in values]

def catalog_rows():
    rows = {}
    for path in (ROOT/'src').glob('*.json'):
        data=json.loads(path.read_text(encoding='utf-8-sig'))
        if isinstance(data,list):
            for row in data:
                if isinstance(row,list) and len(row)>6 and row[0] in IDS: rows[row[0]]=row
    manifest=json.loads((ROOT/'tools/blender/modern_manifest.json').read_text())
    for value in manifest.values():
        if not isinstance(value,list): continue
        for row in value:
            if isinstance(row,dict) and row.get('id') in IDS:
                rows[row['id']]=[row['id'],row['name'],row['category'],row['widthMm'],row['depthMm'],row['heightMm'],row['shape'],row['description'],row.get('mount','floor'),row['type']]
    # The original outdoor catalog predates JSON manifests.
    for path in [ROOT/'src/catalog.ts',ROOT/'src/outdoorCatalog.ts',ROOT/'src/interiorCatalog.ts']:
        source=path.read_text(encoding='utf-8-sig')
        for id in IDS:
            if id in rows: continue
            match=re.search(r'\[(?:"|\')'+re.escape(id)+r'(?:"|\')[^\]]+\]',source)
            if match: rows[id]=json.loads(match.group(0).replace("'",'"'))
    assert set(rows)==set(IDS), set(IDS)-set(rows)
    return rows

def glb_document(path):
    data=path.read_bytes()
    return json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])

def inventory():
    rows=catalog_rows(); result=[]
    for id in IDS:
        path=ROOT/'public/models/furniture'/f'{id}.glb'; doc=glb_document(path)
        primitive=[p for mesh in doc['meshes'] for p in mesh['primitives']]
        result.append({'id':id,'row':rows[id],'textureFamily':next(k for k,v in GROUPS.items() if id in v),
          'baseline':{'glbSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,
            'triangles':sum(doc['accessors'][p['indices']]['count']//3 for p in primitive),
            'images':len(doc.get('images',[])), 'materials':[m['name'] for m in doc['materials']]},
          'source':f'assets-source/blender/{id}.blend', 'status':'research complete; rebuild pending'})
    return result

if __name__=='__main__':
    print(json.dumps(inventory(),indent=2))
