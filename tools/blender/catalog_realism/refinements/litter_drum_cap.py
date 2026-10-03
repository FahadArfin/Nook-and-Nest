"""Close the measured original rear pole opening, preserving the front entrance."""
from pathlib import Path
import runpy
_c=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))

def close_pole(points,faces):
    if len(points)!=1536 or len(faces)!=1472:raise ValueError('Original 24 by64 drum topology changed')
    ring=points[-64:];center=tuple(sum(p[a] for p in ring)/64 for a in range(3))
    if max(p[1] for p in ring)-min(p[1] for p in ring)>1e-6:raise ValueError('Rear pole ring is not planar')
    if max(abs(p[0]-center[0]) for p in ring)>.011:raise ValueError('Unexpected rear opening size')
    vertices=points+[center];cap=len(points)
    result=faces+[(1472+i,1472+(i+1)%64,cap) for i in range(64)]
    return _c['outward'](vertices,result)

def apply(scene,keys,names,spec):
    obj,points=_c['_checked'](_c['_objects'](scene,names),spec,keys)
    detail=_c['_replace'](obj,close_pole(points,[tuple(f.vertices) for f in obj.data.polygons]))
    for face in obj.data.polygons:face.use_smooth=True
    return {'kind':'source-evidenced-construction','component':spec['name'],'construction':'closed rear drum pole with original front entrance and complete original shell retained',**detail}
