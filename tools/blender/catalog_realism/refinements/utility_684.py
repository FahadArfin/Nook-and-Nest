"""Five measured cavity/contact repairs from the 684-719 visual review."""
import math,runpy
from pathlib import Path
_dir=Path(__file__).parent
_c=runpy.run_path(str(_dir/'curved_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_turn=runpy.run_path(str(_dir/'round_appliances.py'))
_room=runpy.run_path(str(_dir/'room_construction.py'))
_laundry=runpy.run_path(str(_dir/'laundry_construction.py'))
_design=runpy.run_path(str(_dir/'designed_construction.py'))
bounds=_c['bounds'];outward=_c['outward'];fit=_c['fit']
box_mesh=_room['box_mesh'];combine=_room['combine']


def secretary_case(box):
    lo,hi=box['min'],box['max'];t=.03;floor=.79
    # Original lower drawer case stays solid; the writing compartment is open.
    return combine([
        box_mesh(lo,(hi[0],hi[1],floor)),
        box_mesh((lo[0],lo[1],floor),(lo[0]+t,hi[1],hi[2])),
        box_mesh((hi[0]-t,lo[1],floor),hi),
        box_mesh((lo[0]+t,hi[1]-.025,floor),(hi[0]-t,hi[1],hi[2]-t)),
        box_mesh((lo[0]+t,lo[1],hi[2]-t),(hi[0]-t,hi[1],hi[2])),
        box_mesh((-.01,.06,1.00),(.01,hi[1]-.02,hi[2]-.025))])


def cylinder(box,axis=2,segments=64):
    return _turn['turned']([(0,0),(.96,0),(1,.05),(1,.95),(.96,1),(0,1)],box,segments,axis)


def label_y(x,body,depth):
    cx=(body['min'][0]+body['max'][0])/2;cy=(body['min'][1]+body['max'][1])/2
    rx=(body['max'][0]-body['min'][0])/2;ry=(body['max'][1]-body['min'][1])/2
    if abs((x-cx)/rx)>=.99:raise ValueError('Label exceeds original cylinder face')
    return cy-ry*math.sqrt(1-((x-cx)/rx)**2)-depth


def wrapped_label(box,body):
    lo,hi=box['min'],box['max'];n=64;v=[];f=[]
    for depth in (.00018,.0014):
        for z in (lo[2],hi[2]):
            for i in range(n+1):
                x=lo[0]+(hi[0]-lo[0])*i/n;v.append((x,label_y(x,body,depth),z))
    row=n+1;side=2*row
    for i in range(n):
        f.extend([(i,i+1,row+i+1,row+i),(side+i,side+row+i,side+row+i+1,side+i+1),
                  (i,side+i,side+i+1,i+1),(row+i,row+i+1,side+row+i+1,side+row+i)])
    f.extend([(0,row,side+row,side),(n,side+n,side+row+n,row+n)])
    return outward(v,f)


def curved_hose(points):
    if len(points)!=50:raise ValueError('Expected five measured ten-sided hose sections')
    centers=[tuple(sum(p[a] for p in points[i:i+10])/10 for a in range(3)) for i in range(0,50,10)]
    radius=sum(math.dist(p,centers[0]) for p in points[:10])/10
    path=_design['rounded_path'](centers,.009,12)
    v,f=_laundry['tube'](path,radius,16)
    return outward(fit(v,bounds(points)),f)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed utility source changed')
    objects=_c['_objects'](scene,names);checked={};changes=[];specs={s['name']:s for s in evidence['objects']}
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion';trim=spec['name']=='seat_double_welt'
        checked[spec['name']]=_c['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(name):return [tuple(checked[name].matrix_world@v.co) for v in checked[name].data.vertices]
    def geom(name):return points(name),[tuple(f.vertices) for f in checked[name].data.polygons]
    def replace(name,g,description,bevel=0,smooth=False):
        obj=checked[name];detail=_textile['_replace'](obj,g,smooth)
        if bevel:
            m=obj.modifiers.new('Editable joinery edge easing','BEVEL');m.width=bevel;m.segments=3
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**detail})
    ident=item['id']
    if ident=='shell-lounge-chair':
        g,detail=_textile['_chair_welt'](checked['seat_double_welt'],checked['tailored_seat_cushion'])
        replace('seat_double_welt',g,'continuous seat piping seated on the measured refined cushion',smooth=True);changes[-1].update(detail)
    elif ident=='rotating-cat-litter-box':
        name='dark_recessed_interior'
        box={side:list(specs[name]['bounds'][side]) for side in ('min','max')}
        # The original drum narrows at its rear. Inset the backing enough to
        # clear that surface instead of grazing it at a single dark point.
        for axis in (0,2):box['min'][axis]+=.012;box['max'][axis]-=.012
        box['max'][1]-=.006
        replace(name,cylinder(box,1),'oval closed cavity backing stays inside the narrowing drum without rear intersections',smooth=True)
    elif ident=='secretary-desk':
        name='secretary_tall_body';replace(name,secretary_case(specs[name]['bounds']),'open writing compartment with thick side walls, closed back, upper cap and central divider',.002)
        for name in [n for n in checked if n.startswith('secretary_cubby')]:
            box={s:list(specs[name]['bounds'][s]) for s in ('min','max')}
            box['max'][1]=specs['secretary_tall_body']['bounds']['max'][1]-.02
            replace(name,box_mesh(box['min'],box['max']),'cubby shelf reaches into the retained cabinet back for real support',.002)
        # A pair of fold stays connects the existing partially open writing flap
        # to the inside case sides. They share the original bronze pull material.
        name='secretary_pull';parts=[geom(name)]
        for sign in (-1,1):
            path=[(sign*.445,-.065,1.17),(sign*.413,-.14,1.02),(sign*.397,-.205,.876)]
            parts.append(_laundry['tube'](path,.0035,12))
        replace(name,combine(parts),'original pull plus two connected bronze fold stays supporting the existing writing flap',smooth=True)
    elif ident=='shower-wetroom':
        screen=specs['glass_screen']['bounds'];cx=(screen['min'][0]+screen['max'][0])/2
        for name in [n for n in checked if n.startswith('glass_hinge_clamp')]:
            v,f=geom(name);box=bounds(v);dx=cx-(box['min'][0]+box['max'][0])/2
            replace(name,([(x+dx,y,z) for x,y,z in v],f),'clamp relocated onto the actual left glass-screen edge')
        name='rainfall_head';head=specs[name]['bounds'];arm=specs['shower_arm']['bounds'];x=(head['min'][0]+head['max'][0])/2
        neck=cylinder({'min':[x-.012,-.012,head['max'][2]-.003],'max':[x+.012,.012,arm['min'][2]+.01]},2)
        replace(name,combine([geom(name),neck]),'short threaded neck joins the rainfall head to its shower arm',smooth=True)
        name='riser';riser=specs[name]['bounds'];x=(riser['min'][0]+riser['max'][0])/2;parts=[geom(name)]
        for z in (.72,1.76):
            parts.append(cylinder({'min':[x-.033,.38,z-.033],'max':[x+.033,.421,z+.033]},1))
        replace(name,combine(parts),'two wall-mount bosses support the shower riser within the tray footprint',smooth=True)
    elif ident=='safety-fire-extinguisher':
        body=specs['red spun pressure cylinder']['bounds'];label=specs['unbranded pictogram label']['bounds']
        replace('unbranded pictogram label',wrapped_label(label,body),'thin cylindrical instruction label follows the tank rather than intersecting its center')
        for name in checked:
            if name.startswith(('label title','label subtitle','instruction line','original pictogram marker')):
                obj=checked[name];inverse=obj.matrix_world.inverted()
                for vertex in obj.data.vertices:
                    p=obj.matrix_world@vertex.co;depth=.0014+label['min'][1]-p.y
                    vertex.co=inverse@Vector((p.x,label_y(p.x,body,depth),p.z))
                obj.data.update();changes.append({'kind':'source-evidenced-contact','component':name,'construction':'original text/pictogram geometry follows its curved label; content and UVs retained'})
        replace('flexible black discharge hose',curved_hose(points('flexible black discharge hose')),'smooth flexible discharge hose inside the original measured envelope',smooth=True)
    else:raise ValueError('Wrong utility repair ID')
    bpy.context.view_layer.update()
    return changes
