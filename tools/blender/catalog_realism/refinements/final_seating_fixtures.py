"""Six source-bound furniture details; no catalog-wide behavior changes."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_seat=runpy.run_path(str(_dir/'shell_chair_contact.py'))
_curves=_seat['_curves'];_textile=_seat['_u']['_textile']
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']


def sun_ray(points,low,high):
    if len(points)!=4 or not 0<high-low<.003:raise ValueError('Expected the original four-corner sun ray and shallow textile relief')
    xy=[p[:2] for p in points];center=tuple(sum(p[a] for p in xy)/4 for a in range(2));outline=[]
    # Quadratic corner rounding remains inside the authored convex ray outline.
    for i,p in enumerate(xy):
        a=xy[i-1];b=xy[(i+1)%4];start=tuple(p[k]*.86+a[k]*.14 for k in range(2));end=tuple(p[k]*.86+b[k]*.14 for k in range(2))
        for j in range(8):
            t=j/8;outline.append(tuple((1-t)**2*start[k]+2*(1-t)*t*p[k]+t*t*end[k] for k in range(2)))
    vertices=[(*p,low) for p in outline]+[(*p,high) for p in outline];faces=[]
    for i in range(32):faces.append((i,(i+1)%32,(i+1)%32+32,i+32))
    faces.extend([tuple(reversed(range(32))),tuple(range(32,64))])
    box=bounds(points);box['min'][2]=low;box['max'][2]=high
    return outward(fit(vertices,box),faces)


def drawer_plan(fronts):
    if len(fronts)!=3:raise ValueError('Expected the three incorrectly inherited front panels')
    low=min(b['min'][2] for b in fronts);high=max(b['max'][2] for b in fronts);gap=.014
    if not 1.08<high-low<1.09:raise ValueError('Original tall chest front envelope changed')
    height=(high-low-4*gap)/5
    return [{'min':[fronts[0]['min'][0],fronts[0]['min'][1],low+i*(height+gap)],
             'max':[fronts[0]['max'][0],fronts[0]['max'][1],low+i*(height+gap)+height]} for i in range(5)]


def arch_bridge(piers,slab):
    if len(piers)!=2:raise ValueError('Two original piers required')
    xmin=min(p['min'][0] for p in piers);xmax=max(p['max'][0] for p in piers)
    outer=max(abs(p[s][1]) for p in piers for s in ('min','max'));inner=min(abs(p[s][1]) for p in piers for s in ('min','max'))
    if not .24<outer<.26 or not .12<inner<.14 or abs((xmax-xmin)-.09)>1e-5:raise ValueError('Source stone arch piers changed')
    spring=.17;peak=slab['min'][2]+.015;inner_peak=peak-.09;steps=64
    profile=[(outer*math.cos(math.pi-i*math.pi/steps),spring+(peak-spring)*math.sin(math.pi-i*math.pi/steps)) for i in range(steps+1)]
    profile += [(inner*math.cos(i*math.pi/steps),spring+(inner_peak-spring)*math.sin(i*math.pi/steps)) for i in range(steps+1)]
    n=len(profile);vertices=[(x,y,z) for x in (xmin,xmax) for y,z in profile]
    faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    faces += [tuple(reversed(range(n))),tuple(range(n,2*n))]
    return outward(vertices,faces),spring


def tripod_anchors(points,z):
    if len(points)!=48:raise ValueError('Expected three original two-station eight-sided timber legs')
    anchors=[];tops=[]
    for i in range(3):
        centers=[tuple(sum(p[a] for p in points[i*16+j*8:i*16+(j+1)*8])/8 for a in range(3)) for j in range(2)]
        low,high=sorted(centers,key=lambda p:p[2]);t=(z-low[2])/(high[2]-low[2])
        if not .2<t<.8:raise ValueError('Spreader is outside the original leg middle')
        anchors.append(tuple(low[a]+t*(high[a]-low[a]) for a in range(3)));tops.append(high)
    center=tuple(sum(p[a] for p in anchors)/3 for a in range(3))
    rx=anchors[0][0]-center[0];ry=(anchors[1][1]-anchors[2][1])/math.sqrt(3)
    if min(rx,ry)<.1:raise ValueError('Original tripod splay changed')
    for i,p in enumerate(anchors):
        expected=(center[0]+rx*math.cos(i*math.tau/3),center[1]+ry*math.sin(i*math.tau/3),z)
        # Source tube sections carry authored submillimetre radial jitter;
        # measured leg centers differ from their common ellipse by <0.06 mm.
        if math.dist(expected,p)>.00015:raise ValueError('Original tripod ordering or splay changed')
    return anchors,tops,center,rx,ry


def ring(center,rx,ry,radius,segments=96):
    vertices=[];faces=[];sides=12
    for i in range(segments):
        a=i*math.tau/segments
        for j in range(sides):
            t=j*math.tau/sides
            vertices.append((center[0]+(rx+radius*math.cos(t))*math.cos(a),center[1]+(ry+radius*math.cos(t))*math.sin(a),center[2]+radius*math.sin(t)))
    for i in range(segments):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%segments)*sides+(j+1)%sides,((i+1)%segments)*sides+j))
    return outward(vertices,faces)


def hollow_shade(points):
    if len(points)!=192:raise ValueError('Expected four source annular shade stations')
    box=bounds(points);cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    vertices=[];faces=[];n=96
    for j in range(4):
        row=points[j*48:(j+1)*48];b=bounds(row);rx=(b['max'][0]-b['min'][0])/2;ry=(b['max'][1]-b['min'][1])/2;z=sum(p[2] for p in row)/48
        if b['max'][2]-b['min'][2]>2e-6:raise ValueError('Shade profile station left its original plane')
        for i in range(n):a=i*math.tau/n;vertices.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    for j in range(4):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,((j+1)%4)*n+(i+1)%n,((j+1)%4)*n+i))
    return outward(vertices,faces)


def beam(a,b,radius):
    # A straight round support with a stable orthogonal frame.
    import math
    direction=[b[k]-a[k] for k in range(3)];length=math.sqrt(sum(x*x for x in direction));t=[x/length for x in direction]
    ref=(0,0,1) if abs(t[2])<.9 else (0,1,0)
    cross=lambda u,v:(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    u=cross(t,ref);l=math.sqrt(sum(x*x for x in u));u=[x/l for x in u];v=cross(t,u)
    vertices=[tuple(p[k]+radius*(math.cos(i*math.tau/12)*u[k]+math.sin(i*math.tau/12)*v[k]) for k in range(3)) for p in (a,b) for i in range(12)]
    faces=[(i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12)]+[tuple(reversed(range(12))),tuple(range(12,24))]
    return outward(vertices,faces)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Final source evidence changed')
    ident=item['id'];objects=_curves['_objects'](scene,names);specs={s['name']:s for s in evidence['objects']};checked={};points={};changes=[]
    for name,spec in specs.items():
        soft=name=='tailored_seat_cushion';trim=name=='seat_double_welt'
        checked[name],points[name]=_curves['_checked'](objects,spec,keys,exact_count=not soft,exact_bounds=not(soft or trim))
    def replace(name,mesh,description,smooth=True,extra=None):
        box=bounds(mesh[0])
        if any(box[s][a]<evidence['bounds']['min'][a]-1e-7 or box[s][a]>evidence['bounds']['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Final refinement escaped original catalog bounds')
        stats=_curves['_replace'](checked[name],mesh)
        for p in checked[name].data.polygons:p.use_smooth=smooth and len(p.vertices)==4
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**stats,**(extra or {})})
    def add(name,mesh,material,description,smooth=True):
        obj=bpy.data.objects.new(name,bpy.data.meshes.new(name));scene.collection.objects.link(obj);obj.data.materials.append(material);names[obj.name]=name;checked[name]=obj
        replace(name,mesh,description,smooth)
    def material(key):
        return next(m for o in scene.objects if o.type=='MESH' for m in o.data.materials if m and keys.get(m.name)==key)
    if ident in ('swivel-barrel-chair','swivel-dining-chair'):
        name='tailored_seat_cushion';replace(name,_seat['child_cover'](specs[name]['bounds']),'quiet rounded rectangular seat cover in the exact original envelope, removing generic corner puckers')
        for p in checked[name].data.polygons:p.use_smooth=True
        name='seat_double_welt';mesh,detail=_seat['seated_welt'](checked[name],checked['tailored_seat_cushion'],evidence['originalSeam'])
        replace(name,mesh,'original cyclic piping seated continuously on the corrected source-sized cover',extra=detail)
        pan=specs['structural_seat_pan']['bounds'];pad=specs['tailored_seat_cushion']['bounds'];target={s:list(pan[s]) for s in ('min','max')}
        for a in (0,1):
            center=(pad['min'][a]+pad['max'][a])/2;half=(pad['max'][a]-pad['min'][a])*.45;target['min'][a]=center-half;target['max'][a]=center+half
        target['max'][2]=pad['min'][2]+.016
        replace('structural_seat_pan',_seat['child_cover'](target),'rounded support pan fits within the original cover instead of projecting sharp black corners')
        name='swivel_column';target={s:list(specs[name]['bounds'][s]) for s in ('min','max')};old_top=target['max'][2];target['max'][2]=pan['min'][2]+.004
        replace(name,(fit(points[name],target),[tuple(f.vertices) for f in checked[name].data.polygons]),'existing swivel column extends to overlap the original pan underside',extra={'originalSupportGapM':pan['min'][2]-old_top,'contactOverlapM':.004})
    elif ident=='sunburst-rug':
        top=evidence['bounds']['max'][2];name='round_woven_base';box={s:list(specs[name]['bounds'][s]) for s in ('min','max')};box['max'][2]=top-.0015
        replace(name,_textile['lathe']([(0,0),(.992,0),(1,.15),(1,.65),(.996,.92),(.99,1),(0,1)],box,192),'densely rounded plush textile foundation fills the authored rug thickness instead of leaving folded leaf rays floating above a thin disc')
        name='sun_center';box={s:list(specs[name]['bounds'][s]) for s in ('min','max')};box['min'][2]=top-.0017;box['max'][2]=top
        replace(name,_textile['lathe']([(0,0),(1,0),(1,.8),(.995,1),(0,1)],box,128),'smooth circular terracotta textile inlay retains its source footprint')
        for name in specs:
            if name.startswith('sun_ray'):replace(name,sun_ray(points[name],top-.0017,top),'rounded shallow ray inlay retains the exact original motif footprint and material',False)
    elif ident=='tall-drawer-chest':
        fronts=[n for n in specs if n.startswith('separate_door_or_drawer_front')];pulls=[n for n in specs if n.startswith('recessed_finger_pull')]
        fronts.sort(key=lambda n:specs[n]['bounds']['min'][2]);pulls.sort(key=lambda n:specs[n]['bounds']['min'][2])
        plan=drawer_plan([specs[n]['bounds'] for n in fronts]);front=fronts[0];pull=pulls[0]
        front_mesh=points[front],[tuple(p.vertices) for p in checked[front].data.polygons];pull_mesh=points[pull],[tuple(p.vertices) for p in checked[pull].data.polygons]
        for i,box in enumerate(plan):
            mesh=(fit(front_mesh[0],box),front_mesh[1]);pull_box={s:list(specs[pull]['bounds'][s]) for s in ('min','max')};pull_box['min'][2]=box['max'][2]-.03516665;pull_box['max'][2]=pull_box['min'][2]+.011
            pmesh=(fit(pull_mesh[0],pull_box),pull_mesh[1])
            if i<3:
                replace(fronts[i],mesh,'five equal-height static drawer fronts within the original three-front envelope',False)
                replace(pulls[i],pmesh,'original recessed pull fitted to its corrected drawer front',False)
            else:
                add('detail_drawer_front_'+str(i+1),mesh,checked[front].data.materials[0],'additional source-style front completes the explicitly named five-drawer chest',False)
                add('detail_drawer_pull_'+str(i+1),pmesh,checked[pull].data.materials[0],'matching recessed pull for the additional static drawer front',False)
    elif ident=='travertine-coffee-table':
        slab=specs['beveled_slab_top']['bounds']
        for bridge,piers in [('arched_stone_bridge',['arch_pier','arch_pier.001']),('arched_stone_bridge.001',['arch_pier.002','arch_pier.003'])]:
            mesh,spring=arch_bridge([specs[p]['bounds'] for p in piers],slab);replace(bridge,mesh,'smooth stone arch with a rectangular cross-section matching its two original piers')
            for name in piers:
                box={s:list(specs[name]['bounds'][s]) for s in ('min','max')};box['max'][2]=spring+.003
                replace(name,(fit(points[name],box),[tuple(p.vertices) for p in checked[name].data.polygons]),'original pier seats three millimetres into the matching arch end',False)
    elif ident=='tripod-floor-lamp':
        name='lined_linen_lampshade';replace(name,hollow_shade(points[name]),'densely sampled existing open linen shell retains both openings and the original lining; no cap removal is claimed')
        spread=specs['tripod_spreader']['bounds'];z=(spread['min'][2]+spread['max'][2])/2
        anchors,tops,center,rx,ry=tripod_anchors(points['splayed_timber_tripod'],z)
        replace('tripod_spreader',ring(center,rx,ry,.006),'continuous spreader passes through all three original timber centerlines',extra={'measuredLegContactsM':anchors})
        shade=specs['lined_linen_lampshade']['bounds'];cx,cy=[(shade['min'][a]+shade['max'][a])/2 for a in (0,1)];legtop=sum(p[2] for p in tops)/3
        box={'min':[cx-.053,cy-.053,legtop-.01],'max':[cx+.053,cy+.053,legtop+.01]}
        gold=material('aged-brass-fitting');ivory=material('ivory-detail')
        add('detail_lamp_tripod_hub',_textile['lathe']([(0,0),(1,0),(1,1),(0,1)],box,48),gold,'central hub joins the original three timber tips')
        box={'min':[cx-.023,cy-.023,legtop+.007],'max':[cx+.023,cy+.023,legtop+.06]}
        add('detail_lamp_socket',_textile['lathe']([(0,0),(.9,0),(1,.08),(1,.84),(.85,1),(0,1)],box,48),gold,'separate fitted lamp socket above the timber hub')
        box={'min':[cx-.034,cy-.034,legtop+.055],'max':[cx+.034,cy+.034,legtop+.15]}
        add('detail_lamp_bulb',_textile['lathe']([(0,0),(.5,0),(.5,.2),(.82,.4),(1,.61),(.96,.8),(.68,.96),(0,1)],box,64),ivory,'opaque original ivory material forms a bounded bulb without altering emission factors')
        shade_z=shade['min'][2]+.004;srx=(shade['max'][0]-shade['min'][0])*.5-.009;sry=(shade['max'][1]-shade['min'][1])*.5-.009
        for i in range(3):
            a=i*math.tau/3;start=(cx+.038*math.cos(a),cy+.038*math.sin(a),legtop+.002);end=(cx+srx*math.cos(a),cy+sry*math.sin(a),shade_z)
            add('detail_lamp_shade_spoke_'+str(i+1),beam(start,end,.0025),gold,'thin support connects the hub to the original inner shade ring')
    else:raise ValueError('Wrong final seating or fixture model')
    return changes
