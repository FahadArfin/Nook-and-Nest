"""Read-only exported GLB clearance check, using only the Python standard library.

Run from any directory: python tools/blender/check_household_pothos.py
Checks the authored pothos centered on the highest tiered-plant-stand tray.
No Blender session, generated contact sheet, app server or geometry mutation.
"""
import json, struct, math
from pathlib import Path
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[2]

def load_triangles(catalog_id, foliage_only=False):
    data=(ROOT/'public/models/furniture'/f'{catalog_id}.glb').read_bytes()
    n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]);buf=data[28+n:]
    for node in doc['nodes']:
        assert not any(k in node for k in ['translation','rotation','scale','matrix']), 'Unexpected unbaked node transform'
    def values(ai):
        a=doc['accessors'][ai];b=doc['bufferViews'][a['bufferView']]
        fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        count={'SCALAR':1,'VEC3':3}[a['type']];size=struct.calcsize(fmt)*count
        start=b.get('byteOffset',0)+a.get('byteOffset',0);stride=b.get('byteStride',size)
        return [struct.unpack_from('<'+fmt*count,buf,start+i*stride) for i in range(a['count'])]
    out=[]
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            name=doc['materials'][p['material']]['name']
            if foliage_only and 'botanical' not in name:continue
            v=[(-x*1000,y*1000,z*1000) for x,y,z in values(p['attributes']['POSITION'])]
            idx=[i[0] for i in values(p['indices'])]
            out += [(name,[v[j] for j in idx[i:i+3]]) for i in range(0,len(idx),3)]
    return out

def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def segment_triangle(p,q,tri):
    a,b,c=tri;d=sub(q,p);e1=sub(b,a);e2=sub(c,a);h=cross(d,e2);det=dot(e1,h)
    if abs(det)<1e-8:return False
    inv=1/det;s=sub(p,a);u=inv*dot(s,h)
    if u< -1e-7 or u>1+1e-7:return False
    r=cross(s,e1);v=inv*dot(d,r)
    if v< -1e-7 or u+v>1+1e-7:return False
    t=inv*dot(e2,r)
    return -1e-7<=t<=1+1e-7
def intersects(a,b):
    return any(segment_triangle(p,q,b) for p,q in zip(a,a[1:]+a[:1])) or any(segment_triangle(p,q,a) for p,q in zip(b,b[1:]+b[:1]))
def bounds(tri):return tuple(min(p[k] for p in tri) for k in range(3)),tuple(max(p[k] for p in tri) for k in range(3))
def cells(lo,hi,size=50):
    for x in range(math.floor(lo[0]/size),math.floor(hi[0]/size)+1):
        for y in range(math.floor(lo[1]/size),math.floor(hi[1]/size)+1):
            for z in range(math.floor(lo[2]/size),math.floor(hi[2]/size)+1):yield x,y,z
def clip(poly,plane):
    out=[]
    for p,q in zip(poly,poly[1:]+poly[:1]):
        inside=p[1]<=plane;other=q[1]<=plane
        if inside:out.append(p)
        if inside!=other:
            t=(plane-p[1])/(q[1]-p[1]);out.append(tuple(p[k]+t*(q[k]-p[k]) for k in range(3)))
    return out
def radial_distance(poly,cx,cz):
    pts=[(p[0]-cx,p[2]-cz) for p in poly];best=1e9;signs=[]
    for p,q in zip(pts,pts[1:]+pts[:1]):
        dx=q[0]-p[0];dz=q[1]-p[1];den=dx*dx+dz*dz
        t=max(0,min(1,-(p[0]*dx+p[1]*dz)/den)) if den else 0
        best=min(best,math.hypot(p[0]+t*dx,p[1]+t*dz));signs.append(p[0]*q[1]-p[1]*q[0])
    if len(pts)>=3 and (all(s>=0 for s in signs) or all(s<=0 for s in signs)):return 0
    return best

if __name__=='__main__':
    contact=json.loads((ROOT/'src/householdSupportFootprints.json').read_text())['trailing-pothos-in-shelf-pot']
    high=next(p for p in json.loads((ROOT/'src/householdShelfSurfaces.json').read_text())['tiered-plant-stand'] if p['id']=='high')
    plant=load_triangles('trailing-pothos-in-shelf-pot',True)
    minimum=min(radial_distance(p,contact['x'],contact['z']) for _,tri in plant if len(p:=clip(tri,contact['offset']+25))>=2)
    shift=(high['x']-contact['x'],high['height']-contact['offset'],high['z']-contact['z'])
    plant=[(name,[tuple(v[k]+shift[k] for k in range(3)) for v in tri]) for name,tri in plant]
    host=load_triangles('tiered-plant-stand');grid=defaultdict(list);host_boxes=[]
    low=min(v[1] for _,tri in plant for v in tri)
    for i,(_,tri) in enumerate(host):
        lo,hi=bounds(tri);host_boxes.append((lo,hi))
        if hi[1]<low:continue
        for key in cells(lo,hi):grid[key].append(i)
    hits=[]
    for name,tri in plant:
        lo,hi=bounds(tri);candidates=set(i for key in cells(lo,hi) for i in grid[key])
        for i in candidates:
            hname,htri=host[i];hlo,hhi=host_boxes[i]
            if any(hi[k]<hlo[k] or hhi[k]<lo[k] for k in range(3)):continue
            if intersects(tri,htri):hits.append({'plantMaterial':name,'hostMaterial':hname,'hostTriangleBounds':[hlo,hhi]})
    tray_radius=max(high['width'],high['depth'])*133/170
    conservative=contact.get('hangingClearRadius',0)
    passed=not hits and low>=0 and minimum>=conservative and conservative>=tray_radius+10
    print(json.dumps({'passed':passed,'minimumFoliageRadiusBelowContactPlus25mm':minimum,'contact':contact,'placementShiftMm':shift,'lowestFoliageWorldYmm':low,'trayOuterRadiusMm':tray_radius,'intersectionCount':len(hits),'examples':hits[:6]},indent=2))
    raise SystemExit(0 if passed else 1)
