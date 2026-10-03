"""Real acoustic tunnel for the measured Sub Mini catalog study.

Construction reference: https://www.sonos.com/en-us/shop/sub-mini
Original catalog dimensions, independent colors and existing controls retained.
"""
import math,runpy
from pathlib import Path
_dir=Path(__file__).parent
_c=runpy.run_path(str(_dir/'curved_construction.py'))
_r=runpy.run_path(str(_dir/'round_appliances.py'))


def outline(hx,hz,cz,radius,n=16):
    points=[]
    for q,(x,z) in enumerate([(hx-radius,hz-radius),(-hx+radius,hz-radius),(-hx+radius,-hz+radius),(hx-radius,-hz+radius)]):
        for j in range(n):
            a=(q+j/n)*math.pi/2;points.append((x+radius*math.cos(a),cz+z+radius*math.sin(a)))
    return points


def extrusion(path,front,rear):
    n=len(path);v=[(x,y,z) for y in (front,rear) for x,z in path]
    f=[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    f.extend([tuple(reversed(range(n))),tuple(range(n,2*n))])
    return _c['outward'](v,f)


def lining(box):
    lo,hi=box['min'],box['max'];hx=(hi[0]-lo[0])/2;hz=(hi[2]-lo[2])/2;cz=(hi[2]+lo[2])/2
    outer=outline(hx,hz,cz,.026);inner=outline(hx-.002,hz-.002,cz,.024);n=len(outer)
    v=[(x,y,z) for path,y in [(outer,lo[1]),(inner,lo[1]),(inner,.108),(outer,.108)] for x,z in path]
    f=[(k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j) for k in range(4) for j in range(n)]
    return _c['outward'](v,f),inner


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['id']!='sonos-sub-mini' or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Wrong measured subwoofer source')
    objects=_c['_objects'](scene,names);specs={s['name']:s for s in evidence['objects']};checked={};points={}
    for spec in evidence['objects']:checked[spec['name']],points[spec['name']]=_c['_checked'](objects,spec,keys)
    name='cylindrical_subwoofer';body=checked[name];profile=_r['recover_profile'](points[name],2,32)
    change=_r['_replace'](body,_r['turned'](profile,specs[name]['bounds'],128,2),2)
    tunnel,inner=lining(specs['recessed_acoustic_tunnel']['bounds'])
    cutmesh=bpy.data.meshes.new('Editable acoustic tunnel cutter mesh');v,f=extrusion(inner,-.15,.15);cutmesh.from_pydata(v,[],f);cutmesh.update()
    cutter=bpy.data.objects.new('Editable acoustic tunnel cutter',cutmesh);scene.collection.objects.link(cutter);cutter.hide_render=True;cutter.display_type='WIRE'
    boolean=body.modifiers.new('Editable recessed through tunnel','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter
    bevel=body.modifiers.new('Soft acoustic opening edge','BEVEL');bevel.width=.0006;bevel.segments=2
    # Evaluate a ray through the entire channel before saving/exporting.
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps)
    cx=0;cz=(specs['recessed_acoustic_tunnel']['bounds']['min'][2]+specs['recessed_acoustic_tunnel']['bounds']['max'][2])/2
    origin=body.matrix_world.inverted()@Vector((cx,-.16,cz));direction=(body.matrix_world.to_3x3().inverted()@Vector((0,1,0))).normalized()
    if evaluated.ray_cast(origin,direction,distance=.32)[0]:raise ValueError('Acoustic opening is still filled by the case')
    changes=[{'kind':'source-evidenced-construction','component':name,'construction':'smooth cylindrical case with editable Boolean through aperture and softened opening rim',**change}]
    changes.append({'kind':'source-evidenced-construction','component':'recessed_acoustic_tunnel','construction':'closed annular tunnel lining with actual open front and rear',**_c['_replace'](checked['recessed_acoustic_tunnel'],tunnel)})
    for name in checked:
        if name=='recessed_io_panel' or name.startswith('connector_port'):
            obj=checked[name];inverse=obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                p=obj.matrix_world@vertex.co;p.z-=.036;vertex.co=inverse@p
            changes.append({'kind':'source-evidenced-contact','component':name,'construction':'original connector panel moved below the acoustic channel','translationM':[0,0,-.036]})
    return changes
