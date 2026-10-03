"""Three reviewed source-specific turned silhouettes and appliance details.

Only named ordinary components are replaced. Original control panels, finishes,
material keys, kettle handle and the table's authored flutes remain untouched.
"""
import math
from pathlib import Path
import runpy

_directory=Path(__file__).parent
_curves=runpy.run_path(str(_directory/'curved_construction.py'))
_turning=runpy.run_path(str(_directory/'textile_turning.py'))
_designed=runpy.run_path(str(_directory/'designed_construction.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']
cross=_designed['cross'];dot=_designed['dot'];sub=_designed['sub']


def _order(axis):
    if axis not in (1,2):raise ValueError('Only the measured Y/Z turned axes are supported')
    return (0,2,1) if axis==1 else (0,1,2)


def recover_profile(points,axis,sides):
    """Covariance recovers non-cardinal fourteen-sided dial rings exactly."""
    order=_order(axis);source=[tuple(p[a] for a in order) for p in points]
    groups=[]
    for point in sorted(source,key=lambda p:p[2]):
        if not groups or abs(point[2]-groups[-1][0])>2e-6:groups.append([point[2],[]])
        groups[-1][1].append(point)
    if len(groups)!=6:raise ValueError('Expected six original concentric turned stations')
    rings=[]
    for height,row in groups:
        # Optional center cap vertex produced by the pure reference lathe.
        center=[sum(p[a] for p in row)/len(row) for a in (0,1)]
        row=[p for p in row if math.hypot(p[0]-center[0],p[1]-center[1])>1e-7]
        if len(row)!=sides:raise ValueError('Source radial station count changed')
        center=[sum(p[a] for p in row)/len(row) for a in (0,1)]
        spread=[math.sqrt(2*sum((p[a]-center[a])**2 for p in row)/len(row)) for a in (0,1)]
        if min(spread)<1e-5:raise ValueError('Collapsed source radial station')
        rings.append((height,row,center,spread))
    centers=[r[2] for r in rings]
    if max(math.dist(c,centers[0]) for c in centers)>2e-6:raise ValueError('Source rings are not coaxial')
    largest=max(rings,key=lambda r:r[3][0]*r[3][1]);rx,ry=largest[3]
    low,high=rings[0][0],rings[-1][0]
    if high-low<1e-5:raise ValueError('Collapsed source axial span')
    profile=[(0,0)]
    for height,row,center,_ in rings:
        radii=[math.hypot((p[0]-center[0])/rx,(p[1]-center[1])/ry) for p in row]
        if max(radii)-min(radii)>2e-5:raise ValueError('Source station is not a circular/elliptical ring')
        radius=sum(radii)/len(radii)
        if abs(radius-1)<2e-6:radius=1
        profile.append((radius,(height-low)/(high-low)))
    return profile+[(0,1)]


def turned(profile,box,segments=96,axis=2):
    order=_order(axis);canonical={side:[box[side][a] for a in order] for side in ('min','max')}
    points,faces=_turning['lathe'](profile,canonical,segments)
    # Refit only the dense sampling to the exact original extrema. A fourteen-
    # sided source dial has no cardinal vertex at one of its sampled extrema.
    points=[tuple(p[order.index(a)] for a in range(3)) for p in points]
    return outward(fit(points,box),faces)


def contact_target(pedestal,top):
    gap=top['min'][2]-pedestal['max'][2]
    if not .005<gap<.02:raise ValueError('Measured drum-table support gap changed')
    target={side:list(pedestal[side]) for side in ('min','max')}
    target['max'][2]=top['min'][2]+.003
    return target,{'originalTopGapM':gap,'topContactOverlapM':.003}


def door_gasket(box,half):
    if half not in (0,1):raise ValueError('Expected two original gasket components')
    cx,cz=[(box['min'][a]+box['max'][a])/2 for a in (0,2)]
    rx,rz=[(box['max'][a]-box['min'][a])*.475 for a in (0,2)]
    # The original ring front bevel retains at least 96% of its outer radius.
    # A 95% ellipse therefore rests on the flat face rather than outside it.
    radius=.0007;depth=.0002;y=box['min'][1]+depth
    path=[(cx+rx*math.cos(t),y,cz+rz*math.sin(t)) for t in [half*math.pi-.001+(math.pi+.002)*i/96 for i in range(97)]]
    geometry=_designed['sweep'](path,radius,(0,1,0),sides=12)
    return geometry,{'radialRatio':.95,'seatedDepthM':depth,'tubeRadiusM':radius,'half':half}


def hollow_spout(points,faces):
    caps=[f for f in faces if len(f)==8]
    if len(caps)!=2:raise ValueError('Expected two original eight-sided spout end caps')
    centers=[tuple(sum(points[i][a] for i in f)/8 for a in range(3)) for f in caps]
    low=min(range(2),key=lambda i:centers[i][2]);high=1-low
    a,b=centers[low],centers[high]
    u=sub(points[caps[low][0]],a);v=sub(points[caps[low][2]],a);w=sub(b,a)
    determinant=dot(u,cross(v,w))
    if abs(determinant)<1e-9:raise ValueError('Degenerate original spout basis')
    coordinates=[]
    for p in points:
        q=sub(p,a)
        coordinates.append((dot(q,cross(v,w))/determinant,dot(u,cross(q,w))/determinant,dot(u,cross(v,q))/determinant))
    radius=max(math.hypot(s,t) for s,t,z in coordinates)
    if not .98<=radius<=1.5 or min(p[2] for p in coordinates)<-1e-5 or max(p[2] for p in coordinates)>1.00001:
        raise ValueError('Original spout is not the expected capped straight pour tube')
    # One closed material shell: outer tube, rolled annular lip, inner bore,
    # and a hidden annular root. There is deliberately no face across the bore.
    profile=[(.93,0),(1,.035),(1,.94),(.98,.985),(.92,1),(.74,1),(.74,.985),(.79,.06),(.79,0)]
    vertices=[];result=[];segments=64
    for radial,height in profile:
        for i in range(segments):
            angle=i*math.tau/segments
            vertices.append(tuple(a[k]+w[k]*height+radius*radial*(u[k]*math.cos(angle)+v[k]*math.sin(angle)) for k in range(3)))
    for ring in range(len(profile)):
        next_ring=(ring+1)%len(profile)
        for i in range(segments):
            j=(i+1)%segments;result.append((ring*segments+i,ring*segments+j,next_ring*segments+j,next_ring*segments+i))
    return outward(fit(vertices,bounds(points)),result),{'openingRadiusRatio':.74,'radialSegments':segments,'originalAxisEndpointsM':[a,b]}


def knob_rib(box,index):
    if index not in range(20):raise ValueError('Expected twenty original grip ribs')
    angle=index*math.tau/20;cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])*.495 for a in (0,1)]
    x,y=cx+rx*math.cos(angle),cy+ry*math.sin(angle);z=(box['min'][2]+box['max'][2])/2
    target={'min':[x-.0005,y-.0005,z-.003],'max':[x+.0005,y+.0005,z+.003]}
    return turned([(0,0),(.7,0),(1,.08),(1,.92),(.7,1),(0,1)],target,12)


