"""Read-only exported-asset contract for all garage and outdoor additions.

Run after serialized authoring: python tools/blender/garage_outdoor_verify.py
Optional positional IDs select a reviewed repair. This inspects actual GLB BIN
positions, UVs, materials and triangle contact, without loading/mutating Blender.
It does not equate passing binary checks with human visual acceptance.
"""
import argparse
import json
import math
import re
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CATALOGS=('garageExpansion','outdoorLivingExpansion')
COMPONENTS={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
WIDTHS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}


def require(condition,*message):
    if not condition:raise AssertionError(' | '.join(map(str,message)))


def load_glb(path):
    data=path.read_bytes()
    require(len(data)>=28,path.stem,'truncated GLB')
    require(struct.unpack_from('<III',data)==(0x46546C67,2,len(data)),path.stem,'invalid GLB 2 header')
    offset=12;chunks=[]
    while offset<len(data):
        length,kind=struct.unpack_from('<II',data,offset);offset+=8
        require(length%4==0 and offset+length<=len(data),path.stem,'bad chunk length')
        chunks.append((kind,data[offset:offset+length]));offset+=length
    require(chunks[0][0]==0x4E4F534A,path.stem,'JSON chunk must lead')
    require(sum(k==0x4E4F534A for k,_ in chunks)==1,path.stem,'duplicate JSON chunk')
    binary=[b for k,b in chunks if k==0x004E4942]
    require(len(binary)==1,path.stem,'one embedded BIN required')
    return json.loads(chunks[0][1]),binary[0],len(data)


def values(g,b,index):
    a=g['accessors'][index]
    require('sparse' not in a,'sparse accessors not supported by this authoring contract')
    require('bufferView' in a,'missing accessor view')
    view=g['bufferViews'][a['bufferView']]
    require(view.get('buffer',0)==0,'external buffer view')
    fmt,size=COMPONENTS[a['componentType']];count=WIDTHS[a['type']]
    stride=view.get('byteStride',size*count);offset=view.get('byteOffset',0)+a.get('byteOffset',0)
    require(offset+(a['count']-1)*stride+size*count<=len(b),'accessor beyond embedded BIN')
    require(stride>=size*count,'accessor stride too short')
    result=[struct.unpack_from('<'+fmt*count,b,offset+i*stride) for i in range(a['count'])]
    require(all(math.isfinite(x) for v in result for x in v),'non-finite exported accessor',index)
    return result


def transform(node,p):
    if 'matrix' in node:
        m=node['matrix'];return tuple(sum(m[i+4*j]*p[j] for j in range(3))+m[i+12] for i in range(3))
    vx,vy,vz=[p[i]*node.get('scale',[1,1,1])[i] for i in range(3)]
    x,y,z,w=node.get('rotation',[0,0,0,1]);tx=2*(y*vz-z*vy);ty=2*(z*vx-x*vz);tz=2*(x*vy-y*vx)
    q=(vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx)
    return tuple(q[i]+node.get('translation',[0,0,0])[i] for i in range(3))


def point_in_triangle(x,z,a,b,c):
    # Barycentric XZ test, excluding vertical/degenerate triangles.
    v0=(b[0]-a[0],b[2]-a[2]);v1=(c[0]-a[0],c[2]-a[2]);v2=(x-a[0],z-a[2])
    den=v0[0]*v1[1]-v1[0]*v0[1]
    if abs(den)<1e-14:return False
    u=(v2[0]*v1[1]-v1[0]*v2[1])/den;v=(v0[0]*v2[1]-v2[0]*v0[1])/den
    return u>=-1e-8 and v>=-1e-8 and u+v<=1+1e-8


def vertical_hit_height(x,z,a,b,c):
    v0=(b[0]-a[0],b[2]-a[2]);v1=(c[0]-a[0],c[2]-a[2]);v2=(x-a[0],z-a[2])
    den=v0[0]*v1[1]-v1[0]*v0[1]
    if abs(den)<1e-14:return None
    u=(v2[0]*v1[1]-v1[0]*v2[1])/den;v=(v0[0]*v2[1]-v2[0]*v0[1])/den
    if u<0 or v<0 or u+v>1:return None
    return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])


