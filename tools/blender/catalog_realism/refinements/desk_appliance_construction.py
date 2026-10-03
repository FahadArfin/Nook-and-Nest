"""Six exact-source corrections found in exported catalog review."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_design=runpy.run_path(str(_dir/'designed_construction.py'))
_turn=runpy.run_path(str(_dir/'round_appliances.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
_utility=runpy.run_path(str(_dir/'utility_construction.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']


def centers(points,sides,count):
    if len(points)!=sides*count:raise ValueError('Inspected sweep topology changed')
    return [tuple(sum(p[a] for p in points[j:j+sides])/sides for a in range(3)) for j in range(0,len(points),sides)]


def headset_pad(box):
    # Closed backing plus a deeply recessed oval cavity inside a rounded pad.
    # The retained wooden cup reaches27.1% into the original pad envelope.
    # Seat the dark backing at32%, in front of that wood, retaining15mm depth.
    profile=[(0,0),(.89,0),(.98,.08),(1,.22),(1,.68),(.97,.91),(.9,1),(.7,1),(.62,.91),(.6,.75),(.6,.32),(0,.32)]
    vertices,faces=_shell['lathe'](profile,{'min':[-1,-1,0],'max':[1,1,1]},96)
    left=(box['min'][0]+box['max'][0])<0
    vertices=[(z if left else 1-z,x,y) for x,y,z in vertices]
    return outward(fit(vertices,box),faces)


def smooth_stand(points):
    path=centers(points,12,4)
    path=_design['rounded_path'](path,cut=.035,spacing=.004)
    vertices,faces=_design['sweep'](path,.01125,(1,0,0),sides=32)
    return outward(fit(vertices,bounds(points)),faces)


def blender_handle(points):
    path=centers(points,10,4)
    path=_design['rounded_path'](path,cut=.017,spacing=.004)
    vertices,faces=_utility['tube'](path,.009,24)
    return outward(fit(vertices,bounds(points)),faces)


def trap(points):
    path=centers(points,12,7)
    a,b=path[0],path[-1];left,right=path[0][1],path[4][1]
    bottom=path[2][2];r=(right-left)/2;z=bottom+r
    if not .04<r<.06 or abs(a[0])>1e-5:raise ValueError('Original trap proportions changed')
    path=[a,(0,left,z)]
    path += [(0,(left+right)/2-r*math.cos(i*math.pi/48),z-r*math.sin(i*math.pi/48)) for i in range(1,49)]
    elbow=.024;start=b[2]-elbow
    if start<z:raise ValueError('Insufficient trap return height')
    path += [(0,right,start)]
    path += [(0,right+elbow*(1-math.cos(i*math.pi/48)),start+elbow*math.sin(i*math.pi/48)) for i in range(1,25)]
    path += [b]
    vertices,faces=_design['sweep'](path,.022,(1,0,0),sides=32)
    return outward(fit(vertices,bounds(points)),faces)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Source file differs from inspected desk/appliance recipe')
    objects=_curves['_objects'](scene,names);checked={};changes=[]
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion';trim=spec['name']=='seat_double_welt'
        checked[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(obj):return [tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    def replace(name,geometry,description,axis=None):
        if sum(len(f)-2 for f in geometry[1])>10000:raise ValueError('Component exceeded bounded detail budget')
        obj=checked[name];change=_textile['_replace'](obj,geometry)
        if axis is not None:
            for face in obj.data.polygons:
                coords=[(obj.matrix_world@obj.data.vertices[i].co)[axis] for i in face.vertices]
                face.use_smooth=max(coords)-min(coords)>1e-8
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**change,
                        'preserved':['catalog bounds and material keys','unrelated source parts and protected image/motion content']})
    if item['id']=='hm-embody-chair':
        geometry,details=_textile['_chair_welt'](checked['seat_double_welt'],checked['tailored_seat_cushion'])
        replace('seat_double_welt',geometry,'continuous round welt seated on the actual lofted cushion');changes[-1].update(details)
    elif item['id']=='high-performance-blender':
        name='Generous vessel handle';replace(name,blender_handle(points(checked[name])),'rounded molded handle corners with stable full-thickness sections')
    elif item['id']=='hifiman-manta':
        for name in ('Oval velour pad','Oval velour pad.001'):
            box=bounds(points(checked[name]));cup_name=name.replace('Oval velour pad','Oval wooden earcup');cup=bounds(points(checked[cup_name]))
            depth=(box['max'][0]-box['min'][0]);left=box['max'][0]<0
            backing=box['min'][0]+.32*depth if left else box['max'][0]-.32*depth
            clearance=backing-cup['max'][0] if left else cup['min'][0]-backing
            if not .0005<clearance<.002:raise ValueError('Ear cavity backing must sit in front of the retained wooden cup')
            replace(name,headset_pad(box),'rounded oval ear cushion with recessed cavity and closed dark backing clear of the retained cup',axis=0)
            changes[-1].update({'backingClearanceM':clearance,'earCavityDepthM':depth*.68})
        name='Swept stand';replace(name,smooth_stand(points(checked[name])),'smooth stable stand sweep retains original base and saddle attachment envelopes')
    elif item['id']=='garage-utility-sink':
        name='Exposed P-trap return';replace(name,trap(points(checked[name])),'continuous round U-bend and return elbow retain original pipe endpoints')
        # Close the measured five-millimetre tailpiece/drain gap with a separate
        # editable compression collar, using the original white polymer.
        material=checked['Drain tailpiece'].data.materials[0]
        pipe=bounds(points(checked['Drain tailpiece']));drain=bounds(points(checked['Recessed bowl drain']))
        gap=drain['min'][2]-pipe['max'][2]
        if not .004<gap<.006:raise ValueError('Inspected drain coupling gap changed')
        cx,cy=[(pipe['min'][a]+pipe['max'][a])/2 for a in (0,1)]
        box={'min':[cx-.024,cy-.024,pipe['max'][2]-.008],'max':[cx+.024,cy+.024,drain['min'][2]+.001]}
        geometry=_shell['lathe']([(.96,0),(1,.12),(1,.88),(.96,1),(.76,1),(.76,0)],box,48)
        mesh=bpy.data.meshes.new('Drain compression collar');mesh.from_pydata(geometry[0],[],geometry[1]);mesh.materials.append(material);mesh.update()
        for face in mesh.polygons:face.use_smooth=True
        obj=bpy.data.objects.new('Reviewed utility sink drain collar',mesh);scene.collection.objects.link(obj)
        changes.append({'kind':'source-evidenced-construction','component':'Reviewed utility sink drain collar','construction':'closed annular coupling bridges the measured tailpiece/drain gap','originalGapM':gap,'candidateVertices':len(geometry[0])})
    elif item['id'] in ('glass-air-fryer','glass-disc-side-table'):
        for name,obj in checked.items():
            box=bounds(points(obj));profile=_turn['recover_profile'](points(obj),2,32)
            if name=='sculpted_center_pedestal':box,contact=_turn['contact_target'](box,bounds(points(checked['shaped_slab_top'])))
            replace(name,_turn['turned'](profile,box,128),'smooth measured turned stations retain original edge profiles',axis=2)
            if name=='sculpted_center_pedestal':changes[-1].update(contact)
    else:raise ValueError('Unsupported exact desk/appliance recipe')
    bpy.context.view_layer.update()
    return changes
