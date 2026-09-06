"""Segment original generated atlas into production textures; preserve full source."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
root=Path(__file__).resolve().parents[1]
out=root/'public/textures/material-studio';out.mkdir(parents=True,exist_ok=True)
im=Image.open(root/'assets-source/material-studio/flooring-atlas.png').convert('RGB')
names=['white-oak','bleached-ash','soft-maple','honey-hickory','smoked-oak','espresso-walnut','oak-herringbone','walnut-chevron','calacatta','carrara','nero-marble','jade-quartzite','ivory-travertine','fossil-limestone','charcoal-slate','ivory-terrazzo']
labels=['Natural white oak','Bleached ash','Soft maple','Honey hickory','Smoked European oak','Espresso walnut','Pale oak herringbone','Walnut chevron','Calacatta gold','Carrara silver','Nero marble','Jade quartzite','Ivory travertine','Fossil limestone','Charcoal slate','Ivory terrazzo']
floors=[];walls=[]
for i,(name,label) in enumerate(zip(names,labels)):
 x=i%4;y=i//4
 piece=im.crop((round(x*im.width/4),round(y*im.height/4),round((x+1)*im.width/4),round((y+1)*im.height/4)))
 piece.save(out/(name+'.webp'),lossless=True)
 if i<8:
  floors.append(dict(id='studio-'+name,name=label,family='Wood',texture='/textures/material-studio/'+name+'.webp',scale=1,repeatMeters=[1.2,1.8] if i<6 else [1.2,1.2],description='Wide plank · matte grain' if i<6 else 'Parquet · patterned boards'))
 else:
  # A single thin grout edge per repeat makes physical formats legible.
  tile=piece.copy();d=ImageDraw.Draw(tile);d.line((0,0,tile.width,0),fill=(174,172,166),width=1);d.line((0,0,0,tile.height),fill=(174,172,166),width=1)
  tile.save(out/(name+'-tile.webp'),lossless=True)
  family='Large marble' if i<11 else 'Stone' if i<15 else 'Terrazzo'
  for suffix,dims,labelsize in [('60x120',[.6,1.2],'60 × 120 cm'),('80x160',[.8,1.6],'80 × 160 cm'),('90x90',[.9,.9],'90 × 90 cm')]:
   floors.append(dict(id='studio-'+name+'-'+suffix,name=label+' · '+labelsize,family=family,texture='/textures/material-studio/'+name+'-tile.webp',scale=1,repeatMeters=dims,description='Honed · rectangular tile' if dims[0]!=dims[1] else 'Honed · square tile'))
  walls.append(dict(id='studio-wall-'+name,name=label+' slab',family='Stone',texture='/textures/material-studio/'+name+'.webp',scale=1,repeatMeters=[1.2,2.4],description='120 × 240 cm · mineral slab'))
(root/'src/materialStudio.json').write_text(json.dumps(dict(floors=floors,walls=walls),indent=2)+'\n',encoding='utf-8')
print(len(floors),'floor finishes;',len(walls),'wall slabs;',sum(f.stat().st_size for f in out.iterdir()),'texture bytes')
