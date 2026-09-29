"""Read-only acceptance checks on real exported sofa GLBs, not source recipes."""
import json, math, struct, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FIBRE=('upholster','fabric','linen','cloth','chenille','canvas')
WOOD=('wood','walnut','oak','maple','rattan','cane','timber','teak')
SEAM=('stitch','seam','welt','piping','thread')

def quat_point(q,p):
    x,y,z,w=q;vx,vy,vz=p
    tx=2*(y*vz-z*vy);ty=2*(z*vx-x*vz);tz=2*(x*vy-y*vx)
    return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx]

def transform(node,p):
    if 'matrix' in node:
        m=node['matrix'];return [sum(m[i+4*j]*p[j] for j in range(3))+m[i+12] for i in range(3)]
    p=[p[i]*node.get('scale',[1,1,1])[i] for i in range(3)]
    p=quat_point(node.get('rotation',[0,0,0,1]),p)
    return [p[i]+node.get('translation',[0,0,0])[i] for i in range(3)]

def verify(id,reference):
    path=ROOT/'public/models/furniture'/f'{id}.glb';data=path.read_bytes()
    length=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+length]);bin_offset=20+length+8
    expected=set(reference['baseline']['materials']);actual={m['name'] for m in g['materials']}
    assert actual==expected,(id,'material key drift',actual^expected)
    for m in g['materials']:
        key=m['name'].lower()
        if any(w in key for w in SEAM):continue
        if not any(w in key for w in FIBRE+WOOD):continue
        pbr=m['pbrMetallicRoughness']
        assert 'baseColorTexture' in pbr,(id,key,'missing actual textile/wood image')
        assert 'normalTexture' in m,(id,key,'missing actual normal texture')
        assert 'metallicRoughnessTexture' in pbr,(id,key,'missing actual roughness texture')
    for image in g.get('images',[]):assert 'bufferView' in image,(id,'external image dependency')
    points=[];triangles=0;seen=set()
    def visit(index,ancestors):
        nonlocal triangles
        node=g['nodes'][index]
        if 'mesh' in node:
            for primitive in g['meshes'][node['mesh']]['primitives']:
                triangles+=g['accessors'][primitive['indices']]['count']//3
                accessor=g['accessors'][primitive['attributes']['POSITION']];view=g['bufferViews'][accessor['bufferView']]
                assert accessor['componentType']==5126 and accessor['type']=='VEC3'
                stride=view.get('byteStride',12);offset=bin_offset+view.get('byteOffset',0)+accessor.get('byteOffset',0)
                for i in range(accessor['count']):
                    p=struct.unpack_from('<fff',data,offset+i*stride)
                    for n in [node]+ancestors:p=transform(n,p)
                    points.append(p)
                assert 'TEXCOORD_0' in primitive['attributes'],(id,'missing actual exported UVs')
        for child in node.get('children',[]):visit(child,[node]+ancestors)
    for index in g['scenes'][g.get('scene',0)]['nodes']:visit(index,[])
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    # glTF axes: width X, height Y, depth Z.
    actual_mm=[(high[i]-low[i])*1000 for i in [0,2,1]]
    assert max(abs(a-b) for a,b in zip(actual_mm,reference['row'][3:6]))<.10,(id,'envelope changed',actual_mm,reference['row'][3:6])
    assert abs(low[1])<.0001,(id,'base no longer rests on ground',low[1])
    assert abs(low[0]+high[0])<.0001 and abs(low[2]+high[2])<.0001,(id,'horizontal origin drift')
    assert triangles<50000,(id,'unbounded mesh cost',triangles)
    assert path.stat().st_size<6000000,(id,'unbounded texture/model cost',path.stat().st_size)
    return {'id':id,'triangles':triangles,'bytes':len(data),'images':len(g.get('images',[])),'dimensionsMm':[round(v,3) for v in actual_mm],'materialKeysPreserved':True}

if __name__=='__main__':
    references=json.loads((ROOT/'assets-source/sofa-realism-references.json').read_text())['models']
    selected=sys.argv[1:]
    results=[verify(r['id'],r) for r in references if not selected or r['id'] in selected]
    print(json.dumps({'verified':len(results),'results':results},indent=2))
