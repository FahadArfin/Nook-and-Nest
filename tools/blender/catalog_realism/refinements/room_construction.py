"""Seven measured room-furniture corrections, isolated from the catalog recipe."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']


def box_mesh(lo,hi):
    v=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
    return outward(v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])


def combine(parts):
    v=[];f=[]
    for a,b in parts:
        offset=len(v);v.extend(a);f.extend(tuple(i+offset for i in face) for face in b)
    return v,f


def cubby(box,entry):
    lo,hi=box['min'],box['max'];thickness=.018
    cx=(entry['min'][0]+entry['max'][0])/2;cz=(entry['min'][2]+entry['max'][2])/2
    hx=(hi[0]-lo[0])/2;hz=(hi[2]-lo[2])/2
    # Retain the original black entry trim with a true hole behind its inner lip.
    rx=(entry['max'][0]-entry['min'][0])*.41;rz=(entry['max'][2]-entry['min'][2])*.445
    ox=(hi[0]+lo[0])/2;oz=(hi[2]+lo[2])/2;n=128;v=[];f=[]
    for y,inner in [(lo[1],False),(lo[1],True),(lo[1]+thickness,True),(lo[1]+thickness,False)]:
        for j in range(n):
            a=j*math.tau/n;c,s=math.cos(a),math.sin(a)
            if inner:x,z=cx+rx*c,cz+rz*s
            else:
                radius=min(hx/max(abs(c),1e-12),hz/max(abs(s),1e-12));x,z=ox+radius*c,oz+radius*s
            v.append((x,y,z))
    for k in range(4):
        for j in range(n):f.append((k*n+j,k*n+(j+1)%n,((k+1)%4)*n+(j+1)%n,((k+1)%4)*n+j))
    front=outward(v,f)
    return combine([front,
        box_mesh((lo[0],lo[1]+thickness,lo[2]),(hi[0],hi[1],lo[2]+thickness)),
        box_mesh((lo[0],lo[1]+thickness,hi[2]-thickness),hi),
        box_mesh((lo[0],lo[1]+thickness,lo[2]+thickness),(lo[0]+thickness,hi[1],hi[2]-thickness)),
        box_mesh((hi[0]-thickness,lo[1]+thickness,lo[2]+thickness),(hi[0],hi[1],hi[2]-thickness)),
        box_mesh((lo[0]+thickness,hi[1]-thickness,lo[2]+thickness),(hi[0]-thickness,hi[1],hi[2]-thickness))])


def globe(box):
    profile=[(math.sin(i*math.pi/32),(1-math.cos(i*math.pi/32))/2) for i in range(33)]
    profile[0]=(0,0);profile[-1]=(0,1)
    return _shell['lathe'](profile,box,64)


def rounded_loft(box,stations,radius=.025):
    lo,hi=box['min'],box['max'];cx=(lo[0]+hi[0])/2;cy=(lo[1]+hi[1])/2
    v=[];f=[];n=64
    for sx,sy,t in stations:
        hx=(hi[0]-lo[0])*sx/2;hy=(hi[1]-lo[1])*sy/2;r=min(radius,hx*.85,hy*.85)
        for q,(x,y) in enumerate([(cx+hx-r,cy+hy-r),(cx-hx+r,cy+hy-r),(cx-hx+r,cy-hy+r),(cx+hx-r,cy-hy+r)]):
            for j in range(16):
                angle=(q+j/15)*math.pi/2;v.append((x+r*math.cos(angle),y+r*math.sin(angle),lo[2]+t*(hi[2]-lo[2])))
    for k in range(len(stations)-1):
        for j in range(n):f.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    f.extend([tuple(reversed(range(n))),tuple((len(stations)-1)*n+j for j in range(n))])
    return outward(v,f)


def canopy(points):
    if len(points)!=34:raise ValueError('Measured paired canopy fans changed')
    center=points[0];n=128;rings=18;v=[];f=[]
    for side in (0,1):
        v.append((center[0],center[1],center[2]-.003*side))
        for ri in range(1,rings+1):
            radius=ri/rings
            for j in range(n):
                sector=j//16;t=(j%16)/16
                a=points[1+sector*2];b=points[2+sector*2];c=points[1+((sector+1)%8)*2]
                control=tuple(2*b[k]-(a[k]+c[k])/2 for k in range(3))
                edge=tuple((1-t)**2*a[k]+2*(1-t)*t*control[k]+t*t*c[k] for k in range(3))
                p=[center[k]+radius*(edge[k]-center[k]) for k in range(3)]
                p[2]-=.022*math.sin(math.pi*radius)**2*math.sin(math.pi*t)**2+.003*side
                v.append(tuple(p))
        offset=side*(1+rings*n)
        for j in range(n):f.append((offset,offset+1+j,offset+1+(j+1)%n))
        for ri in range(rings-1):
            start=offset+1+ri*n
            for j in range(n):f.append((start+j,start+n+j,start+n+(j+1)%n,start+(j+1)%n))
        if side:
            start_index=len(f)-(n+(rings-1)*n)
            f[start_index:]=[tuple(reversed(face)) for face in f[start_index:]]
    top=1+(rings-1)*n;bottom=1+rings*n+top
    for j in range(n):f.append((top+(j+1)%n,top+j,bottom+j,bottom+(j+1)%n))
    return outward(v,f)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Room source differs from measured recipe')
    objects=_curves['_objects'](scene,names);checked={};changes=[]
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion';trim=spec['name']=='seat_double_welt'
        checked[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(obj):return [tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    def replace(name,g,description,bevel=0):
        if sum(len(f)-2 for f in g[1])>14000:raise ValueError('Room component detail exceeds budget')
        obj=checked[name];change=_textile['_replace'](obj,g)
        if bevel:
            mod=obj.modifiers.new('Editable softened construction edges','BEVEL');mod.width=bevel;mod.segments=3
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**change,'preserved':['catalog footprint and material keys','unrelated parts and protected image/motion content']})
    if item['id'] in ('office-chair','ottoman'):
        g,details=_textile['_chair_welt'](checked['seat_double_welt'],checked['tailored_seat_cushion'])
        replace('seat_double_welt',g,'continuous seat welt follows the actual lofted cushion surface');changes[-1].update(details)
    elif item['id']=='opal-wall-sconce':
        name='opal_glass_globe';replace(name,globe(bounds(points(checked[name]))),'continuous smooth opal diffuser with dense circular sections and closed poles')
        for face in checked[name].data.polygons:face.use_smooth=True
    elif item['id']=='modern-cat-condo':
        name='enclosed_cat_cubby';replace(name,cubby(bounds(points(checked[name])),bounds(points(checked['cubby_entry']))),'hollow enclosed cubby with actual oval entrance, inner floor and closed rear',.0015)
        for face in checked[name].data.polygons:face.use_smooth=False
    elif item['id']=='nesting-tables':
        name='nest_table_leg_0.002';obj=checked[name];old=points(obj);small=bounds(points(checked['nest_table_top_1']))
        current=bounds(old);shift=small['min'][0]-.012-current['max'][0]
        if not -.22<shift<-.17:raise ValueError('Measured nesting collision changed')
        replace(name,([(x+shift,y,z) for x,y,z in old],[tuple(f.vertices) for f in obj.data.polygons]),'inboard staggered front leg clears the smaller tabletop by twelve millimetres')
        # A joined pin mesh contains independent eight-vertex brass markers.
        pin=checked['joinery_pin'];inverse=pin.matrix_world.inverted();moved=0
        for vertex in pin.data.vertices:
            p=pin.matrix_world@vertex.co
            if current['min'][0]-.01<p.x<current['max'][0]+.01 and current['min'][1]-.01<p.y<current['max'][1]+.01:
                p.x+=shift;vertex.co=inverse@p;moved+=1
        if moved==0:raise ValueError('No matching original leg pin found')
        changes[-1].update({'legShiftM':shift,'clearanceM':.012,'relocatedPinVertices':moved})
    elif item['id']=='one-piece-toilet':
        for name in ('Skirted pedestal','Rear ceramic support','Cistern mounting bridge','Cistern'):
            box=bounds(points(checked[name]))
            if name=='Skirted pedestal':
                # Clear the retained deep basin/water while seating its lower shell.
                box['max'][2]=bounds(points(checked['Rimless porcelain bowl']))['min'][2]+.0015
                stations=[(.94,.94,0),(1,1,.04),(1,1,.12),(.93,.98,.75),(.97,1,1)];radius=.06
            elif name=='Rear ceramic support':stations=[(.98,.98,0),(1,1,.04),(1,1,.9),(.97,.98,1)];radius=.04
            elif name=='Cistern mounting bridge':stations=[(.88,.92,0),(.97,.98,.18),(1,1,.65),(.97,.99,1)];radius=.035
            else:stations=[(.92,.95,0),(.98,.99,.05),(1,1,.2),(1,1,.94),(.98,.98,1)];radius=.025
            replace(name,rounded_loft(box,stations,radius),'smooth skirted ceramic sections retain bowl recess and connected cistern construction')
            for face in checked[name].data.polygons:face.use_smooth=len(face.vertices)==4
    elif item['id']=='outdoor-cantilever-parasol':
        name='scalloped octagonal canopy';replace(name,canopy(points(checked[name])),'eight tensioned curved cloth panels preserve all rib edge anchors and original scalloped outline')
    else:raise ValueError('Unsupported room refinement ID')
    bpy.context.view_layer.update()
    return changes
