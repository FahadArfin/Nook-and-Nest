"""Book construction from the three exact authored build_quality_models recipes.

The old rounded solid is replaced by covers, bound spine and recessed paper.
Object identities, existing materials and the measured group envelope survive.
No Blender process is launched here; only apply() imports its native API.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import runpy

RECIPES = {'bookshelf': ('book_', 24, 'upright'),
           'books-upright': ('upright_book_', 7, 'upright'),
           'books-stacked': ('stacked_book_', 5, 'stacked')}
PAPER_FACE_ATTRIBUTE = 'catalog_paper_faces'
PAPER_UV_DENSITY = 12.0


def face_uv(point, normal, paper=False):
    """Keep covers at authored density; shrink only the exposed paper fibers."""
    axes=[axis for axis in range(3) if axis!=max(range(3),key=lambda axis:abs(normal[axis]))]
    density=PAPER_UV_DENSITY if paper else 1.0
    return tuple(float(point[axis])*density for axis in axes)


def source_groups(model_id, rows):
    """Only the named, separately editable 96-vertex rounded source blocks."""
    if model_id not in RECIPES:
        return []
    prefix, count, orientation = RECIPES[model_id]
    by_name = {}
    for row in rows:
        if row['name'] in by_name:
            raise ValueError('Ambiguous authored component: '+row['name'])
        by_name[row['name']] = row
    bodies = [row for row in rows if re.fullmatch(re.escape(prefix)+r'\d+', row['name'])]
    if len(bodies) != count or any(prefix+str(i) not in by_name for i in range(count)):
        raise ValueError('Expected exactly the authored book body count')
    groups = []
    for index in range(count):
        group = {'body': by_name[prefix+str(index)], 'orientation': orientation, 'index': index}
        for role, name in [('label', 'upright_book_spine_'+str(index)), ('pages', 'stacked_pages_'+str(index))]:
            if (role=='label' and model_id=='books-upright') or (role=='pages' and model_id=='books-stacked'):
                if name not in by_name:
                    raise ValueError('Missing authored book '+role+': '+name)
                group[role] = by_name[name]
        for role in ('body', 'label', 'pages'):
            if role not in group:
                continue
            row=group[role]
            if row.get('motionRole') or row.get('sharedGeometry') or row.get('protected'):
                raise ValueError('Book source has protected motion/shared geometry')
            if row.get('vertices') != 96 or row.get('modifiers') or len(row.get('materials', [])) != 1:
                raise ValueError('Authored book topology or material ownership changed: '+row['name'])
        groups.append(group)
    return groups


def _rounded_profile(v0, v1, w0, w1, radius):
    result=[]
    for v,w,start in [(v1-radius,w1-radius,0),(v0+radius,w1-radius,math.pi/2),
                      (v0+radius,w0+radius,math.pi),(v1-radius,w0+radius,math.pi*1.5)]:
        for step in range(4):
            angle=start+step*math.pi/6
            result.append((v+radius*math.cos(angle),w+radius*math.sin(angle)))
    return result


def _rings(rings):
    count=len(rings[0]);vertices=[point for ring in rings for point in ring]
    faces=[(level*count+i,level*count+(i+1)%count,(level+1)*count+(i+1)%count,(level+1)*count+i)
           for level in range(len(rings)-1) for i in range(count)]
    faces.extend([tuple(reversed(range(count))),tuple(range((len(rings)-1)*count,len(rings)*count))])
    return vertices,faces


def _board(u0,u1,v0,v1,w0,w1):
    ease=min((u1-u0)/3,.00035);radius=min(.0014,(v1-v0)/12,(w1-w0)/12)
    rings=[]
    for u,inset in [(u0,ease),(u0+ease,0),(u1-ease,0),(u1,ease)]:
        rings.append([(u,v,w) for v,w in _rounded_profile(v0+inset,v1-inset,w0+inset,w1-inset,max(.0001,radius-inset))])
    return _rings(rings)


def _prism(profile,w0,w1):
    vertices=[(u,v,w) for w in (w0,w1) for u,v in profile];count=len(profile)
    faces=[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    faces.extend([tuple(reversed(range(count))),tuple(range(count,2*count))])
    return vertices,faces


def book_geometry(bounds,orientation,cover_key,paper_key='linen-textured'):
    """Closed local meshes; upright thickness=X and stacked thickness=Z."""
    if orientation not in ('upright','stacked'):
        raise ValueError('Unknown authored book orientation')
    axes=(0,1,2) if orientation=='upright' else (2,1,0)
    lo=[float(bounds['min'][i]) for i in axes];hi=[float(bounds['max'][i]) for i in axes]
    size=[hi[i]-lo[i] for i in range(3)]
    if not all(math.isfinite(v) for v in lo+hi) or not .018<=size[0]<=.13 or min(size[1:])<.07:
        raise ValueError('Measured source is not a bounded book-sized volume')
    u0,v0,w0=lo;u1,v1,w1=hi;thickness,depth,height=size
    cover=min(.0022,max(.0012,thickness*.045));overhang=min(.0024,height*.012)
    parts=[]
    def add(role,geometry,key):
        vertices,faces=geometry
        if orientation=='stacked':
            vertices=[(w,v,u) for u,v,w in vertices]
            faces=[tuple(reversed(face)) for face in faces]
        parts.append({'role':role,'materialKey':key,'vertices':vertices,'faces':faces,
                      'paperFaces':role=='page-block'})
    add('cover-board',_board(u0,u0+cover,v0,v1,w0,w1),cover_key)
    add('cover-board',_board(u1-cover,u1,v0,v1,w0,w1),cover_key)
    # A gently rounded spine remains separate from the flat covers and paper.
    front=[]
    for step in range(13):
        t=step/12;front.append((u0+cover*.7+(thickness-cover*1.4)*t,v0+.00035+.0025*(2*t-1)**2))
    profile=front+[(front[-1][0],v0+.008),(front[0][0],v0+.008)]
    add('rounded-spine',_prism(profile,w0+.0005,w1-.0005),cover_key)
    # The subtly stepped page edge is real geometry, with 20 paper signatures.
    rings=[]
    for step in range(41):
        u=u0+cover+.00035+(thickness-2*cover-.0007)*step/40
        relief=.00010 if step%2 else 0
        vf,ve=v0+.0075,v1-overhang-relief
        wb,wt=w0+overhang+relief,w1-overhang-relief
        rings.append([(u,vf,wb),(u,ve,wb),(u,ve,wt),(u,vf,wt)])
    add('page-block',_rings(rings),paper_key)
    # Fine head/tail rules and a small cream title panel break the old pill shape.
    for fraction in (.13,.87):
        middle=w0+height*fraction
        band=[(u0+thickness*.12,v0+.00015),(u1-thickness*.12,v0+.00015),
              (u1-thickness*.12,v0+.0031),(u0+thickness*.12,v0+.0031)]
        add('spine-rule',_prism(band,middle-.0005,middle+.0005),paper_key)
    panel=[(u0+thickness*.25,v0+.0001),(u1-thickness*.25,v0+.0001),
           (u1-thickness*.25,v0+.002),(u0+thickness*.25,v0+.002)]
    add('spine-label',_prism(panel,w0+height*.66,w0+height*.715),paper_key)
    return parts


def _summary(snapshots,geometry):
    return {'sha256':hashlib.sha256(json.dumps([s['sha256'] for s in snapshots]).encode()).hexdigest(),
            'vertices':sum(s['vertices'] for s in snapshots),'triangles':sum(s['triangles'] for s in snapshots),
            'bounds':geometry['point_bounds']([s['bounds'][side] for s in snapshots for side in ('min','max')])}


def apply(root,scene,item,keys,names):
    """Replace only proven book bodies, retaining named labels/pages as objects."""
    if item['id'] not in RECIPES:
        return []
    import bpy
    from mathutils import Vector
    geometry=runpy.run_path(str(Path(root)/'tools/blender/catalog_realism/geometry.py'))
    objects={names.get(obj.name,obj.name):obj for obj in scene.objects if obj.type=='MESH'}
    rows=[];available={}
    for name,obj in objects.items():
        material_names=[keys[material.name] for material in obj.data.materials if material]
        for material in obj.data.materials:
            if material:available.setdefault(keys[material.name],material)
        rows.append({'name':name,'vertices':len(obj.data.vertices),'materials':material_names,
                     'modifiers':list(obj.modifiers),'motionRole':obj.get('motion_role'),
                     'sharedGeometry':obj.get('shared_geometry'),'protected':geometry['_protected'](obj)})
    groups=source_groups(item['id'],rows)
    if 'linen-textured' not in available:
        raise ValueError('Authored book paper palette is missing')
    original_bounds=geometry['_scene_bounds'](scene)
    swaps=[];changes=[]
    try:
        for group in groups:
            components={role:objects[group[role]['name']] for role in ('body','label','pages') if role in group}
            body=components['body']
            if body.get('catalog_realism_book_construction'):
                raise ValueError('Book construction recipe was already applied')
            before=_summary([geometry['_snapshot'](obj) for obj in components.values()],geometry)
            local=geometry['point_bounds']([tuple(vertex.co) for vertex in body.data.vertices])
            parts=book_geometry(local,group['orientation'],group['body']['materials'][0])
            world=[tuple(body.matrix_world@Vector(point)) for part in parts for point in part['vertices']]
            fitted=geometry['fit_points_to_bounds'](world,before['bounds']);cursor=0
            assigned={role:[] for role in components}
            for part in parts:
                count=len(part['vertices']);part['world']=fitted[cursor:cursor+count];cursor+=count
                role='pages' if part['role']=='page-block' and 'pages' in components else 'label' if part['role']=='spine-label' and 'label' in components else 'body'
                assigned[role].append(part)
            for role,obj in components.items():
                old=obj.data;mesh=bpy.data.meshes.new('book_construction_'+item['id']+'_'+str(group['index'])+'_'+role)
                swaps.append((obj,old,mesh));inverse=obj.matrix_world.inverted();vertices=[];faces=[];materials=[];smooth=[];paper_faces=[]
                slots=[material for material in old.materials if material]
                for part in assigned[role]:
                    material=available[part['materialKey']]
                    if material not in slots:slots.append(material)
                    index=slots.index(material);offset=len(vertices)
                    vertices.extend(tuple(inverse@Vector(point)) for point in part['world'])
                    faces.extend(tuple(offset+v for v in face) for face in part['faces'])
                    materials.extend([index]*len(part['faces']))
                    smooth.extend(part['role']=='rounded-spine' and i<len(part['faces'])-2 for i in range(len(part['faces'])))
                    paper_faces.extend([part['paperFaces']]*len(part['faces']))
                mesh.from_pydata(vertices,[],faces)
                for material in slots:mesh.materials.append(material)
                mesh.update();uv=mesh.uv_layers.new(name='UVMap')
                paper_attribute=mesh.attributes.new(name=PAPER_FACE_ATTRIBUTE,type='BOOLEAN',domain='FACE')
                for polygon in mesh.polygons:
                    polygon.material_index=materials[polygon.index];polygon.use_smooth=smooth[polygon.index]
                    paper=paper_faces[polygon.index];paper_attribute.data[polygon.index].value=paper
                    for loop in polygon.loop_indices:
                        point=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=face_uv(point,polygon.normal,paper)
                uv.active_render=True;mesh.uv_layers.active=uv;obj.data=mesh
            bpy.context.view_layer.update()
            after=_summary([geometry['_snapshot'](obj) for obj in components.values()],geometry)
            evidence=geometry['change_evidence'](before,after)
            if not evidence or evidence['maxBoundsDriftM']>geometry['TOLERANCE'] or after['triangles']>800:
                raise ValueError('Book construction failed its geometry/envelope budget')
            changes.append({'kind':'named-book-construction','components':[names.get(obj.name,obj.name) for obj in components.values()],
                            'sourceEvidence':'build_quality_models.py exact '+RECIPES[item['id']][0]+' source recipe, 96-vertex rounded blocks',
                            'construction':['two thin chamfered cover boards','curved bound spine','recessed paper block with 20 edge signatures','head/tail rules and title panel'],
                            'paperSurface':{'faceAttribute':PAPER_FACE_ATTRIBUTE,'uvDensity':PAPER_UV_DENSITY,'scope':'page-block polygons only'},
                            'materialKeys':sorted({part['materialKey'] for part in parts}),**evidence})
        if geometry['bounds_delta'](original_bounds,geometry['_scene_bounds'](scene))>geometry['TOLERANCE']:
            raise ValueError('Book construction moved the complete catalog envelope')
        for group in groups:objects[group['body']['name']]['catalog_realism_book_construction']='covers-spine-pages-v1'
        return changes
    except Exception:
        for obj,old,mesh in reversed(swaps):
            obj.data=old
            if mesh.users==0:bpy.data.meshes.remove(mesh)
        bpy.context.view_layer.update()
        raise
