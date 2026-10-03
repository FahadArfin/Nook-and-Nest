"""Seat the one reviewed reel lead into its original steel guide support."""
from pathlib import Path
import math,runpy

GUIDE={'name':'Hose guide support.001','vertices':56,'materials':['garage-satin-machined-steel'],
       'bounds':{'min':[.09124113619327545,-.119061678647995,.2969588339328766],
                 'max':[.11102837324142456,-.07598336040973663,.37590548396110535]}}

def seat_guide(path,guide,radius):
    if len(path)!=4 or not 0<radius<.01:raise ValueError('Expected the original four-anchor reel lead')
    p=path[0]
    if any(not math.isfinite(c) for point in path for c in point):raise ValueError('Finite lead path required')
    if any(not guide['min'][a]<p[a]<guide['max'][a] for a in (0,1)):
        raise ValueError('Lead endpoint no longer aligns with the authored steel guide')
    if not .001<guide['min'][2]-p[2]<.02:raise ValueError('Expected the observed small source guide gap')
    target=(p[0],p[1],guide['min'][2]+radius*1.4)
    if target[2]+radius>=guide['max'][2]:raise ValueError('Guide cannot contain the seated lead')
    return [target,*path[1:]]

def apply(root,scene,item,keys,names,evidence):
    if item['id']!='garage-cord-reel':raise ValueError('Wrong exact reel contact model')
    h=runpy.run_path(str(Path(__file__).with_name('garage_construction.py')))
    objects=h['_curves']['_objects'](scene,names)
    h['_curves']['_checked'](objects,GUIDE,keys)
    spec=next(s for s in evidence['objects'] if s['name']=='Stowed reel lead')
    obj,points=h['_curves']['_checked'](objects,spec,keys)
    old=h['centers'](points,8);radius=h['source_radius'](points,8)
    path=seat_guide(old,GUIDE['bounds'],radius)
    mesh=h['tube'](h['rounded_path'](path,cut=.035,spacing=.006),radius,16)
    box=h['bounds'](mesh[0])
    if any(box[s][a]<evidence['bounds']['min'][a]-1e-7 or box[s][a]>evidence['bounds']['max'][a]+1e-7 for s in ('min','max') for a in range(3)):
        raise ValueError('Seated reel lead escaped the original catalog envelope')
    changes=h['apply'](root,scene,item,keys,names,evidence)
    detail=h['_curves']['_replace'](obj,mesh,smooth_sides=False)
    for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
    changes.append({'kind':'source-evidenced-contact','component':'Stowed reel lead',
                    'support':'Hose guide support.001','originalEndpointM':old[0],
                    'seatedEndpointM':path[0],'guideInsertionM':path[0][2]-GUIDE['bounds']['min'][2],
                    'construction':'upper lead seated inside the original steel guide; outlet and remaining source anchors unchanged',**detail})
    return changes
