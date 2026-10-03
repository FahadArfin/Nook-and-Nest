"""Exact reviewed sliding closet and two headphone cushion corrections."""
from pathlib import Path
import runpy

_curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))
_shell=runpy.run_path(str(Path(__file__).with_name('silhouette_geometry.py')))
bounds=_curves['bounds'];fit=_curves['fit']


def ear_pad(box,cup):
    left=box['max'][0]<0;depth=box['max'][0]-box['min'][0]
    backing=cup['max'][0]+.0006 if left else cup['min'][0]-.0006
    fraction=(backing-box['min'][0])/depth if left else (box['max'][0]-backing)/depth
    if not .5<fraction<.8:raise ValueError('Reviewed cup/pad overlap changed')
    profile=[(0,0),(.9,0),(.98,.08),(1,.23),(1,.7),(.97,.91),(.9,1),(.72,1),(.63,.91),(.6,.82),(.6,fraction),(0,fraction)]
    vertices,faces=_shell['lathe'](profile,{'min':[-1,-1,0],'max':[1,1,1]},96)
    vertices=fit([(z if left else 1-z,x,y) for x,y,z in vertices],box)
    vertices,faces=_curves['outward'](vertices,faces)
    return vertices,faces,{'backingClearanceM':.0006,'earCavityDepthM':depth*(1-fraction),'radialSegments':96}


def closet_parts():
    parts=[]
    def add(name,lo,hi,material,role,bevel=.001):
        parts.append({'name':name,'bounds':{'min':lo,'max':hi},'material':material,'role':role,'bevelM':bevel})
    wood='wood-honey-textured';metal='modern-brushed-aluminum';dark='modern-recess-charcoal'
    add('left full-height sliding leaf',[-.872,-.321,.13],[.016,-.305,2.24],wood,'leaf',.002)
    add('right full-height sliding leaf',[-.016,-.300,.13],[.872,-.288,2.24],wood,'leaf',.002)
    for name,z0,z1 in [('bottom track base',.111,.125),('top track base',2.242,2.255)]:
        add(name,[-.875,-.325,z0],[.875,-.284,z1],metal,'track')
    for n,(y0,y1) in enumerate([(-.323,-.321),(-.304,-.301),(-.287,-.284)]):
        add('bottom runner rib '+str(n),[-.875,y0,.124],[.875,y1,.138],metal,'track',.0005)
        add('top guide rib '+str(n),[-.875,y0,2.232],[.875,y1,2.244],metal,'track',.0005)
    # Short vertical flush pulls identify the two separate sliding leaves; their
    # projection also retains the measured original front envelope.
    add('left sliding finger pull',[-.022,-.325,.985],[-.010,-.320,1.365],dark,'pull',.002)
    add('right sliding finger pull',[.040,-.304,.985],[.052,-.299,1.365],dark,'pull',.002)
    return parts


def box_mesh(box):
    lo,hi=box['min'],box['max']
    vertices=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
    faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    return vertices,faces


def _new(scene,name,geometry,material,bevel):
    import bpy
    from mathutils import Matrix
    mesh=bpy.data.meshes.new('Reviewed '+name);obj=bpy.data.objects.new('detail_casework_'+name,mesh)
    mesh.materials.append(material);scene.collection.objects.link(obj);obj.matrix_world=Matrix.Identity(4)
    _curves['_replace'](obj,geometry,smooth_sides=False)
    if bevel:
        modifier=obj.modifiers.new('Reviewed bounded manufactured edge','BEVEL');modifier.width=bevel
        modifier.segments=3;modifier.limit_method='ANGLE';modifier.use_clamp_overlap=True;modifier.harden_normals=True
    return obj


def apply(root,scene,item,keys,names,specs,source_sha):
    import bpy
    if item['sourceBlend']['sha256']!=source_sha:raise ValueError('Reviewed720 source changed')
    objects=_curves['_objects'](scene,names);checked={}
    for spec in specs:checked[spec['name']]=_curves['_checked'](objects,spec,keys)[0]
    if item['id'] in ('sonos-ace','sonos-ace-ultra'):
        changes=[]
        for spec in specs:
            if not spec['name'].startswith('oval_memory_foam_ear_pad'):continue
            cup_name=spec['name'].replace('oval_memory_foam_ear_pad','oval_earcup')
            cup=next(s['bounds'] for s in specs if s['name']==cup_name)
            v,f,e=ear_pad(spec['bounds'],cup);obj=checked[spec['name']]
            evidence=_curves['_replace'](obj,(v,f),smooth_sides=False)
            for polygon in obj.data.polygons:
                x=[(obj.matrix_world@obj.data.vertices[i].co).x for i in polygon.vertices]
                polygon.use_smooth=max(x)-min(x)>1e-8
            changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                            'construction':'rounded annular memory-foam ear pad with a recessed dark center clear of the retained cup',
                            **evidence,**e,'preserved':['original per-pad bounds and material','unchanged cup and headband geometry']})
        if len(changes)!=2:raise ValueError('Both exact headphone pads are required')
        return changes
    if item['id']!='sliding-closet':raise ValueError('Unsupported reviewed720 item')
    removed=[];palette={}
    for obj in checked.values():
        for material in obj.data.materials:
            if material:palette[keys[material.name]]=material
    targets=[s for s in specs if s['name'].startswith(('separate_door_or_drawer_front','recessed_finger_pull','concealed_hinge'))]
    if len(targets)!=36:raise ValueError('Expected nine source fronts, nine pulls and eighteen hinges')
    parts=closet_parts();built=[]
    for part in parts:
        _new(scene,part['name'],box_mesh(part['bounds']),palette[part['material']],part['bevelM'])
        built.append({'component':part['name'],'materialKey':part['material'],'boundsM':part['bounds'],'role':part['role']})
    for spec in targets:
        bpy.data.objects.remove(checked[spec['name']],do_unlink=True);removed.append(spec['name'])
    return [{'kind':'source-evidenced-construction','component':'sliding closet front assembly',
             'construction':'two full-height overlapping closed sliding leaves in separate top and bottom runners',
             'replacedComponents':removed,'components':built,'leafOverlapM':.032,'leafDepthClearanceM':.005,
             'preserved':['original carcass, shelves, dividers, top and plinth','all original material keys and colors','overall2.3m closet height and1.8m width','static source behavior']}]
