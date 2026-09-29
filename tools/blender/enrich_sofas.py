"""Preserve editable sofa construction while adding measured textile/wood PBR.

Only the tagged review scene is replaced. Existing source parts are appended,
never rebuilt as generic cushions. Run through the official Blender MCP:
    module = runpy.run_path(...); module['build']('sofa')
Then render front/rear/underside/closeup with the MCP render tool.
"""
import bpy, json, math, struct, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from sofa_realism_inventory import IDS, GROUPS, catalog_rows, glb_document
from sofa_realism_baseline import verified_original
import build_kitchen_essentials as G

OWNER='Nook sofa realism authoring'
REPORT=ROOT/'assets-source/sofa-realism-audit.json'
REFERENCE=ROOT/'assets-source/sofa-realism-references.json'
TEXTURE_MANIFEST=ROOT/'assets-source/realism-materials.json'
TEXTURE_REPEAT={'linen':.32,'chenille':.28,'twill':.30,'velvet':.20,'canvas':.32,'corduroy':.267}
SEAM_WORDS=('stitch','seam','welt','piping','thread')
FABRIC_WORDS=('upholster','fabric','linen','cloth','chenille','canvas')
WOOD_WORDS=('wood','walnut','oak','maple','rattan','cane','timber','teak')
FABRIC_DEFAULTS={
 'library-reading-chaise':{'bluecloth':'#3f5669'},
 'library-reading-loveseat':{'linen':'#89745b'},
 'designed-sunroom-loveseat':{'natural-linen':'#bca16f','sage-upholstery':'#607157'},
 'designed-sunroom-chaise':{'natural-linen':'#ab8e61'},
 'chair-sleeper':{'entry-sage-upholstery':'#6b7964','entry-slate-upholstery':'#3c5062','household-slate-fabric':'#4a5f6d'},
 'chair-sleeper-open':{'entry-sage-upholstery':'#6b7964','entry-slate-upholstery':'#3c5062'},
 **{f'everyday-sectional-{style}-{side}':{key:color}
    for style,key,color in [('track','soft-grey-chenille','#5f6465'),('soft','linen','#827364'),('tailored','bluecloth','#586e7c')]
    for side in ['left','right']},
}

def _canonical(name,expected):
    if name in expected:return name
    stripped=name
    while stripped not in expected and len(stripped)>4 and stripped[-4]=='.' and stripped[-3:].isdigit():stripped=stripped[:-4]
    return stripped if stripped in expected else name

def _baseline(id):
    refs=json.loads(REFERENCE.read_text(encoding='utf-8-sig'))
    return next(p for p in refs['models'] if p['id']==id)

def _texture_records():
    """Root supplies reusable, licensed neutral maps in this small manifest.

    Accepted: {materials:{linen:{baseColor,normal,roughness|orm,repeatM},...}}.
    Every map path is relative to the repository. Missing maps fail authoring.
    """
    if not TEXTURE_MANIFEST.exists(): raise FileNotFoundError(TEXTURE_MANIFEST)
    data=json.loads(TEXTURE_MANIFEST.read_text(encoding='utf-8-sig'))
    return data.get('materials',data)

def _source_path(id):
    # A fresh checkout contains enriched tracked sources. Never use those as
    # originals: repeated stitching/welt projection would alter the construction.
    return verified_original(id, ROOT)

def _load(id):
    G.OWNER=OWNER
    s=G.own_scene();s.name='Sofa material realism'
    before=set(bpy.data.objects)
    with bpy.data.libraries.load(str(_source_path(id)),link=False) as (src,dst):
        dst.objects=list(src.objects)
    parts=[]
    for o in dst.objects:
        if o is None:continue
        if o.type!='MESH' or any(t in o.name.lower() for t in ['review ground','studio floor','backdrop','ground_plane','presentation_floor']):
            if o in bpy.data.objects.values() and o.users==0:bpy.data.objects.remove(o)
            continue
        s.collection.objects.link(o);o['catalog_id']=id;o['authoring_owner']=OWNER
        # Imported dependencies can be shared within the source, but not outside.
        o.data=o.data.copy();parts.append(o)
    if not parts:raise ValueError('No editable source parts '+id)
    bpy.context.view_layer.update()
    for o in parts:
        mw=o.matrix_world.copy()
        for v in o.data.vertices:v.co=mw@v.co
        o.matrix_world=Matrix.Identity(4);o.data.update()
    return s,parts

