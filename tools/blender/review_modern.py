"""Generate bounded-mesh audit and contact sheets for human visual review."""
import json, struct
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[2]
m=json.loads((root/'tools/blender/modern_manifest.json').read_text(encoding='utf-8'))
rows=sorted([r for r in m['revisited']+m['added'] if not r.get('retired')],key=lambda r:(r['type'],r['id']))
audit=[]
for row in rows:
    data=(root/'public/models/furniture'/f"{row['id']}.glb").read_bytes()
    g=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    triangles=sum(g['accessors'][p['indices']]['count']//3 for mesh in g['meshes'] for p in mesh['primitives'])
    audit.append(dict(id=row['id'],bytes=len(data),triangles=triangles,materials=len(g.get('materials',[]))))
    assert 0<triangles<60000, (row['id'],triangles)
(root/'tools/blender/modern_asset_audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
out=root/'assets-source/reviews/batch12';out.mkdir(parents=True,exist_ok=True)
for page in range((len(rows)+15)//16):
    sheet=Image.new('RGB',(1400,1320),'#e7ebed');draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(rows[page*16:(page+1)*16]):
        im=Image.open(root/'assets-source/previews'/f"{row['id']}.png").convert('RGBA');im.thumbnail((340,285))
        x=i%4*350;y=i//4*330;sheet.paste(im,(x+(350-im.width)//2,y),im)
        draw.text((x+8,y+288),row['id'],fill='#182831');draw.text((x+8,y+306),row['type'],fill='#52616a')
    sheet.save(out/f'review-{page+1:02}.jpg',quality=90)
print(json.dumps(dict(models=len(audit),rawBytes=sum(a['bytes'] for a in audit),maxTriangles=max(a['triangles'] for a in audit))))
