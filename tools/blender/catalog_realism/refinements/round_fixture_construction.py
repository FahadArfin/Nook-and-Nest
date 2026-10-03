"""Five isolated source-measured round fixtures, including true basin apertures."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_h=runpy.run_path(str(_dir/'household_turning.py'))
_curves=_h['_curves'];_round=_h['_round'];_g=_h['_garage'];_fixture=_g['_design']['_fixtures']
bounds=_h['bounds'];fit=_h['fit'];outward=_h['outward']

def spun_shade(points):
    if len(points)!=192:raise ValueError('Expected four original 48-point spun-shade stations')
    profile=_h['source_profile'](points,48)
    if len(profile)!=4 or min(r for r,z in profile)<=0:raise ValueError('Source shade no longer has both authored openings')
    return _h['closed_lathe'](profile,bounds(points),96)

def super_shell(profile,box,sides=96):
    cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)];depth=box['max'][2]-box['min'][2]
    points=[];faces=[]
    for x,y,z in profile:
        for i in range(sides):
            t=i*math.tau/sides;c,s=math.cos(t),math.sin(t)
            points.append((cx+rx*x*math.copysign(abs(c)**(2/3.5),c),cy+ry*y*math.copysign(abs(s)**(2/3.5),s),box['min'][2]+z*depth))
    for ring in range(len(profile)-1):
        for i in range(sides):faces.append((ring*sides+i,ring*sides+(i+1)%sides,(ring+1)*sides+(i+1)%sides,(ring+1)*sides+i))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(profile)-1)*sides,len(profile)*sides))])
    return outward(points,faces)

def smooth_basin(points):
    if len(points)!=7*48:raise ValueError('Expected seven original 48-point basin contours')
    box=bounds(points);cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)];depth=box['max'][2]-box['min'][2];profile=[]
    for j in range(7):
        ring=points[j*48:(j+1)*48];row=bounds(ring);center=[sum(p[a] for p in ring)/48 for a in range(3)]
        if math.dist(center[:2],(cx,cy))>2e-6 or row['max'][2]-row['min'][2]>2e-6:raise ValueError('Basin contour left its original plane')
        a=(row['max'][0]-row['min'][0])/2;b=(row['max'][1]-row['min'][1])/2
        for i,p in enumerate(ring):
            angle=i*math.tau/48;c,s=math.cos(angle),math.sin(angle)
            expected=(cx+a*math.copysign(abs(c)**(2/3.5),c),cy+b*math.copysign(abs(s)**(2/3.5),s),center[2])
            if math.dist(p,expected)>3e-6:raise ValueError('Original basin exponent or vertex order changed')
        profile.append((a/rx,b/ry,(center[2]-box['min'][2])/depth))
    sampled=[_h['monotone']([(i,p[a]) for i,p in enumerate(profile)],4) for a in range(3)]
    dense=[tuple(sampled[a][i][1] for a in range(3)) for i in range(len(sampled[0]))]
    mesh=super_shell(dense,box)
    # Keep the nominal measured extrema exact despite float32 source values.
    vertices=fit(mesh[0],box)
    vertices=[tuple(box['min'][a] if abs(p[a]-box['min'][a])<1e-12 else box['max'][a] if abs(p[a]-box['max'][a])<1e-12 else p[a] for a in range(3)) for p in vertices]
    return outward(vertices,mesh[1]),dense

def worktop_aperture(profile,basin,slab):
    low,high=slab['min'][2]-.003,slab['max'][2]+.003;bottom=basin['min'][2];depth=basin['max'][2]-bottom
    peak=max(range(len(profile)),key=lambda i:profile[i][2]);outer=profile[:peak+1]
    if not bottom<slab['min'][2]<slab['max'][2]<basin['max'][2]:raise ValueError('Expected the source slab intersecting the basin lower shell')
    levels=sorted({low,high,*[bottom+p[2]*depth for p in outer if low<bottom+p[2]*depth<high]})
    result=[];rx,ry=[(basin['max'][a]-basin['min'][a])/2 for a in (0,1)]
    for z in levels:
        t=(z-bottom)/depth
        if t<=outer[0][2]:x,y=outer[0][:2]
        else:
            pair=next(((a,b) for a,b in zip(outer,outer[1:]) if a[2]<=t<=b[2]),None)
            if pair is None:raise ValueError('Worktop opening extends above the measured outer basin')
            a,b=pair;s=(t-a[2])/(b[2]-a[2]);x,y=[a[k]+s*(b[k]-a[k]) for k in (0,1)]
        result.append((x-.001/rx,y-.001/ry,t))
    return super_shell(result,basin)

def smooth_ring(points):
    if len(points)!=49*8:raise ValueError('Expected the original 48-section loop with tapered overlapping end')
    centers=_g['centers'](points,8);center=tuple(sum(p[a] for p in centers[:-1])/48 for a in range(3))
    rx=max(abs(p[0]-center[0]) for p in centers[:-1]);ry=max(abs(p[1]-center[1]) for p in centers[:-1])
    if min(rx,ry)<.2 or math.dist(centers[0],centers[-1])>.0005:raise ValueError('Original chandelier frame is no longer the reviewed ring')
    for i,p in enumerate(centers):
        expected=(center[0]+rx*math.cos(i*math.tau/48),center[1]+ry*math.sin(i*math.tau/48),center[2])
        if math.dist(p,expected)>.001:raise ValueError('Source ring exceeds its authored submillimetre radial jitter')
    vertices=[];faces=[];steps=128;sides=16
    for i in range(steps):
        a=i*math.tau/steps
        for j in range(sides):
            t=j*math.tau/sides;vertices.append(((1+.045*math.cos(t))*math.cos(a),(1+.045*math.cos(t))*math.sin(a),.045*math.sin(t)))
    for i in range(steps):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%steps)*sides+(j+1)%sides,((i+1)%steps)*sides+j))
    return outward(fit(vertices,bounds(points)),faces)

def vent_target(box,lid_top):
    gap=box['min'][2]-lid_top
    if not .001<gap<.008:raise ValueError('Expected the source pressure vent floating just above its lid')
    return {s:[v if a!=2 else v-gap-.001 for a,v in enumerate(box[s])] for s in ('min','max')}

def _cut_top(scene,names,top,mesh,probe):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    old=bounds([tuple(top.matrix_world@v.co) for v in top.data.vertices]);old_count=len(top.data.vertices)
    cutter=_fixture['_add'](scene,{},'temporary_owned_basin_aperture',mesh,top.data.materials[0],False)
    modifier=top.modifiers.new('Source-evidenced basin opening','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    try:
        bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
        candidate=bpy.data.meshes.new_from_object(top.evaluated_get(graph),preserve_all_data_layers=True,depsgraph=graph)
        actual=bounds([tuple(top.matrix_world@v.co) for v in candidate.vertices])
        if len(candidate.vertices)<=old_count or any(abs(actual[s][a]-old[s][a])>2e-6 for s in ('min','max') for a in range(3)):raise ValueError('Basin aperture failed or changed outer worktop dimensions')
        candidate.calc_loop_triangles();world=[top.matrix_world@v.co for v in candidate.vertices]
        tree=BVHTree.FromPolygons(world,[tuple(f.vertices) for f in candidate.loop_triangles],all_triangles=True)
        hit=tree.ray_cast(Vector((probe[0],probe[1],old['max'][2]+.03)),Vector((0,0,-1)),old['max'][2]-old['min'][2]+.06)
        if hit[0] is not None:raise ValueError('Original basin drain remains occluded by the worktop')
        top.data=candidate
        for mod in list(top.modifiers):top.modifiers.remove(mod)
        return {'sourceVertices':old_count,'candidateVertices':len(candidate.vertices),'boundsM':actual,'clearDrainRayM':probe,'originalUvLayersRetained':[layer.name for layer in candidate.uv_layers]}
    finally:
        if modifier in list(top.modifiers):top.modifiers.remove(modifier)
        data=cutter.data;bpy.data.objects.remove(cutter,do_unlink=True)
        if data.users==0:bpy.data.meshes.remove(data)

def apply(root,scene,item,keys,names,evidence):
    ident=item['id']
    if ident not in ('reading-wall-lamp','reed-double-vanity','ribbed-pedestal-side-table','rice-cooker','ring-chandelier') or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Wrong reviewed round fixture source')
    objects=_curves['_objects'](scene,names);checked={};points={};specs={s['name']:s for s in evidence['objects']};changes=[]
    for name,spec in specs.items():checked[name],points[name]=_curves['_checked'](objects,spec,keys)
    def replace(name,mesh,description,axis=None,extra=None):
        box=bounds(mesh[0])
        if any(box[s][a]<evidence['bounds']['min'][a]-1e-7 or box[s][a]>evidence['bounds']['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Round fixture escaped its original real dimensions')
        stats=_round['_replace'](checked[name],mesh,axis)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**stats,**(extra or {})})
    if ident=='reading-wall-lamp':replace('spun_task_shade',spun_shade(points['spun_task_shade']),'smooth 96-sided sampling of the exact original thin conical shade, preserving both openings',2)
    elif ident=='ring-chandelier':replace('chandelier_circular_frame',smooth_ring(points['chandelier_circular_frame']),'continuous rounded frame closes the original tapered overlap, retaining its envelope and all globe and suspension contacts')
    elif ident=='reed-double-vanity':
        slab=specs['Stone worktop']['bounds']
        for name in ('Recessed washbasin','Recessed washbasin.001'):
            mesh,profile=smooth_basin(points[name]);replace(name,mesh,'smooth superelliptic basin contours and rolled rim retain the measured recessed floor',2)
            box=specs[name]['bounds'];cutter=worktop_aperture(profile,box,slab);probe=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
            stats=_cut_top(scene,names,checked['Stone worktop'],cutter,probe)
            changes.append({'kind':'source-evidenced-construction','component':'Stone worktop','construction':'real bounded aperture follows the original basin outer shell and exposes its existing recessed floor and drain','basin':name,'shellOverlapM':.001,**stats})
    elif ident=='ribbed-pedestal-side-table':
        for name in ('shaped_slab_top','weighted_elliptic_foot','sculpted_center_pedestal'):
            box=specs[name]['bounds'];extra={}
            if name=='sculpted_center_pedestal':box,extra=_round['contact_target'](box,specs['shaped_slab_top']['bounds'])
            replace(name,_round['turned'](_round['recover_profile'](points[name],2,32),box,128),'smooth original turned profile with continuous pedestal-to-top support',2,extra)
    else:
        for name in ('appliance_base','body','lid','lid_knob'):
            replace(name,_round['turned'](_round['recover_profile'](points[name],2,24),specs[name]['bounds'],96),'smooth original turned cooker component with its exact source profile and envelope',2)
        name='Pressure vent';target=vent_target(specs[name]['bounds'],specs['lid']['bounds']['max'][2])
        replace(name,(fit(points[name],target),[tuple(f.vertices) for f in checked[name].data.polygons]),'existing pressure vent seated one millimetre into the original lid',2,{'lidInsertionM':.001})
        ribs=[name for name in specs if name.startswith('Precision grip rib')]
        indices={name:0 if name=='Precision grip rib' else int(name.rsplit('.',1)[1]) for name in ribs}
        if len(ribs)!=20 or set(indices.values())!=set(range(20)):raise ValueError('Expected the original twenty knob grip ribs')
        for name,i in indices.items():replace(name,_round['knob_rib'](specs['lid_knob']['bounds'],i),'original grip detail distributed around the vertical knob axis rather than forming a false front dial',2)
    return changes
