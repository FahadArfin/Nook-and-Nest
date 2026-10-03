"""Same-geometry sofa control: remove the exported full-white sheen lobe.

The BIN chunk and shading properties other than sheen remain unchanged.
Operational authoring extras are omitted. Editable source mirrors the change
with Sheen Weight=0. Production files are never edited.
"""
import bpy, json, struct, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OWNER='Nook realism lab material control'


def _safe_export_extras(value):
    allowed={'catalog_id','sofa_material_key','lab_material_key','realism_family',
             'texture_source','texture_license','repeat_m','nominal_dimensions_m',
             'nominal_width_m','nominal_depth_m','nominal_height_m'}
    if isinstance(value,dict):
        if 'extras' in value:
            extras=value['extras']
            safe={k:v for k,v in extras.items() if k in allowed} if isinstance(extras,dict) else {}
            if safe:value['extras']=safe
            else:del value['extras']
        for item in value.values():_safe_export_extras(item)
    elif isinstance(value,list):
        for item in value:_safe_export_extras(item)


def _encode_glb(document, remaining):
    encoded=json.dumps(document,separators=(',',':')).encode()
    encoded+=b' '*(-len(encoded)%4)
    return (struct.pack('<III',0x46546c67,2,20+len(encoded)+len(remaining))
            +struct.pack('<II',len(encoded),0x4e4f534a)+encoded+remaining)

def build():
    source=ROOT/'assets-source/blender/slat-day-sofa.blend'
    scene=bpy.data.scenes.new('Sofa calibrated material control')
    scene['lab_owner']=OWNER
    with bpy.data.libraries.load(str(source),link=False) as (src,dst):
        dst.objects=list(src.objects)
    parts=[];materials={}
    for obj in dst.objects:
        if not obj or obj.type!='MESH':continue
        if any(s in obj.name.lower() for s in ['ground','camera','backdrop']):continue
        scene.collection.objects.link(obj);obj.data=obj.data.copy();parts.append(obj)
        for i,old in enumerate(obj.data.materials):
            if old not in materials:materials[old]=old.copy()
            mat=materials[old];obj.data.materials[i]=mat
            if mat.name.startswith('upholstery-textured'):
                node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                node.inputs['Sheen Weight'].default_value=0
    scene['catalog_id']='slat-day-sofa'
    scene['nominal_dimensions_m']=[2,.85,.78]
    out=ROOT/'assets-source/experiments/realism-lab/sofa-material.blend'
    bpy.data.libraries.write(str(out),{scene},fake_user=True,compress=True)
    baseline_path=ROOT/'public/experiments/realism-lab/sofa-current.glb'
    original=baseline_path.read_bytes()
    length=struct.unpack_from('<I',original,12)[0]
    doc=json.loads(original[20:20+length]);changed=[]
    remaining=original[20+length:]
    # Sanitize the isolated baseline copy too. Its shading and BIN geometry
    # remain unchanged; the production GLB is never written by this helper.
    _safe_export_extras(doc)
    baseline_path.write_bytes(_encode_glb(doc,remaining))
    for material in doc['materials']:
        extensions=material.get('extensions',{})
        if 'KHR_materials_sheen' in extensions:
            changed.append({'material':material['name'],'removed':extensions.pop('KHR_materials_sheen')})
            if not extensions:material.pop('extensions')
    for key in ['extensionsUsed','extensionsRequired']:
        if key in doc:
            doc[key]=[s for s in doc[key] if s!='KHR_materials_sheen']
            if not doc[key]:doc.pop(key)
    _safe_export_extras(doc)
    rebuilt=_encode_glb(doc,remaining)
    path=ROOT/'public/experiments/realism-lab/sofa-material.glb';path.write_bytes(rebuilt)
    rebuilt_json_length=struct.unpack_from('<I',rebuilt,12)[0]
    report={'parts':len(parts),'changed':changed,'binaryChunkIdentical':rebuilt[20+rebuilt_json_length:]==remaining,'binarySha256':hashlib.sha256(remaining).hexdigest(),'source':str(out),'glb':str(path),'sanitizedBaseline':str(baseline_path)}
    (out.parent/'sofa-material-metadata.json').write_text(json.dumps(report,indent=2)+'\n')
    return report
