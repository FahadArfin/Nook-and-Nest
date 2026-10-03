"""Source-measured shower sweep, watering-can connections and bistro braces."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_g=runpy.run_path(str(_dir/'garage_construction.py'))
_curves=_g['_curves'];_design=_g['_design'];_fixture=_design['_fixtures']
bounds=_g['bounds'];fit=_g['fit'];outward=_g['outward']

def line_y(ends,z):
    (a,h),(b,k)=ends
    if not h<z<k:raise ValueError('Cross brace must lie between its original frame endpoints')
    return a+(b-a)*(z-h)/(k-h)

def shower_sweep(path,box,plinth_top):
    if len(path)!=7 or any(abs(p[0])>1e-6 for p in path):raise ValueError('Expected the original seven planar shower anchors')
    path=_g['rounded_path'](path,cut=.11,spacing=.025)
    points=[];faces=[];outline=[];hx=.066;hy=.0375;r=.018
    for sx,sy,start in ((1,1,0),(-1,1,math.pi/2),(-1,-1,math.pi),(1,-1,3*math.pi/2)):
        for j in range(6):
            t=start+j*math.pi/12;outline.append((sx*(hx-r)+r*math.cos(t),sy*(hy-r)+r*math.sin(t)))
    for i,p in enumerate(path):
        before=path[max(0,i-1)];after=path[min(len(path)-1,i+1)]
        dy,dz=after[1]-before[1],after[2]-before[2];length=math.hypot(dy,dz)
        if length<1e-6:raise ValueError('Collapsed continuous shower centerline')
        for x,y in outline:points.append((x,p[1]+y*dz/length,p[2]-y*dy/length))
    sides=len(outline)
    for i in range(len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))])
    target={s:list(box[s]) for s in ('min','max')};target['min'][2]=plinth_top-.002
    if not 0<box['min'][2]-target['min'][2]<.01:raise ValueError('Unexpected shower-to-plinth source gap')
    return outward(fit(points,target),faces)

def handle(path,radius,box):
    if len(path)!=6 or not .009<radius<.016:raise ValueError('Expected the original six-point watering-can handle')
    curve=_g['rounded_path'](path,cut=.035,spacing=.004)
    points,faces=_g['tube'](curve,radius,20)
    return outward(fit(points,box),faces)

def neck(stem,back,direction):
    if not .012<math.dist(stem,back)<.035:raise ValueError('Expected the observed short spout-to-rose gap')
    direction=_g['unit'](direction)
    if _g['dot'](_g['unit'](_g['sub'](back,stem)),direction)<.995:raise ValueError('Rose no longer aligns with its pouring spout')
    return _g['tube']([tuple(stem[a]-direction[a]*.003 for a in range(3)),tuple(back[a]+direction[a]*.002 for a in range(3))],.016,24)

def bounded(mesh,box):
    actual=bounds(mesh[0])
    if any(actual[s][a]<box['min'][a]-1e-7 or actual[s][a]>box['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Outdoor construction escaped original real dimensions')
    return mesh

def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['id'] not in ('outdoor-solar-shower','outdoor-watering-can','outdoor-steel-bistro-chair') or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Wrong reviewed outdoor source')
    objects=_curves['_objects'](scene,names);checked={};points={};specs={s['name']:s for s in evidence['objects']};changes=[]
    for name,spec in specs.items():checked[name],points[name]=_curves['_checked'](objects,spec,keys)
    def replace(name,mesh,description,extra=None):
        stats=_curves['_replace'](checked[name],bounded(mesh,evidence['bounds']))
        for face in checked[name].data.polygons:face.use_smooth=len(face.vertices)==4
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**stats,**(extra or {})})
    if item['id']=='outdoor-solar-shower':
        sections=[name for name in specs if name.startswith('formed aluminium shower section')]
        if len(sections)!=6:raise ValueError('Original six shower members changed')
        box=bounds([p for name in sections for p in points[name]])
        mesh=shower_sweep(evidence['sourceCenterlineM'],box,specs['anchored shower plinth']['bounds']['max'][2])
        replace(sections[0],mesh,'continuous rounded aluminium shell replaces six gapped beams along their original measured path',{'sourceMembers':6,'sourceCenterlineM':evidence['sourceCenterlineM'],'plinthInsertionM':.002})
        for name in sections[1:]:
            obj=checked[name];names.pop(obj.name,None);bpy.data.objects.remove(obj,do_unlink=True)
    elif item['id']=='outdoor-steel-bistro-chair':
        for name,role in [('lower foot cross brace','front'),('lower foot cross brace.001','rear')]:
            box=specs[name]['bounds'];z=(box['min'][2]+box['max'][2])/2;y=(box['min'][1]+box['max'][1])/2
            target=line_y(evidence['frameCenterlinesM'][role],z);delta=target-y
            if not .015<abs(delta)<.08:raise ValueError('Unexpected reviewed bistro brace gap')
            mesh=([tuple(v[a]+(delta if a==1 else 0) for a in range(3)) for v in points[name]],[tuple(f.vertices) for f in checked[name].data.polygons])
            replace(name,mesh,'original lower cross brace seated at the two inclined frame centerlines, preserving its height and stock section',{'translationM':[0,delta,0],'supportCenterlineM':evidence['frameCenterlinesM'][role]})
    else:
        for name in ('arched top carrying handle','rear D handle'):
            path=_g['centers'](points[name],10);radius=_g['source_radius'](points[name],10)
            replace(name,handle(path,radius,specs[name]['bounds']),'smooth continuous formed-metal handle following the six original anchors and original envelope',{'originalAnchorsM':path,'sectionRadiusM':radius})
        rose=points['rose perforated head']
        if len(rose)!=64:raise ValueError('Original rose stations changed')
        ends=[tuple(sum(p[a] for p in rose[j::2])/32 for a in range(3)) for j in range(2)]
        direction=_g['unit'](_g['sub'](ends[1],ends[0]));stem=evidence['originalSpoutEndpointM']
        mesh=bounded(neck(stem,ends[0],direction),evidence['bounds'])
        obj=checked['tapered pouring spout'];material=obj.data.materials[0]
        if keys.get(material.name)!='brushed-steel':raise ValueError('Spout neck requires the unchanged original steel role')
        _fixture['_add'](scene,names,'detail_watering_rose_neck',mesh,material,True)
        changes.append({'kind':'source-evidenced-contact','newComponent':'detail_watering_rose_neck','construction':'short formed neck seats the original detached perforated rose on its existing spout; all original perforations and hollow can remain intact','sourceSpoutEndpointM':stem,'sourceRoseBackCenterM':ends[0],'originalGapM':math.dist(stem,ends[0]),'materialKey':'brushed-steel','candidateVertices':len(mesh[0]),'candidateTriangles':sum(len(f)-2 for f in mesh[1]),'boundsM':bounds(mesh[0])})
    return changes
