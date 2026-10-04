"""Four isolated, source-evidenced stored-cable, inlet and guard corrections."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_design=runpy.run_path(str(_dir/'designed_construction.py'))
_utility=runpy.run_path(str(_dir/'utility_construction.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']
cross=_design['cross'];dot=_design['dot'];sub=_design['sub'];unit=_design['unit']
rounded_path=_design['rounded_path']


def centers(points,sides):
    if len(points)%sides:raise ValueError('Original tube stations are incomplete')
    result=[tuple(sum(p[a] for p in points[j:j+sides])/sides for a in range(3)) for j in range(0,len(points),sides)]
    if any(min(math.dist(p,c) for p in points[j*sides:(j+1)*sides])<1e-5 for j,c in enumerate(result)):
        raise ValueError('Collapsed source tube section')
    return result


def ring_measure(points,segments):
    if len(points)!=(segments+1)*8:raise ValueError('Wrong original stored cable station count')
    path=centers(points,8)
    if math.dist(path[0],path[-1])>2e-6:raise ValueError('Source cable is not the inspected closed winding')
    center=tuple(sum(p[a] for p in path[:-1])/segments for a in range(3))
    rx=max(abs(p[0]-center[0]) for p in path[:-1]);rz=max(abs(p[2]-center[2]) for p in path[:-1])
    if min(rx,rz)<.01:raise ValueError('Collapsed source cable loop')
    for i,p in enumerate(path):
        expected=(center[0]+rx*math.cos(i*math.tau/segments),center[1],center[2]+rz*math.sin(i*math.tau/segments))
        if math.dist(p,expected)>2e-6:raise ValueError('Source winding left its measured ellipse')
    return center,rx,rz,path


def coil(points,source_segments):
    center,rx,rz,path=ring_measure(points,source_segments)
    box=bounds(points);minor_y=(box['max'][1]-box['min'][1])/2
    minor_x=max(abs(p[0]-path[0][0]) for p in points[:8])
    quarter=source_segments//4
    minor_z=max(abs(p[2]-path[quarter][2]) for p in points[quarter*8:(quarter+1)*8])
    if not .002<min(minor_x,minor_y,minor_z)<.02:raise ValueError('Unexpected measured cable thickness')
    vertices=[];faces=[];steps=96;sides=10
    for i in range(steps):
        angle=i*math.tau/steps
        for j in range(sides):
            p=j*math.tau/sides
            vertices.append((center[0]+(rx+minor_x*math.cos(p))*math.cos(angle),center[1]+minor_y*math.sin(p),center[2]+(rz+minor_z*math.cos(p))*math.sin(angle)))
    for i in range(steps):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%steps)*sides+(j+1)%sides,((i+1)%steps)*sides+j))
    return outward(fit(vertices,box),faces)


def nearest_loop(points,segments,point):
    center,rx,rz,_=ring_measure(points,segments)
    angle=math.atan2((point[2]-center[2])/rz,(point[0]-center[0])/rx)
    return (center[0]+rx*math.cos(angle),center[1],center[2]+rz*math.sin(angle))


def tube(path,radius,sides=16):
    """Projected parallel frame has no vertical-axis branch or sign reversal."""
    if len(path)<2 or radius<=0:raise ValueError('Finite nonempty source cable path required')
    vertices=[];faces=[];side=None
    for i,p in enumerate(path):
        before=path[max(0,i-1)];after=path[min(len(path)-1,i+1)]
        direction=unit(sub(after,before))
        if side is None:
            reference=min(((1,0,0),(0,1,0),(0,0,1)),key=lambda v:abs(dot(v,direction)))
            side=unit(cross(reference,direction))
        else:
            projected=tuple(side[k]-direction[k]*dot(side,direction) for k in range(3))
            if math.dist(projected,(0,0,0))<.1:raise ValueError('Cable path turns too abruptly for a continuous frame')
            side=unit(projected)
        normal=cross(direction,side)
        for j in range(sides):
            angle=j*math.tau/sides
            vertices.append(tuple(p[k]+radius*(side[k]*math.cos(angle)+normal[k]*math.sin(angle)) for k in range(3)))
    for i in range(len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))]
    return outward(vertices,faces)


def source_radius(points,sides):
    path=centers(points,sides)
    return min(math.dist(p,path[i//sides]) for i,p in enumerate(points))


def inlet(box):
    # X-axis thin wall with a rounded exposed annular mouth. Its hidden root
    # enters the existing hollow cyclone body; there is no cap across the bore.
    profile=[(1,0),(1,.97),(.98,1),(.81,1),(.8,.97),(.8,0)]
    canonical={s:[box[s][1],box[s][2],box[s][0]] for s in ('min','max')}
    points,faces=_shell['lathe'](profile,canonical,64)
    return outward(fit([(p[2],p[0],p[1]) for p in points],box),faces)


def guard(points,steps=112):
    if len(points)!=148:raise ValueError('Expected four original 37-station miter guard arcs')
    samples=(0,18,36);matrix=[(1,math.cos(math.pi*j/36),math.sin(math.pi*j/36)) for j in samples]
    vertices=[]
    for ring in range(4):
        coeffs=[_utility['solve3'](matrix,[points[ring*37+j][a] for j in samples]) for a in range(3)]
        def at(t):return tuple(c+a*math.cos(t)+b*math.sin(t) for c,a,b in coeffs)
        if max(math.dist(points[ring*37+j],at(math.pi*j/36)) for j in range(37))>2e-6:
            raise ValueError('Miter casing left its source affine circular profile')
        vertices.extend(at(math.pi*j/steps) for j in range(steps+1))
    n=steps+1;faces=[]
    for j in range(steps):
        faces += [(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),
                  (j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)]
    faces += [(0,n,3*n,2*n),(steps,2*n+steps,3*n+steps,n+steps)]
    return outward(fit(vertices,bounds(points)),faces)


def apply(root,scene,item,keys,names,evidence):
    ident=item['id']
    if ident not in ('garage-cord-reel','garage-cyclone-extractor','garage-ev-charger','garage-miter-saw'):
        raise ValueError('Wrong reviewed garage refinement ID')
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed garage source changed')
    objects=_curves['_objects'](scene,names);checked={};source={};changes=[]
    for spec in evidence['objects']:
        checked[spec['name']],source[spec['name']]=_curves['_checked'](objects,spec,keys)
    def replace(name,geometry,description,extra=None):
        vertices,faces=geometry;box=bounds(vertices);envelope=evidence['bounds']
        if any(box[s][a]<envelope['min'][a]-1e-7 or box[s][a]>envelope['max'][a]+1e-7 for s in ('min','max') for a in range(3)):
            raise ValueError('Reviewed component escaped original catalog envelope: '+name)
        obj=checked[name];detail=_curves['_replace'](obj,geometry,smooth_sides=False)
        for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**detail,**(extra or {})})
        return obj
    if ident in ('garage-cord-reel','garage-ev-charger'):
        loop_prefix='Stored hose winding' if ident=='garage-cord-reel' else 'Stowed EV charging cable loop'
        count=32 if ident=='garage-cord-reel' else 40
        loop_names=[name for name in source if name==loop_prefix or name.startswith(loop_prefix+'.')]
        for name in loop_names:
            replace(name,coil(source[name],count),'closed smooth stored cable winding without duplicate capped end seam',{'radialSegments':96,'tubeSides':10})
        if ident=='garage-cord-reel':
            name='Stowed reel lead';path=centers(source[name],8)
            radius=source_radius(source[name],8)
            curved=rounded_path(path,cut=.035,spacing=.006)
            replace(name,tube(curved,radius,16),'rounded flexible lead retaining both authored guide and outlet endpoint positions',{'endpointCentersM':[path[0],path[-1]]})
        else:
            for name,end in [('Bottom charging cable inlet',-1),('Cable connection to holster',0)]:
                path=centers(source[name],10);original=path[end]
                nearest=min((nearest_loop(source[loop],40,original) for loop in loop_names),key=lambda p:math.dist(p,original))
                path[end]=nearest
                curved=rounded_path(path,cut=.022,spacing=.006)
                replace(name,tube(curved,source_radius(source[name],10),16),'continuous rounded lead joining the original case or holster to a measured stored loop',{'originalLooseEndpointM':original,'seatedLoopCenterM':nearest,'endpointCorrectionM':math.dist(original,nearest)})
    elif ident=='garage-cyclone-extractor':
        name='Cyclone tangential inlet'
        replace(name,inlet(bounds(source[name])),'open tangential inlet bore with a rounded annular end behind the original dark lip',{'boreRadiusRatio':.8})
        name='Connected overhead dust hose';path=centers(source[name],12)
        head=bounds(source['Extractor head']);original=path[-1]
        # The source tube ends 1.88 mm above the cap. A small insertion seats
        # its root inside the existing head; the other end remains in the shell.
        path[-1]=(path[-1][0],path[-1][1],head['max'][2]-.005)
        curved=rounded_path(path,cut=.04,spacing=.008);mesh=tube(curved,source_radius(source[name],12),20)
        target=bounds(source[name]);target['min'][2]=head['max'][2]-.007
        mesh=outward(fit(mesh[0],target),mesh[1])
        replace(name,mesh,'rounded continuous dust-hose bends with its motor end seated inside the existing extractor head',{'sourceEndCenterM':original,'headContactTargetM':path[-1],'preservedTopHeightM':target['max'][2]})
    elif ident=='garage-miter-saw':
        name='Deep upper blade casing';obj=replace(name,guard(source[name]),'smooth measured semicircular casing retains original teeth, lower glass guard, motor and rails')
        for face in obj.data.polygons:
            xs=[(obj.matrix_world@obj.data.vertices[i].co).x for i in face.vertices]
            zs=[(obj.matrix_world@obj.data.vertices[i].co).z for i in face.vertices]
            # Broad annular side plates remain planar. Only the inner and outer
            # curved strips interpolate normals around the circular silhouette.
            face.use_smooth=max(xs)-min(xs)>1e-7 and max(zs)-min(zs)>1e-7 and len(face.vertices)==4
    return changes