def surface_contact(id,plane,triangles,dimensions):
    keys=('x','z','width','depth','height','clearance')
    require(all(k in plane and isinstance(plane[k],(int,float)) and math.isfinite(plane[k]) for k in keys),id,'invalid support metadata',plane)
    require(plane['width']>0 and plane['depth']>0 and plane['height']>=-.1 and plane['clearance']>0,id,'non-positive support metadata',plane['id'])
    require(abs(plane['x'])+plane['width']/2<=dimensions[0]/2+.15,id,'surface beyond width',plane['id'])
    require(abs(plane['z'])+plane['depth']/2<=dimensions[1]/2+.15,id,'surface beyond depth',plane['id'])
    require(plane['height']<=dimensions[2]+.15,id,'surface beyond height',plane['id'])
    h=plane['height']/1000
    horizontal=[t for t in triangles if max(abs(p[1]-h) for p in t)<.00018]
    require(horizontal,id,'no actual coplanar support triangles',plane['id'],h)
    hits=0;total=25
    # Deterministic stagger avoids repeatedly selecting a single regular slat gap.
    for i in range(5):
        for j in range(5):
            x=(plane['x']+((i+.42+(j%2)*.11)/5-.5)*plane['width']*.94)/1000
            z=(plane['z']+((j+.47)/5-.5)*plane['depth']*.94)/1000
            if any(point_in_triangle(x,z,*t) for t in horizontal):hits+=1
    # Slatted shelving/tops deliberately contain drainage gaps; a conservative
    # envelope needs majority physical support, rather than pretending a slab.
    require(hits>=16,id,'insufficient physical contact in advertised plane',plane['id'],f'{hits}/{total}')
    # Nine interior vertical rays catch a cubby divider, drawer, worktop edge or
    # cushion back crossing space advertised as usable above a support plane.
    top=h+plane['clearance']/1000;clearance_hits=[]
    candidates=[t for t in triangles if max(p[1] for p in t)>h+.001 and min(p[1] for p in t)<top-.001]
    for i in range(3):
        for j in range(3):
            x=(plane['x']+(i-1)*plane['width']*.29)/1000;z=(plane['z']+(j-1)*plane['depth']*.29)/1000
            blocker=next((y for t in candidates if (y:=vertical_hit_height(x,z,*t)) is not None and h+.001<y<top-.001),None)
            if blocker is not None:clearance_hits.append((i,j,round(blocker*1000,3)))
    require(not clearance_hits,id,'occupied advertised vertical clearance',plane['id'],clearance_hits)
    return {'surface':plane['id'],'supportedSamples':hits,'samples':total,'clearanceRays':9}


