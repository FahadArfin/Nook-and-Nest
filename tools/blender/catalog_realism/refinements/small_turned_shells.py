"""Measured closed ceramic, pencil, shade and static glass shell refinements."""
import math
from pathlib import Path
import runpy


def profile(kind):
    if kind=='cup':
        return [(0,0),(.95,0),(1,.025),(1,.975),(.995,.995),(.98,1),(.91,1),(.90,.98),(.90,.035),(0,.035)]
    if kind=='plate':
        return [(0,.08),(.65,.08),(.75,.11),(.95,.38),(1,.60),(1,.83),(.99,.95),(.975,1),(.95,.95),(.75,.45),(.65,.35),(0,.35)]
    if kind=='nixie':
        outer=[(math.cos(i*math.pi/16),.83+.17*math.sin(i*math.pi/16)) for i in range(9)]
        inner=[(.94*math.cos(i*math.pi/16),.83+.16*math.sin(i*math.pi/16)) for i in range(8,-1,-1)]
        return [(0,0),(.97,0),(1,.04)]+outer+inner+[(.94,.035),(0,.035)]
    raise ValueError('Unknown closed shell profile')


def pencil_profile(height):
    if not .12<height<.20:raise ValueError('Expected inspected pencil size')
    body=1-.012/height;lead=1-.0018/height
    return [(0,0),(1,0),(1,body),(.15,lead),(0,1)],body,lead


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Source differs from inspected turned components')
    helper=runpy.run_path(str(Path(__file__).with_name('silhouette_geometry.py')))
    objects={names.get(o.name):o for o in scene.objects if o.type=='MESH'}
    for spec in evidence['objects']:
        o=objects.get(spec['name'])
        if o is None or len(o.data.vertices)!=spec['vertices'] or o.data.shape_keys or o.get('motion_role') or o.get('shared_geometry'):raise ValueError('Static shell changed: '+spec['name'])
        if [keys[m.name] if m else None for m in o.data.materials]!=spec['materials']:raise ValueError('Material mapping changed: '+spec['name'])
        box=helper['bounds']([tuple(o.matrix_world@v.co) for v in o.data.vertices])
        if any(abs(box[k][a]-spec['bounds'][k][a])>2e-6 for k in ('min','max') for a in range(3)):raise ValueError('Measured bounds changed: '+spec['name'])
    materials={keys[m.name]:m for o in scene.objects if o.type=='MESH' for m in o.data.materials if m}
    changes=[]
    def box_for(name):return helper['bounds']([tuple(objects[name].matrix_world@v.co) for v in objects[name].data.vertices])
    def replace(name,geometry,description,axis=2,pencil=None):
        o=objects[name];vertices,faces=geometry;old=len(o.data.vertices);inverse=o.matrix_world.inverted()
        if sum(len(f)-2 for f in faces)>6000:raise ValueError('Small shell exceeds budget')
        mesh=bpy.data.meshes.new(name+' refined shell');mesh.from_pydata([inverse@Vector(v) for v in vertices],[],faces)
        for material in o.data.materials:mesh.materials.append(material)
        if pencil:mesh.materials.append(materials['wood-honey-textured'])
        mesh.update()
        for face in mesh.polygons:
            positions=[vertices[i][axis] for i in face.vertices]
            face.use_smooth=not pencil and max(positions)-min(positions)>1e-9
            if pencil:
                midpoint=sum(positions)/len(positions)
                face.material_index=int(pencil[0]<midpoint<pencil[1])
        o.data=mesh
        for modifier in list(o.modifiers):o.modifiers.remove(modifier)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,'sourceVertices':old,'candidateVertices':len(vertices),'candidateTriangles':sum(len(f)-2 for f in faces),'preserved':['catalog envelope and material keys','unrelated source parts and protected motion']})
    if item['id']=='desk-organizer':
        name='pen_cup';replace(name,helper['lathe'](profile('cup'),box_for(name),64),'closed ceramic cup with smooth rolled lip, inner wall and floor')
        for i in range(5):
            name='pencil'+(f'.{i:03d}' if i else '');box=box_for(name)
            box['max'][2]-=[0,.002,.004,.001,.003][i]
            height=box['max'][2]-box['min'][2];shape,body,lead=pencil_profile(height)
            replace(name,helper['lathe'](shape,box,6),'hexagonal colored pencil with exposed wood taper and colored lead',pencil=(box['min'][2]+body*height,box['min'][2]+lead*height))
    elif item['id']=='dish-rack':
        for i in range(4):
            name='stacked_plate'+(f'.{i:03d}' if i else '');box=box_for(name)
            vertices,faces=helper['lathe'](profile('plate'),{'min':[-1,-1,0],'max':[1,1,1]},96)
            vertices=helper['fit']([(z,x,y) for x,y,z in vertices],box)
            replace(name,(vertices,faces),'smooth upright plate with rolled rim, shallow recessed face and closed back',axis=0)
    elif item['id']=='divergence-clock':
        for i in range(8):
            name='Individual glass nixie envelope'+(f'.{i:03d}' if i else '')
            replace(name,helper['lathe'](profile('nixie'),box_for(name),48),'rounded thin-wall static glass envelope; time display and cathodes retained exactly')
    elif item['id']=='dome-pendant':
        name='open_dome_shade'
        contour=[(math.cos(i*math.pi/48),math.sin(i*math.pi/48)) for i in range(25)]
        contour += [(.97*math.cos(i*math.pi/48),.025+.95*math.sin(i*math.pi/48)) for i in range(24,-1,-1)]
        replace(name,helper['lathe'](contour,box_for(name),48),'smooth hollow turned dome; original diffuser and hem retained')
        name='pendant_cord';o=objects[name];vertices=[tuple(o.matrix_world@v.co) for v in o.data.vertices]
        box=box_for(name);box['min'][2]-=.006
        replace(name,(helper['fit'](vertices,box),[tuple(f.vertices) for f in o.data.polygons]),'cord seated six millimetres into the shade crown; ceiling endpoint unchanged')
    else:raise ValueError('Unsupported exact turned-shell recipe')
    bpy.context.view_layer.update()
    return changes