def inspect(id):
    s,parts=_load(id)
    return {'id':id,'objects':[{'name':o.name,'dimensions':[round(v,4) for v in o.dimensions],
      'materials':[m.name if m else None for m in o.data.materials],'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in parts]}

def _kind(key):
    lower=key.lower()
    if any(s in lower for s in SEAM_WORDS):return 'seam'
    if any(s in lower for s in FABRIC_WORDS):return 'fabric'
    if any(s in lower for s in WOOD_WORDS):return 'wood'
    return 'other'

def _image(path,linear=False):
    path=ROOT/path
    if not path.exists():raise FileNotFoundError(path)
    image=bpy.data.images.load(str(path),check_existing=True)
    image.colorspace_settings.name='Non-Color' if linear else 'sRGB'
    if not image.packed_file:image.pack()
    return image

def _map(mat,path,name,linear=False):
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.name=name;node.label=name
    node.image=_image(path,linear);node.extension='REPEAT';node.interpolation='Linear'
    return node

def _linear_hex(hexcolor):
    srgb=[int(hexcolor[i:i+2],16)/255 for i in [1,3,5]]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in srgb)

def _variant_tint(id):
    defaults=json.loads((ROOT/'src/furnitureDefaultVariants.json').read_text())
    variants=json.loads((ROOT/'src/furnitureVariants.json').read_text())
    hexcolor=variants.get(defaults.get(id,''))
    if not hexcolor:return None
    return _linear_hex(hexcolor)

def _material(old,key,family,records,id):
    mat=old.copy();mat.name=key;mat['authoring_owner']=OWNER;mat['sofa_material_key']=key
    kind=_kind(key)
    if kind=='other':
        if id=='chester-sofa' and key=='warm-brass':
            bs=mat.node_tree.nodes.get('Principled BSDF')
            for socket in ['Base Color','Metallic','Roughness']:
                for link in list(bs.inputs[socket].links):mat.node_tree.links.remove(link)
            color=(*[c*.70 for c in _variant_tint(id)],1)
            bs.inputs['Base Color'].default_value=color;mat.diffuse_color=color
            bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.90
        return mat
    mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bs=nodes.get('Principled BSDF') or nodes.new('ShaderNodeBsdfPrincipled')
    if kind=='seam':
        bs.inputs['Roughness'].default_value=.91
        seam_tint=_variant_tint(id)
        if seam_tint is None and id in FABRIC_DEFAULTS:
            seam_tint=_linear_hex(next(iter(FABRIC_DEFAULTS[id].values())))
        if seam_tint:
            color=(*[c*.72 for c in seam_tint],1)
            for link in list(bs.inputs['Base Color'].links):links.remove(link)
            bs.inputs['Base Color'].default_value=color;mat.diffuse_color=color
        for link in list(bs.inputs['Normal'].links):links.remove(link)
        return mat
    texture_family=family
    if kind=='wood':texture_family='walnut' if 'walnut' in key or 'dark' in key else 'teak' if family=='canvas' else 'oak'
    if texture_family not in records:raise KeyError('Missing texture family '+texture_family)
    record=records[texture_family]
    mat['sofa_pbr_family']=texture_family
    mat['sofa_repeat_m']=record.get('repeatM',TEXTURE_REPEAT.get(family,.32))
    # Existing factors/material names remain editable. Neutral maps multiply tint.
    tint=tuple(bs.inputs['Base Color'].default_value)
    if kind=='fabric' and 'upholstery-textured' in key and _variant_tint(id):
        tint=(*_variant_tint(id),1)
        bs.inputs['Base Color'].default_value=tint;mat.diffuse_color=tint
    elif kind=='fabric' and key in FABRIC_DEFAULTS.get(id,{}):
        tint=(*_linear_hex(FABRIC_DEFAULTS[id][key]),1)
        bs.inputs['Base Color'].default_value=tint;mat.diffuse_color=tint
    if kind=='wood':
        # Earlier modern builders painted even oak frames with the upholstery
        # colour. The photographed wood now supplies species colour itself;
        # unchanged material keys still accept any saved explicit recolour.
        tint=(.84,.84,.84,1)
        bs.inputs['Base Color'].default_value=tint;mat.diffuse_color=tint
    for input_name in ['Base Color','Normal','Roughness','Metallic']:
        for link in list(bs.inputs[input_name].links):links.remove(link)
    base=_map(mat,record['baseColor'],'Measured neutral '+texture_family)
    # Blender 5.2 glTF's get_multiply_factors recognizes the modern MIX node,
    # not legacy MixRGB. This preserves both the image and editable tint factor.
    mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    color_a=next(s for s in mix.inputs if s.identifier=='A_Color')
    color_b=next(s for s in mix.inputs if s.identifier=='B_Color')
    color_out=next(s for s in mix.outputs if s.identifier=='Result_Color')
    color_b.default_value=tint;links.new(base.outputs['Color'],color_a);links.new(color_out,bs.inputs['Base Color'])
    normal=_map(mat,record['normal'],'Fine pore normal',True)
    normalmap=nodes.new('ShaderNodeNormalMap');normalmap.inputs['Strength'].default_value=record.get('normalStrength',.42 if kind=='fabric' else .48)
    links.new(normal.outputs['Color'],normalmap.inputs['Color']);links.new(normalmap.outputs['Normal'],bs.inputs['Normal'])
    if 'orm' in record:
        rough=_map(mat,record['orm'],'PBR occlusion roughness metal',True);sep=nodes.new('ShaderNodeSeparateColor')
        links.new(rough.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness'])
        # Matching G/B from a single ORM permits direct JPEG reuse by glTF.
        # Constant metallic zero would otherwise force a large packed PNG bake.
        links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
    else:
        rough=_map(mat,record['roughness'],'Measured roughness',True);links.new(rough.outputs['Color'],bs.inputs['Roughness'])
    bs.inputs['Metallic'].default_value=0
    bs.inputs['IOR'].default_value=1.45
    if 'Sheen Weight' in bs.inputs:
        bs.inputs['Sheen Weight'].default_value=.13 if family=='velvet' and kind=='fabric' else .04 if kind=='fabric' else 0
        bs.inputs['Sheen Roughness'].default_value=.7
    return mat

def _uv(o,records,family):
    """Metre-scaled face mapping; longitudinal wood grain follows each board."""
    mesh=o.data
    if not mesh.uv_layers:mesh.uv_layers.new(name='UVMap')
    uv=mesh.uv_layers.active.data;mesh.update()
    points=[v.co for v in mesh.vertices];lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
    longest=max(range(3),key=lambda i:hi[i]-lo[i])
    phase=(int(hashlib.sha256(o.name.encode()).hexdigest()[:8],16)%997)/997
    for polygon in mesh.polygons:
        mat=mesh.materials[polygon.material_index];kind=_kind(mat.get('sofa_material_key',mat.name))
        if kind not in {'wood','fabric'}:continue
        dominant=max(range(3),key=lambda i:abs(polygon.normal[i]));axes=[i for i in range(3) if i!=dominant]
        if kind=='wood':
            # V runs along the board. Endgrain uses a separate cross-section.
            along=longest if longest!=dominant else axes[1]
            across=next(i for i in axes if i!=along)
            width,length=.34,1.8
            if 'rattan' in mat.name or 'cane' in mat.name:width,length=.08,1.0
            grain_axis=records[mat['sofa_pbr_family']].get('grainAxis','v')
            for li in polygon.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co
                cross_uv=(co[across]-lo[across])/width+phase
                long_uv=(co[along]-lo[along])/length+phase*.71
                uv[li].uv=(cross_uv,long_uv) if grain_axis=='v' else (long_uv,cross_uv)
        else:
            repeat=records[family].get('repeatM',TEXTURE_REPEAT[family])
            for li in polygon.loop_indices:
                co=mesh.vertices[mesh.loops[li].vertex_index].co
                uv[li].uv=(co[axes[0]]/repeat+phase,co[axes[1]]/repeat+phase*.37)

def _stitch_segments(name,segments,mat,radius=.00038):
    verts=[];faces=[]
    for a,b in segments:
        t=(b-a).normalized();axis=min([Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))],key=lambda v:abs(t.dot(v)))
        u=t.cross(axis).normalized();v=t.cross(u);start=len(verts)
        for p in [a,b]:
            verts.extend(p+radius*(u*math.cos(j*math.tau/4)+v*math.sin(j*math.tau/4)) for j in range(4))
        faces.extend((start+j,start+(j+1)%4,start+4+(j+1)%4,start+4+j) for j in range(4))
        faces.extend([(start+3,start+2,start+1,start),(start+4,start+5,start+6,start+7)])
    if not verts:return None
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(mat);me.update()
    obj=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(obj);obj['authoring_owner']=OWNER;obj['sofa_detail']='measured 4 mm saddle stitches'
    return obj

def _tailoring(parts,seam):
    """Surface-conforming 4 mm stitches; no floating box-outline seams."""
    segments=[];used=[]
    for o in parts:
        name=o.name.lower()
        if not any(word in name for word in ['seat','cushion','back pad','mattress']):continue
        if any(word in name for word in ['welt','stitch','seam','frame','deck','rail','pan','support','slat']):continue
        if not any(_kind(m.get('sofa_material_key',m.name))=='fabric' for m in o.data.materials):continue
        p=[v.co for v in o.data.vertices];lo=Vector([min(v[i] for v in p) for i in range(3)]);hi=Vector([max(v[i] for v in p) for i in range(3)]);size=hi-lo
        if size.x<.20 or max(size.y,size.z)<.20:continue
        # Horizontal seats use a small inset at their front upper edge; upright
        # backs use two vertical sides, with ray casts respecting angled faces.
        paths=[]
        if size.y>size.z*1.15:
            y=lo.y+min(.055,size.y*.13);paths=[(Vector((lo.x+.045,y,hi.z+.02)),Vector((hi.x-.045,y,hi.z+.02)),Vector((0,0,-1)))]
        else:
            for x in [lo.x+.035,hi.x-.035]:paths.append((Vector((x,lo.y-.02,lo.z+.035)),Vector((x,lo.y-.02,hi.z-.035)),Vector((0,1,0))))
        added=0
        for a,b,direction in paths:
            distance=(b-a).length
            if distance<.10:continue
            count=max(1,int(distance/.009));step=(b-a)/count
            for j in range(count):
                if len(segments)>=900:break
                origins=[a+step*(j+.20),a+step*(j+.65)];ends=[]
                for origin in origins:
                    hit,point,normal,_=o.ray_cast(origin,direction)
                    if not hit or abs(normal.dot(direction))<.40:break
                    ends.append(point+normal*.00062)
                if len(ends)==2 and (ends[1]-ends[0]).length<.007:
                    segments.append(tuple(ends));added+=1
        if added:used.append({'part':o.name,'stitches':added})
    obj=_stitch_segments('Tailoring - individual saddle stitches',segments,seam)
    return ([obj] if obj else []),used

def _conform_welts(parts):
    """Lift partly buried old piping onto its actual rounded cushion surface.

    Older box-based sources put a flat rounded path through a cushion bevel,
    producing broken lines at the corners. Project only nearby buried vertices;
    retain the authored seam path and material rather than drawing a new box.
    """
    fabric=[o for o in parts if any(_kind(m.get('sofa_material_key',m.name))=='fabric' for m in o.data.materials)
            and not any(w in o.name.lower() for w in SEAM_WORDS)]
    changed={}
    for o in parts:
        if not any(w in o.name.lower() for w in SEAM_WORDS):continue
        if not any(_kind(m.get('sofa_material_key',m.name))=='seam' for m in o.data.materials):continue
        count=0
        for vertex in o.data.vertices:
            nearest=None
            for target in fabric:
                hit,p,n,_=target.closest_point_on_mesh(vertex.co,distance=.045)
                if hit:
                    d=(vertex.co-p).length
                    if nearest is None or d<nearest[0]:nearest=(d,p,n)
            if nearest:
                d,p,n=nearest
                if (vertex.co-p).dot(n)<.00045:
                    vertex.co=p+n*.00045;count+=1
        if count:o.data.update();changed[o.name]=count
    return changed

def _canonicalize_export(path,materials):
    data=path.read_bytes();offset=12;chunks=[]
    while offset<len(data):
        length,kind=struct.unpack_from('<II',data,offset);chunks.append((kind,data[offset+8:offset+8+length]));offset+=length+8
    document=json.loads(chunks[0][1]);mapping={m.name:m.get('sofa_material_key',m.name) for m in materials}
    for material in document['materials']:
        material['name']=mapping.get(material['name'],material['name'])
    payload=json.dumps(document,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
    chunks[0]=(chunks[0][0],payload);body=b''.join(struct.pack('<II',len(payload),kind)+payload for kind,payload in chunks)
    path.write_bytes(struct.pack('<III',0x46546c67,2,len(body)+12)+body)
    return document

def build(id):
    if id not in IDS:raise ValueError('Not an audited sofa '+id)
    baseline=_baseline(id);records=_texture_records();family=baseline['textureFamily'];row=baseline['row'];s,parts=_load(id)
    expected=baseline['baseline']['materials'];copied={};material_keys=set()
    for o in parts:
        for i,old in enumerate(o.data.materials):
            key=_canonical(old.name,expected)
            if key not in expected:raise ValueError(f'Unmapped source material {id}: {old.name}')
            if key not in copied:copied[key]=_material(old,key,family,records,id)
            o.data.materials[i]=copied[key];material_keys.add(key)
    if material_keys!=set(expected):raise ValueError(f'Material key drift {id}: {material_keys ^ set(expected)}')
    points=[o.matrix_world@v.co for o in parts for v in o.data.vertices]
    lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
    target=Vector([v/1000 for v in row[3:6]])
    # Existing models sometimes store an unnormalized source. Apply exactly the
    # same millimetre envelope and no independent piece scaling afterward.
    scale=Vector([target[i]/(hi[i]-lo[i]) for i in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for o in parts:
        for v in o.data.vertices:v.co=Vector([(v.co[i]-center[i])*scale[i] for i in range(3)])
        o.data.update();_uv(o,records,family)
    bpy.context.view_layer.update()
    repaired_welts=_conform_welts(parts)
    seam=next((m for k,m in copied.items() if _kind(k)=='seam'),next(m for k,m in copied.items() if _kind(k)=='fabric'))
    additions,tailoring=_tailoring(parts,seam);parts+=additions
    for o in additions:o['catalog_id']=id
    # Keep small raised thread tips within the original mm envelope.
    for o in parts:
        for v in o.data.vertices:
            v.co.x=max(-target.x/2,min(target.x/2,v.co.x));v.co.y=max(-target.y/2,min(target.y/2,v.co.y));v.co.z=max(0,min(target.z,v.co.z))
    s['catalog_id']=id;s['nominal_dimensions_m']=list(target);s['authoring_owner']=OWNER
    s['construction']='Original editable sofa parts; measured PBR fibres/grain, UVs and surface-conforming tailoring'
    s.unit_settings.system='METRIC';s['sofa_texture_family']=family
    source=ROOT/'assets-source/blender'/f'{id}.blend'
    bpy.data.libraries.write(str(source),{s},fake_user=True,compress=True)
    triangles=sum(len(p.vertices)-2 for o in parts for p in o.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();bpy.context.object.name=id+' authored assembly'
    output=ROOT/'public/models/furniture'/f'{id}.glb'
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_yup=True,export_apply=True)
    gltf=_canonicalize_export(output,list(copied.values()))
    audit={'dimensionsMm':row[3:6],'textureFamily':family,'editableParts':len(parts),'triangles':triangles,'glbBytes':output.stat().st_size,'images':len(gltf.get('images',[])),
      'materialKeys':sorted(material_keys),'tailoring':tailoring,'repairedWeltVertices':repaired_welts,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'status':'exported; awaiting rendered front/rear/underside/close-up review'}
    result=json.loads(REPORT.read_text()) if REPORT.exists() else {};result[id]=audit;REPORT.write_text(json.dumps(result,indent=2)+'\n')
    G.setup_render(row);s.render.resolution_x=768;s.render.resolution_y=768
    return audit

def set_view(view='front'):
    G.OWNER=OWNER
    if view!='closeup':
        bpy.context.scene.camera.data.ortho_scale=max(bpy.context.scene['nominal_dimensions_m'])*1.58
        return G.set_view(view)
    s=bpy.context.scene;w,d,h=s['nominal_dimensions_m'];target=Vector((-w*.12,-d*.12,h*.54))
    s.camera.location=target+Vector((.65,-1.2,.72))*max(w,d,h)
    s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=min(w,d)*.74
    return {'view':'closeup','id':s['catalog_id']}