def verify(row,audit,surfaces,footprints,root=ROOT):
    id=row[0];path=root/'public/models/furniture'/f'{id}.glb'
    g,b,size=load_glb(path)
    require(len(row)>=10 and row[8] in {'floor','wall','surface','ceiling'},id,'invalid catalog mount')
    require(all(isinstance(v,(float,int)) and v>0 for v in row[3:6]),id,'invalid declared dimensions')
    require(len(g.get('scenes',[]))==1,id,'requires one isolated scene')
    require(not g.get('cameras') and not g.get('animations'),id,'unexpected camera or animation')
    require(len(g.get('buffers',[]))==1 and 'uri' not in g['buffers'][0],id,'external buffer')
    require(all('bufferView' in im and 'uri' not in im for im in g.get('images',[])),id,'external image dependency')
    require(size<5000000,id,'over 5 MB model budget',size)
    names=[m.get('name') for m in g.get('materials',[])]
    require(names and all(isinstance(n,str) and n.strip() for n in names),id,'unnamed material')
    require(len(set(names))==len(names),id,'duplicate material key')
    require(not any(re.search(r'\.[0-9]+$',n) for n in names),id,'uncanonical Blender suffix')
    for m in g['materials']:
        require(m.get('extras',{}).get('nook_canonical_material_key')==m['name'],id,'material/source canonical tag mismatch',m['name'])
        family=m.get('extras',{}).get('realism_family')
        if family:
            if family!='ceramic':
                require('baseColorTexture' in m.get('pbrMetallicRoughness',{}),id,'missing real material base image',m['name'])
            require('normalTexture' in m,id,'missing material normal map',m['name'])
            require('metallicRoughnessTexture' in m.get('pbrMetallicRoughness',{}),id,'missing material roughness map',m['name'])
    source=root/'assets-source/blender'/f'{id}.blend'
    require(source.is_file() and source.stat().st_size>1000,id,'editable Blender source absent')
    preview=root/'assets-source/previews'/f'{id}.png'
    require(preview.is_file() and preview.stat().st_size>1000,id,'source render absent')
    triangles=[];points=[];nodes=g['nodes'];visited=set()
    def visit(index,parents):
        require(index not in parents,id,'node cycle')
        node=nodes[index];visited.add(index)
        require(node.get('name','') not in {'Cube','Camera','Light'},id,'startup object exported')
        if 'mesh' in node:
            for primitive in g['meshes'][node['mesh']]['primitives']:
                require(primitive.get('mode',4)==4,id,'non-triangle mesh primitive')
                attr=primitive['attributes'];require('POSITION' in attr and 'TEXCOORD_0' in attr,id,'missing real positions/UVs')
                uv=values(g,b,attr['TEXCOORD_0']);raw=values(g,b,attr['POSITION'])
                require(len(uv)==len(raw),id,'UV/position counts disagree')
                if 'NORMAL' in attr:values(g,b,attr['NORMAL'])
                vertices=[]
                for p in raw:
                    for n in [index]+parents:p=transform(nodes[n],p)
                    # Babylon furniture import is left-handed then faces front;
                    # this is the same X sign and Z convention as driver planes.
                    vertices.append((-p[0],p[1],p[2]));points.append(p)
                inds=[v[0] for v in values(g,b,primitive['indices'])] if 'indices' in primitive else list(range(len(vertices)))
                require(len(inds)%3==0 and all(0<=j<len(vertices) for j in inds),id,'invalid triangles')
                triangles.extend(tuple(vertices[inds[k+l]] for l in range(3)) for k in range(0,len(inds),3))
        for child in node.get('children',[]):visit(child,[index]+parents)
    for index in g['scenes'][0]['nodes']:visit(index,[])
    require(points and len(triangles)<50000,id,'empty/unbounded triangle count',len(triangles))
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    dims=[1000*(high[i]-low[i]) for i in (0,2,1)]
    require(max(abs(x-y) for x,y in zip(dims,row[3:6]))<.12,id,'declared versus real vertex bounds',dims,row[3:6])
    require(abs(low[1])<.00012 and abs(low[0]+high[0])<.00012 and abs(low[2]+high[2])<.00012,id,'base/center drift',low,high)
    entry=audit.get(id);require(entry is not None,id,'missing authoring audit')
    require(entry['dimensionsMm']==row[3:6] and entry['glbBytes']==size,id,'stale declared audit')
    require(entry['triangles']==len(triangles),id,'audit/actual triangle mismatch',entry['triangles'],len(triangles))
    require(entry['editableParts']>=3,id,'missing editable construction parts')
    checks=[surface_contact(id,p,triangles,row[3:6]) for p in surfaces.get(id,[])]
    if id in footprints:
        f=footprints[id];require(f['dimensionsMm']==row[3:6],id,'footprint dimension drift')
        require(abs(f['x'])+f['width']/2<=row[3]/2+.15 and abs(f['z'])+f['depth']/2<=row[4]/2+.15,id,'contact footprint outside mesh envelope')
        require(f['width']>0 and f['depth']>0 and 0<=f['offset']<=row[5],id,'invalid contact footprint')
    return {'id':id,'triangles':len(triangles),'bytes':size,'images':len(g.get('images',[])),
      'dimensionsMm':[round(x,3) for x in dims],'sourceCanonicalTags':True,'support':checks}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('ids',nargs='*');parser.add_argument('--root',type=Path,default=ROOT)
    args=parser.parse_args();root=args.root
    rows=[r for name in CATALOGS for r in json.loads((root/'src'/f'{name}.json').read_text(encoding='utf-8-sig'))]
    ids=[r[0] for r in rows];require(len(set(ids))==len(ids),'duplicate new catalog IDs')
    require(set(args.ids)<=set(ids),'unknown requested IDs',set(args.ids)-set(ids))
    audit=json.loads((root/'assets-source/garage-outdoor-collection-audit.json').read_text())
    surfaces=json.loads((root/'src/garageOutdoorShelfSurfaces.json').read_text())
    footprints=json.loads((root/'src/garageOutdoorSupportFootprints.json').read_text())
    selected=[r for r in rows if not args.ids or r[0] in args.ids]
    results=[];failures=[]
    for row in selected:
        try:results.append(verify(row,audit,surfaces,footprints,root))
        except Exception as error:failures.append({'id':row[0],'error':str(error)})
    print(json.dumps({'verified':len(results),'selected':len(selected),'failures':failures,'results':results},indent=2))
    if failures:raise SystemExit(1)


if __name__=='__main__':main()