def _replace(obj,geometry,axis=None):
    evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
    for face in obj.data.polygons:
        if axis is None:face.use_smooth=len(face.vertices)==4
        else:
            values=[(obj.matrix_world@obj.data.vertices[i].co)[axis] for i in face.vertices]
            face.use_smooth=max(values)-min(values)>1e-8
    return evidence


def apply(root,scene,item,keys,names,specs):
    ident=item['id']
    if ident not in ('drum-coffee-table','dryer','electric-kettle'):raise ValueError('Wrong reviewed round construction ID')
    objects=_curves['_objects'](scene,names);checked={};points={};changes=[]
    for spec in specs:
        checked[spec['name']],points[spec['name']]=_curves['_checked'](objects,spec,keys)
    by_name={spec['name']:spec for spec in specs}
    for spec in specs:
        name=spec['name'];obj=checked[name];extra={};axis=None
        if spec['kind']=='turned':
            axis=spec['axis'];profile=recover_profile(points[name],axis,spec['sides']);target=spec['bounds']
            expected=spec['sourceProfile']
            if len(profile)!=len(expected) or any(abs(a-b)>2e-5 for row,reference in zip(profile,expected) for a,b in zip(row,reference)):
                raise ValueError('Measured source radial profile changed: '+name)
            if name=='sculpted_center_pedestal':target,extra=contact_target(target,by_name['shaped_slab_top']['bounds'])
            segments=128 if ident=='drum-coffee-table' else 64 if name in ('dryer_dial','lid_knob') else 96
            geometry=turned(profile,target,segments,axis);extra.update({'radialSegments':segments,'sourceRadialSegments':spec['sides']})
            construction='smooth measured turned profile with original radial stations and exact outer dimensions'
        elif spec['kind']=='door-gasket':
            geometry,extra=door_gasket(by_name['dryer_door_rim']['bounds'],spec['index'])
            construction='curved perimeter gasket seated on the circular door rim instead of straight floating chords'
        elif spec['kind']=='hollow-spout':
            geometry,extra=hollow_spout(points[name],[tuple(f.vertices) for f in obj.data.polygons])
            construction='rounded hollow pouring tube with rolled annular lip inside original spout envelope'
        elif spec['kind']=='knob-rib':
            geometry=knob_rib(by_name['lid_knob']['bounds'],spec['index']);axis=2
            extra={'knobAxis':'Z','radialSeatingRatio':.99,'ribLengthM':.006}
            construction='small vertical grip rib seated around the actual lid-knob axis'
        else:raise ValueError('Unknown reviewed round construction role')
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':construction,
                        **_replace(obj,geometry,axis),**extra})
    return changes
